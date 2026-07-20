import { createHash } from 'node:crypto';

const DEFAULT_COLLECTION = 'skill_embeddings';
const DEFAULT_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const DEFAULT_VECTOR_NAME = 'dense';
const DEFAULT_VECTOR_SIZE = 384;

type QdrantEnvironment = Record<string, string | undefined>;

export type QdrantConfig = {
  url: string;
  apiKey: string;
  collection: string;
  embeddingModel: string;
  vectorName: string;
  vectorSize: number;
};

export type SimilarSkill = {
  skillId: string;
  score: number;
};

type QdrantResponse<T> = {
  result?: T;
};

type CollectionResponse = {
  config?: {
    params?: {
      vectors?: Record<string, { size?: number }>;
    };
  };
};

type PointResponse = {
  vector?: Record<string, number[]>;
};

type SearchResponse = {
  points?: Array<{
    score?: number;
    payload?: { skill_id?: unknown };
  }>;
};

type SearchOptions = {
  query: unknown;
  limit: number;
  filter?: Record<string, unknown>;
};

export class QdrantError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'QdrantError';
    this.status = status;
  }
}

function requiredEnvironment(environment: QdrantEnvironment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function getQdrantConfig(environment: QdrantEnvironment = process.env): QdrantConfig {
  return {
    url: requiredEnvironment(environment, 'QDRANT_URL').replace(/\/+$/, ''),
    apiKey: requiredEnvironment(environment, 'QDRANT_API_KEY'),
    collection: environment.QDRANT_COLLECTION?.trim() || DEFAULT_COLLECTION,
    embeddingModel: environment.QDRANT_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL,
    vectorName: environment.QDRANT_VECTOR_NAME?.trim() || DEFAULT_VECTOR_NAME,
    vectorSize: positiveInteger(
      environment.QDRANT_VECTOR_SIZE?.trim() || String(DEFAULT_VECTOR_SIZE),
      'QDRANT_VECTOR_SIZE',
    ),
  };
}

function pointId(skillId: string): string {
  // Qdrant point IDs must be uint64s or UUIDs. A deterministic UUID keeps
  // repeated enrichment runs idempotent without exposing the skill ID as an ID.
  const bytes = createHash('sha256').update(skillId).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function qdrantRequest<T>(
  config: QdrantConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
      ...init?.headers,
    },
  });
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = body ? (JSON.parse(body) as unknown) : undefined;
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'status' in parsed
        ? JSON.stringify(parsed)
        : body || response.statusText;
    throw new QdrantError(response.status, `Qdrant request failed: ${message}`);
  }

  return parsed as T;
}

function collectionPath(config: QdrantConfig): string {
  return `/collections/${encodeURIComponent(config.collection)}`;
}

export async function ensureQdrantCollection(
  config: QdrantConfig = getQdrantConfig(),
): Promise<void> {
  let response: QdrantResponse<CollectionResponse>;
  try {
    response = await qdrantRequest<QdrantResponse<CollectionResponse>>(
      config,
      collectionPath(config),
    );
  } catch (error) {
    if (!(error instanceof QdrantError) || error.status !== 404) throw error;

    await qdrantRequest(config, collectionPath(config), {
      method: 'PUT',
      body: JSON.stringify({
        vectors: {
          [config.vectorName]: {
            size: config.vectorSize,
            distance: 'Cosine',
          },
        },
      }),
    });
    return;
  }

  const size = response.result?.config?.params?.vectors?.[config.vectorName]?.size;
  if (size !== config.vectorSize) {
    throw new Error(
      `Qdrant collection ${config.collection} has vector ${config.vectorName} size ${String(size)}, expected ${config.vectorSize}`,
    );
  }
}

export async function upsertSkillEmbedding(
  skillId: string,
  distilledText: string,
  config: QdrantConfig = getQdrantConfig(),
): Promise<void> {
  if (!skillId.trim()) throw new Error('skillId must not be empty');
  if (!distilledText.trim()) throw new Error('distilledText must not be empty');

  await ensureQdrantCollection(config);
  await qdrantRequest(config, `${collectionPath(config)}/points?wait=true`, {
    method: 'PUT',
    body: JSON.stringify({
      points: [
        {
          id: pointId(skillId),
          vector: {
            [config.vectorName]: {
              text: distilledText,
              model: config.embeddingModel,
            },
          },
          payload: { skill_id: skillId },
        },
      ],
    }),
  });
}

export async function searchNearestSkills(
  skillId: string,
  limit = 10,
  config: QdrantConfig = getQdrantConfig(),
): Promise<SimilarSkill[]> {
  if (!skillId.trim()) throw new Error('skillId must not be empty');
  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    throw new Error('limit must be an integer between 1 and 100');
  }

  await ensureQdrantCollection(config);
  let source: QdrantResponse<PointResponse>;
  try {
    source = await qdrantRequest<QdrantResponse<PointResponse>>(
      config,
      `${collectionPath(config)}/points/${encodeURIComponent(pointId(skillId))}?with_vector=true&with_payload=false`,
    );
  } catch (error) {
    if (error instanceof QdrantError && error.status === 404) return [];
    throw error;
  }

  const vector = source.result?.vector?.[config.vectorName];
  if (!vector) return [];

  return searchQdrantPoints(
    {
      query: vector,
      limit,
      filter: {
        must_not: [{ key: 'skill_id', match: { value: skillId } }],
      },
    },
    config,
  );
}

async function searchQdrantPoints(
  options: SearchOptions,
  config: QdrantConfig,
): Promise<SimilarSkill[]> {
  const result = await qdrantRequest<QdrantResponse<SearchResponse>>(
    config,
    `${collectionPath(config)}/points/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        query: options.query,
        using: config.vectorName,
        limit: options.limit,
        with_payload: true,
        ...(options.filter ? { filter: options.filter } : {}),
      }),
    },
  );

  return (result.result?.points ?? []).flatMap((point) => {
    const resultSkillId = point.payload?.skill_id;
    return typeof resultSkillId === 'string' && typeof point.score === 'number'
      ? [{ skillId: resultSkillId, score: point.score }]
      : [];
  });
}

export async function searchSkillsByText(
  text: string,
  limit = 10,
  config: QdrantConfig = getQdrantConfig(),
): Promise<SimilarSkill[]> {
  if (!text.trim()) throw new Error('text must not be empty');
  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    throw new Error('limit must be an integer between 1 and 100');
  }

  await ensureQdrantCollection(config);
  return searchQdrantPoints(
    {
      query: { text, model: config.embeddingModel },
      limit,
    },
    config,
  );
}

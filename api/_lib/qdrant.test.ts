import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ensureQdrantCollection,
  getQdrantConfig,
  searchSkillsByText,
  searchNearestSkills,
  upsertSkillEmbedding,
} from './qdrant.js';

const config = {
  url: 'https://example.qdrant.io',
  apiKey: 'secret',
  collection: 'skills',
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  vectorName: 'dense',
  vectorSize: 384,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getQdrantConfig', () => {
  it('uses the free model defaults and allows model settings to be swapped', () => {
    expect(
      getQdrantConfig({
        QDRANT_URL: 'https://qdrant.example///',
        QDRANT_API_KEY: 'key',
        QDRANT_VECTOR_SIZE: '768',
        QDRANT_EMBEDDING_MODEL: 'custom/model',
      }),
    ).toEqual({
      url: 'https://qdrant.example',
      apiKey: 'key',
      collection: 'skill_embeddings',
      embeddingModel: 'custom/model',
      vectorName: 'dense',
      vectorSize: 768,
    });
  });
});

describe('Qdrant helpers', () => {
  it('creates the collection and upserts distilled text for Cloud Inference', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ error: 'not found' }, 404))
      .mockResolvedValueOnce(response({ result: true }))
      .mockResolvedValueOnce(response({ result: { operation_id: 1 } }));

    await upsertSkillEmbedding(
      'owner/skill',
      'Goal: build accessible React interfaces. Requires React and TypeScript.',
      ['web-frontend-development', 'coding-agents-ides'],
      config,
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'PUT',
      headers: expect.objectContaining({ 'api-key': 'secret' }),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      vectors: { dense: { size: 384, distance: 'Cosine' } },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      points: [
        {
          payload: {
            skill_id: 'owner/skill',
            categories: ['web-frontend-development', 'coding-agents-ides'],
          },
          vector: {
            dense: {
              text: 'Goal: build accessible React interfaces. Requires React and TypeScript.',
              model: 'sentence-transformers/all-MiniLM-L6-v2',
            },
          },
        },
      ],
    });
  });

  it('searches nearest neighbors by the stored skill vector', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response({
          result: { config: { params: { vectors: { dense: { size: 384 } } } } },
        }),
      )
      .mockResolvedValueOnce(response({ result: { vector: { dense: [0.1, 0.2] } } }))
      .mockResolvedValueOnce(
        response({
          result: {
            points: [
              { score: 0.91, payload: { skill_id: 'owner/related' } },
              { score: 0.72, payload: { skill_id: 'owner/other' } },
            ],
          },
        }),
      );

    await expect(searchNearestSkills('owner/skill', 5, config)).resolves.toEqual([
      { skillId: 'owner/related', score: 0.91 },
      { skillId: 'owner/other', score: 0.72 },
    ]);

    expect(fetchMock.mock.calls[2]?.[0]).toContain('/points/query');
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      query: [0.1, 0.2],
      using: 'dense',
      limit: 5,
      filter: {
        must_not: [{ key: 'skill_id', match: { value: 'owner/skill' } }],
      },
    });
  });

  it('returns no neighbors when the source skill is not indexed', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response({
          result: { config: { params: { vectors: { dense: { size: 384 } } } } },
        }),
      )
      .mockResolvedValueOnce(response({ error: 'not found' }, 404));

    await expect(searchNearestSkills('missing/skill', 10, config)).resolves.toEqual([]);
  });

  it('searches the enriched subset by query text using Cloud Inference', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response({
          result: { config: { params: { vectors: { dense: { size: 384 } } } } },
        }),
      )
      .mockResolvedValueOnce(
        response({
          result: {
            points: [{ score: 0.88, payload: { skill_id: 'owner/a' } }],
          },
        }),
      );

    await expect(searchSkillsByText('accessible forms', 5, [], config)).resolves.toEqual([
      { skillId: 'owner/a', score: 0.88 },
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      query: { text: 'accessible forms', model: config.embeddingModel },
      using: 'dense',
      limit: 5,
      with_payload: true,
    });
  });

  it('pre-filters the text search by the requested categories', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response({
          result: { config: { params: { vectors: { dense: { size: 384 } } } } },
        }),
      )
      .mockResolvedValueOnce(
        response({
          result: {
            points: [{ score: 0.88, payload: { skill_id: 'owner/a' } }],
          },
        }),
      );

    await expect(
      searchSkillsByText('deploy pipeline', 5, ['devops-cloud', 'cli-utilities'], config),
    ).resolves.toEqual([{ skillId: 'owner/a', score: 0.88 }]);

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      query: { text: 'deploy pipeline', model: config.embeddingModel },
      using: 'dense',
      limit: 5,
      with_payload: true,
      filter: { must: [{ key: 'categories', match: { any: ['devops-cloud', 'cli-utilities'] } }] },
    });
  });

  it('rejects a collection whose vector size does not match the configured model', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({
        result: { config: { params: { vectors: { dense: { size: 768 } } } } },
      }),
    );

    await expect(ensureQdrantCollection(config)).rejects.toThrow('expected 384');
  });
});

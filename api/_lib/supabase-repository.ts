import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

const RAW_SKILLS_BUCKET = 'raw-skills';

export type EnrichmentRequired = {
  primaryGoal: string;
  requires: string[];
  estimatedComplexity: string;
  bestFor: string[];
};

export type SkillEnrichmentRecord = {
  skillId: string;
  contentHash: string;
  required: EnrichmentRequired;
  optional?: Record<string, unknown>;
  estimatedReadTimeMinutes: number;
};

export type SkillMetadataRecord = SkillEnrichmentRecord & {
  sourceUrl?: string;
  repository?: string;
  installCount?: number;
  rawStoragePrefix?: string;
};

export type SkillSourceMetadata = {
  skillId: string;
  contentHash: string;
  sourceUrl?: string;
  repository?: string;
  installCount?: number;
  rawStoragePrefix?: string;
};

/** Sparse skills.sh HTML page snapshot; all fields optional. */
export type SkillPageSnapshot = {
  summary?: string;
  topics?: string[];
  repository?: string;
  stars?: number;
  firstSeen?: string;
  installCommand?: string;
  related?: unknown[];
  weeklyInstalls?: number[];
  skillMdPreview?: string;
};

/** Opaque skills.sh /audit payload until the audit-cache task shapes it. */
export type SkillAudits = Record<string, unknown>;

export type SkillInstallSnapshotRecord = {
  skillId: string;
  date: string;
  installs: number;
};

export type RawSkillFile = {
  path: string;
  content: string | Uint8Array;
  contentType?: string;
};

type Database = {
  public: {
    Tables: {
      skill_metadata: {
        Row: {
          skill_id: string;
          content_hash: string;
          enrichment_required: EnrichmentRequired | null;
          enrichment_optional: Record<string, unknown>;
          estimated_read_time_minutes: number | null;
          source_url: string | null;
          repository: string | null;
          install_count: number | null;
          raw_storage_prefix: string | null;
          page_snapshot: SkillPageSnapshot | null;
          audits: SkillAudits | null;
          audits_fetched_at: string | null;
          page_scraped_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      skill_raw_files: {
        Row: {
          skill_id: string;
          file_path: string;
          storage_path: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      skill_install_snapshots: {
        Row: {
          skill_id: string;
          date: string;
          installs: number;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type RepositoryClient = SupabaseClient<Database>;

function metadataRow(record: SkillEnrichmentRecord): Record<string, unknown> {
  return {
    skill_id: record.skillId,
    content_hash: record.contentHash,
    enrichment_required: record.required,
    enrichment_optional: record.optional ?? {},
    estimated_read_time_minutes: record.estimatedReadTimeMinutes,
    enriched_at: new Date().toISOString(),
  };
}

function sourceMetadataRow(record: SkillSourceMetadata): Record<string, unknown> {
  return {
    skill_id: record.skillId,
    content_hash: record.contentHash,
    source_url: record.sourceUrl ?? null,
    repository: record.repository ?? null,
    install_count: record.installCount ?? null,
    raw_storage_prefix: record.rawStoragePrefix ?? null,
  };
}

function toSkillEnrichmentRecord(row: Record<string, unknown>): SkillEnrichmentRecord {
  return {
    skillId: String(row.skill_id),
    contentHash: String(row.content_hash),
    required: row.enrichment_required as EnrichmentRequired,
    optional: row.enrichment_optional as Record<string, unknown>,
    estimatedReadTimeMinutes: Number(row.estimated_read_time_minutes),
  };
}

function toSkillMetadataRecord(row: Record<string, unknown>): SkillMetadataRecord {
  return {
    ...toSkillEnrichmentRecord(row),
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    repository: row.repository ? String(row.repository) : undefined,
    installCount:
      row.install_count === null || row.install_count === undefined
        ? undefined
        : Number(row.install_count),
    rawStoragePrefix: row.raw_storage_prefix ? String(row.raw_storage_prefix) : undefined,
  };
}

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(`Supabase repository error: ${error.message}`);
}

function storagePath(skillId: string, filePath: string): string {
  return `${skillId}/${filePath.replace(/^\/+/, '')}`;
}

export function estimateReadTimeMinutes(content: string): number {
  const wordCount = content.trim() === '' ? 0 : content.trim().split(/\s+/u).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function createSupabaseRepository(client: RepositoryClient) {
  return {
    async upsertSkillMetadata(record: SkillSourceMetadata): Promise<void> {
      const result = await client
        .from('skill_metadata')
        .upsert(sourceMetadataRow(record), { onConflict: 'skill_id' });
      throwOnError(result.error);
    },

    async getSkillEnrichment(skillId: string): Promise<SkillEnrichmentRecord | null> {
      const result = await client
        .from('skill_metadata')
        .select('*')
        .eq('skill_id', skillId)
        .maybeSingle();
      throwOnError(result.error);
      const row = result.data as Record<string, unknown> | null;
      return row?.enrichment_required ? toSkillEnrichmentRecord(row) : null;
    },

    async getSkillMetadata(skillIds: string[]): Promise<SkillMetadataRecord[]> {
      if (skillIds.length === 0) return [];
      const result = await client.from('skill_metadata').select('*').in('skill_id', skillIds);
      throwOnError(result.error);
      return (result.data ?? [])
        .filter((row) => row.enrichment_required)
        .map((row) => toSkillMetadataRecord(row as Record<string, unknown>));
    },

    async upsertSkillEnrichment(record: SkillEnrichmentRecord): Promise<SkillEnrichmentRecord> {
      const result = await client
        .from('skill_metadata')
        .upsert(metadataRow(record), { onConflict: 'skill_id' })
        .select('*')
        .single();
      throwOnError(result.error);
      return toSkillEnrichmentRecord(result.data as Record<string, unknown>);
    },

    async getByContentHash(hash: string): Promise<SkillEnrichmentRecord[]> {
      const result = await client
        .from('skill_metadata')
        .select('*')
        .eq('content_hash', hash)
        .not('enrichment_required', 'is', null)
        .order('skill_id');
      throwOnError(result.error);
      return (result.data ?? []).map(toSkillEnrichmentRecord);
    },

    async listMissingEnrichment(limit = 100): Promise<Array<{ skillId: string }>> {
      const result = await client
        .from('skill_metadata')
        .select('skill_id')
        .is('enrichment_required', null)
        .order('skill_id')
        .limit(limit);
      throwOnError(result.error);
      return (result.data ?? []).map((row) => ({ skillId: String(row.skill_id) }));
    },

    async putRawSkillFiles(skillId: string, files: RawSkillFile[]): Promise<void> {
      const bucket = client.storage.from(RAW_SKILLS_BUCKET);
      const pointers: Record<string, unknown>[] = [];

      for (const file of files) {
        const path = storagePath(skillId, file.path);
        const upload = await bucket.upload(path, file.content, {
          contentType: file.contentType ?? 'text/markdown',
          upsert: true,
        });
        throwOnError(upload.error);
        pointers.push({
          skill_id: skillId,
          file_path: file.path,
          storage_path: path,
          content_type: file.contentType ?? 'text/markdown',
          byte_size:
            typeof file.content === 'string'
              ? new TextEncoder().encode(file.content).byteLength
              : file.content.byteLength,
        });
      }

      if (pointers.length === 0) return;
      const result = await client
        .from('skill_raw_files')
        .upsert(pointers, { onConflict: 'skill_id,file_path' });
      throwOnError(result.error);
    },

    async getRawSkillFiles(skillId: string): Promise<Record<string, string>> {
      const result = await client
        .from('skill_raw_files')
        .select('file_path, storage_path')
        .eq('skill_id', skillId)
        .order('file_path');
      throwOnError(result.error);

      const files: Record<string, string> = {};
      for (const row of result.data ?? []) {
        const download = await client.storage
          .from(RAW_SKILLS_BUCKET)
          .download(String(row.storage_path));
        throwOnError(download.error);
        if (!download.data) throw new Error('Supabase repository returned no file data');
        files[String(row.file_path)] = await download.data.text();
      }
      return files;
    },
  };
}

export function createSupabaseRepositoryFromEnv(): ReturnType<typeof createSupabaseRepository> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the Supabase repository',
    );
  }

  return createSupabaseRepository(createClient<Database>(url, serviceRoleKey));
}

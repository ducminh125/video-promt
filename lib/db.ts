import { neon } from '@neondatabase/serverless';
import type { PromptSuggestion, SourceMedia, VideoSettings } from '@/types';

let schemaPromise: Promise<void> | null = null;

function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL');
  }
  return neon(connectionString);
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS video_history (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          prompt_options JSONB NOT NULL DEFAULT '[]'::jsonb,
          selected_prompt TEXT,
          source_media JSONB NOT NULL DEFAULT '[]'::jsonb,
          reference_images JSONB NOT NULL DEFAULT '[]'::jsonb,
          model_text TEXT NOT NULL DEFAULT 'gpt-5.4',
          model_video TEXT NOT NULL DEFAULT 'grok-video-3-10s',
          task_id TEXT,
          status TEXT NOT NULL DEFAULT 'PROMPTS_READY',
          progress TEXT,
          video_url TEXT,
          fail_reason TEXT,
          settings JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE video_history ALTER COLUMN model_video SET DEFAULT 'grok-video-3-10s'`;
      await sql`CREATE INDEX IF NOT EXISTS video_history_created_at_idx ON video_history (created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS video_history_task_id_idx ON video_history (task_id)`;
      await sql`
        CREATE TABLE IF NOT EXISTS image_history (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          production_prompt TEXT,
          reference_images JSONB NOT NULL DEFAULT '[]'::jsonb,
          image_url TEXT NOT NULL,
          ratio TEXT NOT NULL DEFAULT '16:9',
          model_image TEXT NOT NULL DEFAULT 'gpt-image-2-all',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS image_history_created_at_idx ON image_history (created_at DESC)`;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export async function createPromptHistory(input: {
  id: string;
  description: string;
  promptOptions: PromptSuggestion[];
  sourceMedia: SourceMedia[];
  referenceImages: string[];
}) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO video_history (
      id, description, prompt_options, source_media, reference_images, status
    ) VALUES (
      ${input.id},
      ${input.description},
      ${JSON.stringify(input.promptOptions)}::jsonb,
      ${JSON.stringify(input.sourceMedia)}::jsonb,
      ${JSON.stringify(input.referenceImages)}::jsonb,
      'PROMPTS_READY'
    )
    RETURNING *
  `;
  return rows[0];
}

export async function attachVideoTask(input: {
  historyId: string;
  prompt: string;
  taskId: string;
  settings: VideoSettings;
  modelVideo?: string;
}) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE video_history
    SET selected_prompt = ${input.prompt},
        task_id = ${input.taskId},
        status = 'queued',
        progress = '0%',
        settings = ${JSON.stringify(input.settings)}::jsonb,
        model_video = ${input.modelVideo || 'grok-video-3-10s'},
        fail_reason = NULL,
        updated_at = NOW()
    WHERE id = ${input.historyId}
    RETURNING *
  `;
  return rows[0];
}

export async function updateTaskStatus(input: {
  taskId: string;
  status: string;
  progress?: string | null;
  videoUrl?: string | null;
  failReason?: string | null;
}) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE video_history
    SET status = ${input.status},
        progress = ${input.progress ?? null},
        video_url = COALESCE(${input.videoUrl ?? null}, video_url),
        fail_reason = ${input.failReason ?? null},
        updated_at = NOW()
    WHERE task_id = ${input.taskId}
    RETURNING *
  `;
  return rows[0];
}

export async function listHistory(limit = 100) {
  await ensureSchema();
  const sql = getSql();
  return sql`
    SELECT * FROM video_history
    WHERE selected_prompt IS NOT NULL AND task_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function deleteHistory(id: string) {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM video_history WHERE id = ${id}`;
}
export async function getHistoryVideo(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, status, video_url
    FROM video_history
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createImageHistory(input: {
  id: string;
  description: string;
  productionPrompt?: string;
  referenceImages: string[];
  imageUrl: string;
  ratio: string;
  modelImage?: string;
}) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO image_history (
      id, description, production_prompt, reference_images, image_url, ratio, model_image
    ) VALUES (
      ${input.id},
      ${input.description},
      ${input.productionPrompt || null},
      ${JSON.stringify(input.referenceImages)}::jsonb,
      ${input.imageUrl},
      ${input.ratio},
      ${input.modelImage || 'gpt-image-2-all'}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function listImageHistory(limit = 100) {
  await ensureSchema();
  const sql = getSql();
  return sql`
    SELECT * FROM image_history
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function deleteImageHistory(id: string) {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM image_history WHERE id = ${id}`;
}


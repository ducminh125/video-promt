import { updateTaskStatus } from '@/lib/db';
import { shopAIKeyFetch } from '@/lib/shopaikey';

export const runtime = 'nodejs';
export const maxDuration = 30;

function text(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function normalizeStatus(value: unknown) {
  const raw = text(value).trim();
  const lower = raw.toLowerCase();
  if (['success', 'succeeded', 'completed', 'complete'].includes(lower)) return 'SUCCESS';
  if (['failure', 'failed', 'error', 'cancelled', 'canceled'].includes(lower)) return 'FAILURE';
  return raw || 'unknown';
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await context.params;
    const response = await shopAIKeyFetch(`/v1/video/generations/${encodeURIComponent(taskId)}`, {
      method: 'GET',
    });

    const raw = await response.text();
    if (!response.ok) {
      return Response.json({ error: `ShopAIKey status error (${response.status}): ${raw.slice(0, 500)}` }, { status: 502 });
    }

    let data: any;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return Response.json({ error: 'ShopAIKey status response is not valid JSON' }, { status: 502 });
    }

    const taskSource = data?.data ?? data ?? {};
    const task = Array.isArray(taskSource) ? (taskSource[0] || {}) : taskSource;
    const status = normalizeStatus(task.status || data?.status);
    const progress = text(task.progress) || null;
    const videoUrl =
      text(task.result_url) ||
      text(task.video_url) ||
      text(task.url) ||
      text(task.output?.video_url) ||
      text(task.output?.url) ||
      text(data?.video_url) ||
      null;
    const failReason = text(task.fail_reason) || text(task.error?.message) || text(task.error) || null;

    await updateTaskStatus({ taskId, status, progress, videoUrl, failReason });

    return Response.json({ taskId, status, progress, videoUrl, failReason });
  } catch (error) {
    console.error('status error', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 },
    );
  }
}

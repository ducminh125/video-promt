import { updateTaskStatus } from '@/lib/db';
import { shopAIKeyFetch } from '@/lib/shopaikey';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

    const data = JSON.parse(raw);
    const task = data?.data || {};
    const status = String(task.status || 'unknown');
    const progress = task.progress ? String(task.progress) : null;
    const videoUrl = task.result_url ? String(task.result_url) : null;
    const failReason = task.fail_reason ? String(task.fail_reason) : null;

    await updateTaskStatus({
      taskId,
      status,
      progress,
      videoUrl,
      failReason,
    });

    return Response.json({
      taskId,
      status,
      progress,
      videoUrl,
      failReason,
      raw: task,
    });
  } catch (error) {
    console.error('status error', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 },
    );
  }
}

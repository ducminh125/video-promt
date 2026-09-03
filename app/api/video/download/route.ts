import { getHistoryVideo } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function extensionFromContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('quicktime')) return 'mov';
  if (normalized.includes('x-matroska')) return 'mkv';
  return 'mp4';
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id')?.trim() || '';
    if (!id) return Response.json({ error: 'Thiếu mã lịch sử video.' }, { status: 400 });

    const item = await getHistoryVideo(id);
    const videoUrl = typeof item?.video_url === 'string' ? item.video_url.trim() : '';
    if (!videoUrl) return Response.json({ error: 'Video chưa sẵn sàng để tải xuống.' }, { status: 404 });

    const parsed = new URL(videoUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return Response.json({ error: 'URL video không hợp lệ.' }, { status: 400 });
    }

    const upstream = await fetch(parsed, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: { Accept: 'video/*,application/octet-stream;q=0.9,*/*;q=0.8' },
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { error: `Không thể tải file video từ máy chủ nguồn (${upstream.status}).` },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    const extension = extensionFromContentType(contentType);
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'video';
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="video-${safeId}.${extension}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    });
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error('video download error', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Tải video thất bại.' },
      { status: 500 },
    );
  }
}

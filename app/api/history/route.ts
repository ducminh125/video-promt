import { deleteHistory, deleteImageHistory, listHistory, listImageHistory } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [items, imageItems] = await Promise.all([listHistory(100), listImageHistory(100)]);
    return Response.json({ items, imageItems });
  } catch (error) {
    console.error('history list error', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not load history' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || '');
    const kind = String(body.kind || 'video');
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    if (kind === 'image') await deleteImageHistory(id);
    else await deleteHistory(id);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 },
    );
  }
}

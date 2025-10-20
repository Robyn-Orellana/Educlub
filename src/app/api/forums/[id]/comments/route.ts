import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/session';
import { addForumComment } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export async function POST(
  req: NextRequest,
  context: { params: Params }
) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const { id } = await context.params;
  const threadId = Number(id);
  if (!Number.isFinite(threadId)) {
    return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 });
  }
  try {
    const json = await req.json();
    const content = typeof json?.body === 'string' ? json.body.trim() : '';
    const parentId = json?.parent_id != null ? Number(json.parent_id) : null;
    type IncomingAttachment = { kind?: unknown; url?: unknown; title?: unknown };
    const attachments = Array.isArray(json?.attachments)
      ? (json.attachments as IncomingAttachment[])
          .map((a) => ({
            kind: (a?.kind === 'image' ? 'image' : 'link') as 'image' | 'link',
            url: String(a?.url || ''),
            title: a?.title == null ? null : String(a.title),
          }))
          .filter((a) => Boolean(a.url))
      : undefined;
    if (!content) {
      return NextResponse.json({ ok: false, error: 'Contenido requerido' }, { status: 400 });
    }
    const comment = await addForumComment(session.userId, threadId, content, parentId ?? null, attachments);
    return NextResponse.json({ ok: true, comment });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

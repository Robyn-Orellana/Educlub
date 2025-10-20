import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/session';
import { getForumThread, listForumComments } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export async function GET(
  _req: NextRequest,
  context: { params: Params }
) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const { id } = await context.params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 });
  }
  try {
    const thread = await getForumThread(idNum);
    if (!thread) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 });
    const comments = await listForumComments(idNum);
    return NextResponse.json({ ok: true, thread, comments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

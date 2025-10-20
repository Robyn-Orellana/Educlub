import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/session';
import { createForumThread, listForumThreads } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  try {
    const threads = await listForumThreads(100);
    return NextResponse.json({ ok: true, threads });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const content = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!title || !content) {
      return NextResponse.json({ ok: false, error: 'Título y contenido son requeridos' }, { status: 400 });
    }
    const created = await createForumThread(session.userId, title, content);
    return NextResponse.json({ ok: true, thread: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

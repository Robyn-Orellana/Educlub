import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getServerSession } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH: mark read/unread
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const markRead: boolean | undefined = typeof body.read === 'boolean' ? body.read : undefined;
    if (markRead === undefined) {
      return NextResponse.json({ ok: false, error: 'Campo "read" boolean requerido' }, { status: 400 });
    }
    await sql/* sql */`
      UPDATE notifications
      SET read_at = ${markRead ? new Date().toISOString() : null}::timestamptz
      WHERE id = ${id} AND user_id = ${session.userId};
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('/api/notifications/[id] PATCH error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

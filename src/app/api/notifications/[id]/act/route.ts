type NotificationRow = {
  id: number;
  type: string;
  payload_json: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { getServerSession } from '../../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 });
  }
  let body: { action?: 'accept' | 'deny' };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = body.action;
  if (action !== 'accept' && action !== 'deny') {
    return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 });
  }

  try {
    // Obtener notificación y asegurar pertenencia
    const rows = await sql<NotificationRow>`
      SELECT id, type, payload_json, read_at, created_at
      FROM notifications
      WHERE id = ${id} AND user_id = ${session.userId}
      LIMIT 1;
    `;
    const n = rows?.[0];
    if (!n) return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 });
    if (n.type !== 'session_scheduled') {
      return NextResponse.json({ ok: false, error: 'Tipo de notificación no accionable' }, { status: 400 });
    }
  const payload = (n.payload_json ?? {}) as Record<string, unknown>;
  const sessionId = Number(payload.session_id as number | string | undefined);
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ ok: false, error: 'Notificación sin session_id' }, { status: 400 });
    }

    if (action === 'accept') {
      // Marcar reserva del usuario como accepted/attending si existe; si no, crearla
      // Intentar actualizar si hay reserva
      const upd = await sql<{ id: number }>`
        UPDATE reservations
        SET status = 'reserved'
        WHERE session_id = ${sessionId} AND student_id = ${session.userId}
        RETURNING id;
      `;
      if (upd.length === 0) {
        // Crear
        await sql/* sql */`
          INSERT INTO reservations(session_id, student_id, status)
          VALUES (${sessionId}, ${session.userId}, 'reserved')
          ON CONFLICT (session_id, student_id) DO UPDATE SET status = EXCLUDED.status;
        `;
      }
      // Marcar notificación como leída
      await sql/* sql */`
        UPDATE notifications SET read_at = now()
        WHERE id = ${id} AND user_id = ${session.userId};
      `;
      return NextResponse.json({ ok: true, result: 'accepted' });
    } else {
      // deny: cancelar la reserva del usuario si existe
      await sql/* sql */`
        UPDATE reservations
        SET status = 'canceled'
        WHERE session_id = ${sessionId} AND student_id = ${session.userId};
      `;
      await sql/* sql */`
        UPDATE notifications SET read_at = now()
        WHERE id = ${id} AND user_id = ${session.userId};
      `;
      return NextResponse.json({ ok: true, result: 'denied' });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('/api/notifications/[id]/act POST error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

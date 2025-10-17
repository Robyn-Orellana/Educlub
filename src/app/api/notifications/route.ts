type NotificationRow = {
  id: number;
  type: string;
  payload_json: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { getServerSession } from '../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const onlyUnread = searchParams.get('unread') === '1';
    let rows: NotificationRow[];
    if (onlyUnread) {
      rows = await sql<NotificationRow>`
        SELECT id, type, payload_json, read_at, created_at
        FROM notifications
        WHERE user_id = ${session.userId}
          AND read_at IS NULL
        ORDER BY created_at DESC
        LIMIT 200;
      `;
    } else {
      rows = await sql<NotificationRow>`
        SELECT id, type, payload_json, read_at, created_at
        FROM notifications
        WHERE user_id = ${session.userId}
        ORDER BY (read_at IS NULL) DESC, created_at DESC
        LIMIT 200;
      `;
    }
    const unread = rows.filter((r) => !r.read_at).length;
    return NextResponse.json({ ok: true, notifications: rows, unread });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('/api/notifications GET error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

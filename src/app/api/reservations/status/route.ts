import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getServerSession } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = { session_id: number; status: 'reserved' | 'attended' | 'no_show' | 'canceled' };

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const idsRaw = (searchParams.get('session_ids') || '').trim();
  if (!idsRaw) return NextResponse.json({ ok: true, reservations: {} as Record<number, Row['status']> });
  const ids = Array.from(new Set(idsRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)))).slice(0, 200);
  if (ids.length === 0) return NextResponse.json({ ok: true, reservations: {} as Record<number, Row['status']> });
  try {
    const rows = await sql<Row>`
      SELECT session_id, status
      FROM reservations
      WHERE student_id = ${session.userId} AND session_id = ANY(${ids}::bigint[])
    `;
    const map: Record<number, Row['status']> = {};
    for (const r of rows) map[Number(r.session_id)] = r.status;
    return NextResponse.json({ ok: true, reservations: map });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('/api/reservations/status GET error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

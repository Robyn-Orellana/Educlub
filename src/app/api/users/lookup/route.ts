import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getServerSession } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UserLite = { id: number; name: string; email: string };

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const idsRaw = (searchParams.get('ids') || '').trim();
  if (!idsRaw) return NextResponse.json({ ok: true, users: [] as UserLite[] });
  const ids = Array.from(new Set(idsRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)))).slice(0, 50);
  if (ids.length === 0) return NextResponse.json({ ok: true, users: [] as UserLite[] });
  try {
    const rows = await sql<{ id: number; first_name: string; last_name: string; email: string }>`
      SELECT id, first_name, last_name, email FROM users WHERE id = ANY(${ids}::bigint[])
    `;
    const users: UserLite[] = rows.map((r) => ({ id: Number(r.id), name: `${r.first_name} ${r.last_name}`.trim(), email: r.email }));
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('/api/users/lookup GET error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

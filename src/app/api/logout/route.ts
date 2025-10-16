import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const sid = req.cookies.get('sid')?.value;

    if (sid) {
      // Revocar en DB (no fallar si hay error)
      try {
        await sql/* sql */`SELECT app_logout(${sid}::uuid);`;
      } catch (e) {
        console.error('Error app_logout:', e instanceof Error ? e.message : e);
      }
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set('sid', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('Error en /api/logout:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

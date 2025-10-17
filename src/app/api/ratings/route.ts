import { NextRequest, NextResponse } from 'next/server';
import { createOrUpdateRating, getUserRatingSummary, listRecentRatingsForUser } from '../../../lib/db';
import { getServerSession } from '../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get('user_id');
  const userId = userIdParam ? Number(userIdParam) : session.userId;
  if (!Number.isFinite(userId)) return NextResponse.json({ ok: false, error: 'user_id inválido' }, { status: 400 });

  const [summary, recent] = await Promise.all([
    getUserRatingSummary(userId),
    listRecentRatingsForUser(userId, 10),
  ]);
  return NextResponse.json({ ok: true, user_id: userId, summary, recent });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  // Ensure session contains a numeric userId
  const raterId = Number(session.userId);
  if (!Number.isFinite(raterId) || raterId <= 0) {
    console.error('/api/ratings POST: sesión inválida, session.userId=', session.userId);
    return NextResponse.json({ ok: false, error: 'Sesión inválida' }, { status: 401 });
  }

  type Body = { ratee_id: number; session_id?: number | null; reservation_id?: number | null; score: number; comment?: string | null };
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }

  const rateeId = Number(body.ratee_id);
  const sessionId = body.session_id == null ? null : Number(body.session_id);
  const reservationId = body.reservation_id == null ? null : Number(body.reservation_id);
  const score = Number(body.score);
  const comment = body.comment == null ? null : String(body.comment);

  // Validate inputs
  if (!Number.isFinite(rateeId) || rateeId <= 0) return NextResponse.json({ ok: false, error: 'ratee_id inválido' }, { status: 400 });
  if (!Number.isFinite(score) || score < 1 || score > 5) return NextResponse.json({ ok: false, error: 'score debe ser 1..5' }, { status: 400 });
  if (raterId === rateeId) return NextResponse.json({ ok: false, error: 'No puedes calificarte a ti mismo' }, { status: 400 });

  console.debug('/api/ratings POST payload:', { raterId, rateeId, sessionId, reservationId, score, comment });

  const rating = await createOrUpdateRating({ raterId, rateeId, sessionId, reservationId, score, comment });
  if (!rating) return NextResponse.json({ ok: false, error: 'No se pudo registrar la calificación' }, { status: 500 });

  return NextResponse.json({ ok: true, rating });
}

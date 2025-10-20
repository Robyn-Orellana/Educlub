import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/session';
import { getAllCourses, getEnrollmentsForUser, setEnrollmentsForUser } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: devuelve catálogo y cursos a los que el usuario está inscrito
export async function GET() {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const [all, mine] = await Promise.all([getAllCourses(), getEnrollmentsForUser(session.userId)]);
  return NextResponse.json({ ok: true, all, mine });
}

type PutBody = { courseIds?: unknown };

// PUT: reemplaza las inscripciones del usuario
export async function PUT(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida' }, { status: 400 });
  }
  const courseIds = Array.isArray(body.courseIds) ? (body.courseIds as number[]) : [];
  const mine = await setEnrollmentsForUser(session.userId, courseIds);
  return NextResponse.json({ ok: true, mine });
}

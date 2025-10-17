import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/session';
import { getAllCourses, getTutorCourses, setTutorCourses } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: devuelve cursos del usuario como tutor y el catálogo total
export async function GET() {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const [all, mine] = await Promise.all([getAllCourses(), getTutorCourses(session.userId)]);
  return NextResponse.json({ ok: true, all, mine });
}

// PUT: reemplaza lista de cursos que el usuario impartirá
type PutBody = { courseIds?: unknown };

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
  const mine = await setTutorCourses(session.userId, courseIds);
  return NextResponse.json({ ok: true, mine });
}

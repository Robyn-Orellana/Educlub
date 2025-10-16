import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

export const runtime = 'nodejs';

type RegisterBody = {
  role: 'student' | 'tutor';
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  enroll_course_ids?: number[]; // for students
  tutor_course_ids?: number[];  // for tutors
};

export async function POST(req: NextRequest) {
  let body: RegisterBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida' }, { status: 400 });
  }

  const role = (body.role || '').toString() as 'student' | 'tutor';
  const first_name = (body.first_name || '').toString().trim();
  const last_name = (body.last_name || '').toString().trim();
  const email = (body.email || '').toString().trim().toLowerCase();
  const password = (body.password || '').toString();
  const enroll_course_ids = Array.isArray(body.enroll_course_ids) ? body.enroll_course_ids : [];
  const tutor_course_ids = Array.isArray(body.tutor_course_ids) ? body.tutor_course_ids : [];

  if (!['student','tutor'].includes(role)) {
    return NextResponse.json({ ok: false, error: 'Rol inválido' }, { status: 400 });
  }
  if (!first_name || !last_name || !email || !password) {
    return NextResponse.json({ ok: false, error: 'Campos requeridos faltantes' }, { status: 400 });
  }

  try {
    const rows = await sql/* sql */`
      SELECT * FROM app_register_user(
        ${role}::text,
        ${first_name}::text,
        ${last_name}::text,
        ${email}::text,
        ${password}::text,
        ${enroll_course_ids}::bigint[],
        ${tutor_course_ids}::bigint[]
      );
    `;
    const r = rows?.[0];
    return NextResponse.json({ ok: true, user: r });
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('23505') || msg.includes('exists')) {
      return NextResponse.json({ ok: false, error: 'El correo ya existe' }, { status: 409 });
    }
    console.error('Error en /api/register:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const course_code = (searchParams.get('course_code') || '').trim();
    if (!course_code) {
      return NextResponse.json({ ok: false, error: 'course_code requerido' }, { status: 400 });
    }

    const ids = await sql<{ id: number }>`SELECT id FROM courses WHERE code = ${course_code} LIMIT 1;`;
    const courseId = ids?.[0]?.id;
    if (!courseId) {
      return NextResponse.json({ ok: false, error: 'Curso no encontrado' }, { status: 404 });
    }

    const tutors = await sql<{ id: number; first_name: string; last_name: string; email: string }>`
      SELECT u.id, u.first_name, u.last_name, u.email
      FROM tutor_courses tc
      JOIN users u ON u.id = tc.tutor_id
      WHERE tc.course_id = ${courseId}
      ORDER BY u.first_name, u.last_name;
    `;

    const students = await sql<{ id: number; first_name: string; last_name: string; email: string }>`
      SELECT u.id, u.first_name, u.last_name, u.email
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      WHERE e.course_id = ${courseId}
      ORDER BY u.first_name, u.last_name;
    `;

    const mapUser = (u: { id: number; first_name: string; last_name: string; email: string }) => ({
      id: Number(u.id),
      name: `${u.first_name} ${u.last_name}`.trim(),
      email: u.email,
    });

    return NextResponse.json({
      ok: true,
      course_id: Number(courseId),
      tutors: tutors.map(mapUser),
      students: students.map(mapUser),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/course-participants error:', message);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getServerSession } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RoleFilter = 'tutor' | 'student' | 'all';

type ApiUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: 'tutor' | 'student' | string;
  courses: Array<{ id: number; code: string; name: string }>;
  avg: number;
  total: number;
};

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const roleParam = (searchParams.get('role') || 'all').toLowerCase() as RoleFilter;

  const wantTutors = roleParam === 'all' || roleParam === 'tutor';
  const wantStudents = roleParam === 'all' || roleParam === 'student';

  const users: ApiUser[] = [];

  if (wantTutors) {
    type Row = { id: number; first_name: string; last_name: string; email: string; role: string; courses: Array<{ id: number; code: string; name: string }>; avg: number; total: number };
    let rows: Row[] = [];
    try {
      rows = await sql<Row>/* sql */`
        WITH base AS (
          SELECT u.id, u.first_name, u.last_name, u.email, 'tutor' AS role,
                 COALESCE(
                   json_agg(json_build_object('id', c.id, 'code', c.code, 'name', c.name))
                     FILTER (WHERE c.id IS NOT NULL), '[]'::json
                 ) AS courses
          FROM users u
          JOIN roles r ON r.id = u.role_id AND r.name = 'tutor'
          LEFT JOIN tutor_courses tc ON tc.tutor_id = u.id
          LEFT JOIN courses c ON c.id = tc.course_id
          GROUP BY u.id
        )
        SELECT b.id, b.first_name, b.last_name, b.email, b.role, b.courses,
               COALESCE(rs.avg_score, 0)::float AS avg,
               COALESCE(rs.total, 0)::int AS total
        FROM base b
        LEFT JOIN rating_summary rs ON rs.ratee_id = b.id
        ORDER BY b.last_name, b.first_name;
      `;
    } catch {
      // Fallback sin vista rating_summary
      rows = await sql<Row>/* sql */`
        SELECT b.id, b.first_name, b.last_name, b.email, b.role, b.courses,
               0::float AS avg, 0::int AS total
        FROM (
          SELECT u.id, u.first_name, u.last_name, u.email, 'tutor' AS role,
                 COALESCE(
                   json_agg(json_build_object('id', c.id, 'code', c.code, 'name', c.name))
                     FILTER (WHERE c.id IS NOT NULL), '[]'::json
                 ) AS courses
          FROM users u
          JOIN roles r ON r.id = u.role_id AND r.name = 'tutor'
          LEFT JOIN tutor_courses tc ON tc.tutor_id = u.id
          LEFT JOIN courses c ON c.id = tc.course_id
          GROUP BY u.id
        ) b
        ORDER BY b.last_name, b.first_name;
      `;
    }
    users.push(...rows.map((r) => ({ ...r, courses: Array.isArray(r.courses) ? r.courses : [] })));
  }

  if (wantStudents) {
    type Row = { id: number; first_name: string; last_name: string; email: string; role: string; courses: Array<{ id: number; code: string; name: string }>; avg: number; total: number };
    let rows: Row[] = [];
    try {
      rows = await sql<Row>/* sql */`
        WITH base AS (
          SELECT u.id, u.first_name, u.last_name, u.email, 'student' AS role,
                 COALESCE(
                   json_agg(json_build_object('id', c.id, 'code', c.code, 'name', c.name))
                     FILTER (WHERE c.id IS NOT NULL), '[]'::json
                 ) AS courses
          FROM users u
          JOIN roles r ON r.id = u.role_id AND r.name = 'student'
          LEFT JOIN enrollments e ON e.user_id = u.id
          LEFT JOIN courses c ON c.id = e.course_id
          GROUP BY u.id
        )
        SELECT b.id, b.first_name, b.last_name, b.email, b.role, b.courses,
               COALESCE(rs.avg_score, 0)::float AS avg,
               COALESCE(rs.total, 0)::int AS total
        FROM base b
        LEFT JOIN rating_summary rs ON rs.ratee_id = b.id
        ORDER BY b.last_name, b.first_name;
      `;
    } catch {
      rows = await sql<Row>/* sql */`
        SELECT b.id, b.first_name, b.last_name, b.email, b.role, b.courses,
               0::float AS avg, 0::int AS total
        FROM (
          SELECT u.id, u.first_name, u.last_name, u.email, 'student' AS role,
                 COALESCE(
                   json_agg(json_build_object('id', c.id, 'code', c.code, 'name', c.name))
                     FILTER (WHERE c.id IS NOT NULL), '[]'::json
                 ) AS courses
          FROM users u
          JOIN roles r ON r.id = u.role_id AND r.name = 'student'
          LEFT JOIN enrollments e ON e.user_id = u.id
          LEFT JOIN courses c ON c.id = e.course_id
          GROUP BY u.id
        ) b
        ORDER BY b.last_name, b.first_name;
      `;
    }
    users.push(...rows.map((r) => ({ ...r, courses: Array.isArray(r.courses) ? r.courses : [] })));
  }

  return NextResponse.json({ ok: true, users });
}

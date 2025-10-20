import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getServerSession } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }
    const userId = session.userId;

    // Params (curso, fechas, estado)
  const courseIdStr = searchParams.get('course_id');
  const course_id = courseIdStr && /^\d+$/.test(courseIdStr) ? Number(courseIdStr) : NaN;
    const fromRaw = (searchParams.get('from') || '').trim(); // yyyy-mm-dd
    const toRaw = (searchParams.get('to') || '').trim();
    const statusRaw = (searchParams.get('status') || '').trim();

    // Validación
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const from = dateRe.test(fromRaw) ? fromRaw : '';
    const to = dateRe.test(toRaw) ? toRaw : '';
  const allowedStatuses = new Set(['reserved', 'attended', 'no_show', 'canceled']);
  const status = statusRaw && allowedStatuses.has(statusRaw.toLowerCase()) ? statusRaw.toLowerCase() : '';
    
  // Parámetros opcionales (NULL para omitir filtro)
  const courseParam = Number.isFinite(course_id) ? course_id : null;
  const fromParam = from || null;
  const toParam = to || null;
  const statusParam = status || null;

    const rows = await sql/* sql */`
      WITH host AS (
        SELECT 
          s.id AS session_id,
          s.scheduled_at,
          s.duration_min,
          s.platform,
          s.status,
          c.code AS course_code,
          c.name AS course_name,
          (u_t.first_name || ' ' || u_t.last_name) AS tutor_name,
          (u_s.first_name || ' ' || u_s.last_name) AS student_name,
          COALESCE(s.meet_link, s.join_url) AS join_url
        FROM tutoring_sessions s
        JOIN courses c ON c.id = s.course_id
        LEFT JOIN users u_t ON u_t.id = s.tutor_id
        LEFT JOIN LATERAL (
          SELECT r.student_id FROM reservations r
          WHERE r.session_id = s.id AND r.status <> 'canceled'
          ORDER BY CASE WHEN r.status = 'reserved' THEN 0 ELSE 1 END, r.id
          LIMIT 1
        ) r1 ON TRUE
        LEFT JOIN users u_s ON u_s.id = r1.student_id
        WHERE s.tutor_id = ${userId}
          AND (${courseParam}::int IS NULL OR s.course_id = ${courseParam}::int)
          AND (${fromParam}::date IS NULL OR s.scheduled_at::date >= ${fromParam}::date)
          AND (${toParam}::date IS NULL OR s.scheduled_at::date <= ${toParam}::date)
          AND (${statusParam}::text IS NULL OR LOWER(s.status) = ${statusParam}::text)
      ),
      guest AS (
        SELECT 
          s.id AS session_id,
          s.scheduled_at,
          s.duration_min,
          s.platform,
          s.status,
          c.code AS course_code,
          c.name AS course_name,
          (u_t.first_name || ' ' || u_t.last_name) AS tutor_name,
          (u_me.first_name || ' ' || u_me.last_name) AS student_name,
          COALESCE(s.meet_link, s.join_url) AS join_url
        FROM tutoring_sessions s
        JOIN reservations r ON r.session_id = s.id AND r.student_id = ${userId} AND r.status <> 'canceled'
        JOIN courses c ON c.id = s.course_id
        LEFT JOIN users u_t ON u_t.id = s.tutor_id
        LEFT JOIN users u_me ON u_me.id = r.student_id
        WHERE 1=1
          AND (${courseParam}::int IS NULL OR s.course_id = ${courseParam}::int)
          AND (${fromParam}::date IS NULL OR s.scheduled_at::date >= ${fromParam}::date)
          AND (${toParam}::date IS NULL OR s.scheduled_at::date <= ${toParam}::date)
          AND (${statusParam}::text IS NULL OR LOWER(s.status) = ${statusParam}::text)
      )
      SELECT * FROM host
      UNION ALL
      SELECT * FROM guest
      ORDER BY scheduled_at DESC
      LIMIT 2000;
    `;

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/reports/sessions error:', message);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

import { neon } from '@neondatabase/serverless';

function getConnectionString() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.NEON_DB_URL || '';
}

function getSql() {
  const conn = getConnectionString();
  if (!conn) throw new Error('Database connection string not configured. Set DATABASE_URL or NEON_DATABASE_URL in environment.');
  return neon(conn);
}

export async function getUserByEmail(email: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url, u.status, u.created_at, r.name as role
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.email = ${email}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getFirstUser() {
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url, u.status, u.created_at, r.name as role
    FROM users u
    JOIN roles r ON r.id = u.role_id
    ORDER BY u.id ASC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getEnrollmentsForUser(userId: number) {
  const sql = getSql();
  const rows = await sql`
    SELECT c.id, c.code, c.name
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE e.user_id = ${userId}
    ORDER BY c.name
  `;
  return rows;
}

export async function getTutorAssignments(userId: number) {
  const sql = getSql();
  const rows = await sql`
    SELECT c.id, c.code, c.name
    FROM tutor_courses tc
    JOIN courses c ON c.id = tc.course_id
    WHERE tc.tutor_id = ${userId}
    ORDER BY c.name
  `;
  return rows;
}

export async function getCoursesOverview(): Promise<Course[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      c.code,
      c.name,
      c.description,
      u.first_name || ' ' || u.last_name AS tutor,
      COUNT(DISTINCT e.user_id) AS inscritos,
      COUNT(DISTINCT s.id) AS sesiones,
      ROUND(AVG(r.stars)::numeric,2) AS promedio_estrellas
    FROM courses c
    LEFT JOIN tutor_courses tc ON tc.course_id = c.id
    LEFT JOIN users u ON u.id = tc.tutor_id
    LEFT JOIN enrollments e ON e.course_id = c.id
    LEFT JOIN tutoring_sessions s ON s.course_id = c.id
    LEFT JOIN ratings r ON r.course_id = c.id
    GROUP BY c.id, tutor
    ORDER BY c.code
  `;
  return rows as Course[];
}

export type Course = {
  code: string;
  name: string;
  description?: string | null;
  tutor?: string | null;
  inscritos?: number | null;
  sesiones?: number | null;
  promedio_estrellas?: number | null;
};

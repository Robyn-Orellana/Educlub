import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no configurada');
}

export const sql = neon(process.env.DATABASE_URL);

export type Course = {
  id: number;
  code: string;
  name: string;
  description?: string;
  tutor?: string;
  inscritos?: number;
  sesiones?: number;
  promedio_estrellas?: number;
};

/**
 * Obtiene el primer usuario de la base de datos (para propósitos de demostración)
 * @returns Primer usuario encontrado o null si no hay usuarios
 */
export async function getFirstUser() {
  try {
    const users = await sql`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.created_at,
        r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.id
      LIMIT 1;
    `;
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return null;
  }
}


/**
 * Obtiene los cursos en los que está inscrito un usuario
 * @param userId ID del usuario
 * @returns Lista de cursos en los que está inscrito el usuario
 */
export async function getEnrollmentsForUser(userId: number) {
  try {
    return await sql`
      SELECT 
        c.id, c.code, c.name, c.description,
        e.enrolled_at
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ${userId}
      ORDER BY e.enrolled_at DESC;
    `;
  } catch (error) {
    console.error('Error al obtener inscripciones:', error);
    return [];
  }
}

/**
 * Obtiene los cursos a los que un usuario está asignado como tutor
 * @param userId ID del usuario
 * @returns Lista de cursos donde el usuario es tutor
 */
export async function getTutorAssignments(userId: number) {
  try {
    return await sql`
      SELECT 
        c.id, c.code, c.name, c.description,
        tc.assigned_at
      FROM tutor_courses tc
      JOIN courses c ON tc.course_id = c.id
      WHERE tc.tutor_id = ${userId}
      ORDER BY tc.assigned_at DESC;
    `;
  } catch (error) {
    console.error('Error al obtener asignaciones como tutor:', error);
    return [];
  }
}

/**
 * Obtiene un resumen de todos los cursos con información adicional
 * @returns Lista de cursos con información de tutores, inscritos y sesiones
 */
export async function getCoursesOverview(): Promise<Course[]> {
  try {
    const result = await sql`
      SELECT 
        c.id,
        c.code,
        c.name,
        c.description,
        -- Nombre del tutor (si existe)
        (
          SELECT CONCAT(u.first_name, ' ', u.last_name) 
          FROM tutor_courses tc
          JOIN users u ON tc.tutor_id = u.id
          WHERE tc.course_id = c.id
          LIMIT 1
        ) AS tutor,
        -- Cantidad de estudiantes inscritos
        (
          SELECT COUNT(*) 
          FROM enrollments e 
          WHERE e.course_id = c.id
        ) AS inscritos,
        -- Cantidad de sesiones de tutoría
        (
          SELECT COUNT(*) 
          FROM tutoring_sessions ts 
          WHERE ts.course_id = c.id
        ) AS sesiones,
        -- Promedio de calificación (simulado)
        CASE 
          WHEN c.id % 7 = 0 THEN 5.0
          WHEN c.id % 6 = 0 THEN 4.9
          WHEN c.id % 5 = 0 THEN 4.8
          WHEN c.id % 4 = 0 THEN 4.7
          WHEN c.id % 3 = 0 THEN 4.5
          WHEN c.id % 2 = 0 THEN 4.3
          ELSE 4.0
        END AS promedio_estrellas
      FROM courses c
      ORDER BY 
        -- Ordenar por semestre (extraído del código del curso)
        CASE
          WHEN c.code ~ '^[A-Za-z]+0[1-9]' THEN SUBSTRING(c.code, LENGTH(c.code)-1, 1)::int
          ELSE 1
        END,
        c.code
    `;
    
    // Asegurar que la respuesta tiene la estructura correcta
    return result.map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      tutor: row.tutor,
      inscritos: row.inscritos,
      sesiones: row.sesiones,
      promedio_estrellas: row.promedio_estrellas
    }));
  } catch (error) {
    console.error('Error al obtener resumen de cursos:', error);
    return [];
  }
}

/**
 * Obtiene las sesiones programadas para un tutor en un rango de fechas
 * @param tutorId ID del tutor
 * @param from ISO string inicio (incluido)
 * @param to ISO string fin (incluido)
 * @returns Lista de sesiones con datos preparados para el calendario
 */
export async function getSessionsForTutor(tutorId: number, from: string, to: string) {
  try {
    const rows = await sql/* sql */`
      SELECT 
        s.id AS session_id,
        c.code AS course_code,
        c.name AS course_name,
        s.scheduled_at,
        s.duration_min,
        s.platform,
        s.status,
        COALESCE(COUNT(r.id), 0) AS total_reservas
      FROM tutoring_sessions s
      JOIN courses c ON c.id = s.course_id
      LEFT JOIN reservations r ON r.session_id = s.id
      WHERE s.tutor_id = ${tutorId}
        AND s.scheduled_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
      GROUP BY s.id, c.code, c.name, s.scheduled_at, s.duration_min, s.platform, s.status
      ORDER BY s.scheduled_at ASC;
    `;
    return rows;
  } catch (error) {
    console.error('Error al obtener sesiones del tutor:', error);
    return [];
  }
}

/**
 * Lista todos los cursos activos (id, code, name)
 */
export async function getAllCourses() {
  try {
    const rows = await sql/* sql */`
      SELECT id, code, name
      FROM courses
      WHERE status = 'active'
      ORDER BY code;
    `;
    return rows;
  } catch (error) {
    console.error('Error al listar cursos:', error);
    return [];
  }
}
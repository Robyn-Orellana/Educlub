import { neon } from '@neondatabase/serverless';

type NeonTag = ReturnType<typeof neon>;
let _sql: NeonTag | null = null;

function getSqlClient(): NeonTag {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Defer error until actual query usage, not at import time
    throw new Error('DATABASE_URL no configurada');
  }
  _sql = neon(url);
  return _sql;
}

// Tagged template proxy with generic row typing
export function sql<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  const client = getSqlClient() as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<T[]>;
  return client(strings, ...values);
}

// Cache simple para existencia de columnas (evita chequear en cada llamada)
const _columnExistsCache = new Map<string, boolean>();

async function columnExists(table: string, column: string, schema = 'public'): Promise<boolean> {
  const key = `${schema}.${table}.${column}`;
  const cached = _columnExistsCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const rows = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = ${table} AND column_name = ${column}
      ) AS exists;
    `;
    const exists = rows?.[0]?.exists === true;
    _columnExistsCache.set(key, exists);
    return exists;
  } catch {
    // Si falla el chequeo, asumir que no existe para ser conservadores
    _columnExistsCache.set(key, false);
    return false;
  }
}

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

export type TutorSession = {
  session_id: number;
  course_code: string;
  course_name: string;
  scheduled_at: string;
  duration_min: number;
  platform: string;
  status: string;
  total_reservas: number;
};

/**
 * Obtiene el primer usuario de la base de datos (para propósitos de demostración)
 * @returns Primer usuario encontrado o null si no hay usuarios
 */
export async function getFirstUser() {
  try {
    type Row = { id: number; email: string; first_name: string; last_name: string; created_at: string; role: string };
    const users = await sql<Row>`
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
    type Row = { id: number; code: string; name: string; description: string | null; enrolled_at: string };
    return await sql<Row>`
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
    type Row = { id: number; code: string; name: string; description: string | null; assigned_at: string };
    return await sql<Row>`
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
    type Row = {
      id: number;
      code: string;
      name: string;
      description: string | null;
      tutor: string | null;
      inscritos: number;
      sesiones: number;
      promedio_estrellas: number;
    };
    const result = await sql<Row>`
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
    return result.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? undefined,
      tutor: row.tutor ?? undefined,
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
export async function getSessionsForTutor(tutorId: number, from: string, to: string): Promise<TutorSession[]> {
  try {
    const rows = await sql<TutorSession>/* sql */`
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
    return rows as TutorSession[];
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
    const rows = await sql<{ id: number; code: string; name: string }>`
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

// ===============
// Perfil de usuario
// ===============

export type UserProfile = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
};

export async function getUserProfile(userId: number): Promise<UserProfile | null> {
  try {
    const rows = await sql<UserProfile>`
      SELECT u.id::bigint as id, u.first_name, u.last_name, u.email, r.name AS role, u.avatar_url
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ${userId}
      LIMIT 1;
    `;
    return rows?.[0] ?? null;
  } catch (error) {
    console.error('Error al obtener perfil de usuario:', error);
    return null;
  }
}

export type UpdateUserProfileInput = {
  first_name?: string;
  last_name?: string;
  role?: 'student' | 'tutor';
  avatar_url?: string | null;
};

export async function updateUserProfile(userId: number, data: UpdateUserProfileInput): Promise<UserProfile | null> {
  try {
    // Actualizar nombre y avatar si vienen
    if (data.first_name !== undefined || data.last_name !== undefined || data.avatar_url !== undefined) {
      await sql/* sql */`
        UPDATE users
        SET
          first_name = COALESCE(${data.first_name}::text, first_name),
          last_name  = COALESCE(${data.last_name}::text, last_name),
          avatar_url = COALESCE(${data.avatar_url}::text, avatar_url)
        WHERE id = ${userId};
      `;
    }

    // Actualizar rol si viene y es válido (student|tutor)
    if (data.role) {
      const roleRow = await sql<{ id: number }>`SELECT id FROM roles WHERE name = ${data.role} LIMIT 1;`;
      const roleId = roleRow?.[0]?.id;
      if (roleId) {
        await sql/* sql */`
          UPDATE users SET role_id = ${roleId} WHERE id = ${userId};
        `;
      }
    }

    return await getUserProfile(userId);
  } catch (error) {
    console.error('Error al actualizar perfil de usuario:', error);
    return null;
  }
}

// ===============
// Cursos que imparte (tutor)
// ===============

export async function getTutorCourses(userId: number) {
  try {
    const rows = await sql<{ id: number; code: string; name: string }>`
      SELECT c.id, c.code, c.name
      FROM tutor_courses tc
      JOIN courses c ON c.id = tc.course_id
      WHERE tc.tutor_id = ${userId}
      ORDER BY c.code;
    `;
    return rows;
  } catch (error) {
    console.error('Error al listar cursos del tutor:', error);
    return [];
  }
}

export async function setTutorCourses(userId: number, courseIds: number[]) {
  try {
    // Normalizar a enteros únicos
    const ids = Array.from(new Set(courseIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))));

    // Limpiar todos y reinsertar (más simple y consistente)
    await sql/* sql */`
      DELETE FROM tutor_courses WHERE tutor_id = ${userId};
    `;

    // Inserción simple por id (compatible con interpolación)
    for (const cid of ids) {
      await sql/* sql */`
        INSERT INTO tutor_courses (tutor_id, course_id)
        VALUES (${userId}, ${cid})
        ON CONFLICT DO NOTHING;
      `;
    }

    return await getTutorCourses(userId);
  } catch (error) {
    console.error('Error al establecer cursos del tutor:', error);
    return [];
  }
}

// ===============
// Ratings (calificaciones)
// ===============

export type Rating = {
  id: number;
  rater_id: number;
  ratee_id: number;
  session_id: number | null;
  reservation_id?: number | null;
  score: number; // 1..5
  comment: string | null;
  created_at: string;
};

export async function createOrUpdateRating(params: { raterId: number; rateeId: number; sessionId?: number | null; reservationId?: number | null; score: number; comment?: string | null; }): Promise<Rating | null> {
  const { raterId, rateeId, sessionId = null, reservationId = null, score, comment = null } = params;
  try {
    // Validaciones básicas
    if (!Number.isFinite(raterId) || !Number.isFinite(rateeId)) throw new Error('Usuarios inválidos');
    if (raterId === rateeId) throw new Error('No puedes calificarte a ti mismo');
    if (!Number.isFinite(score) || score < 1 || score > 5) throw new Error('Puntaje inválido');

    // Soportar esquemas viejos donde aún no existe la columna reservation_id
    const hasReservationCol = await columnExists('ratings', 'reservation_id');
  const hasLegacyTutorCol = await columnExists('ratings', 'tutor_id');
  const hasLegacyStudentCol = await columnExists('ratings', 'student_id');
    const hasCourseCol = await columnExists('ratings', 'course_id');
    // Si existe en algún entorno, no la vamos a usar; la migración de limpieza la elimina.

    // 1) Intentar UPDATE existente (soporta session_id NULL)
    const updateRows = hasReservationCol
      ? await sql<Rating>`
          UPDATE ratings
          SET score = ${score}::int,
              comment = ${comment}::text,
              created_at = now(),
              reservation_id = ${reservationId}::bigint
              ${hasCourseCol ? sql`` : sql``}
          WHERE rater_id = ${raterId}::bigint
            AND ratee_id = ${rateeId}::bigint
            AND session_id IS NOT DISTINCT FROM ${sessionId}::bigint
          RETURNING id, rater_id, ratee_id, session_id, reservation_id, score, comment, created_at;
        `
      : await sql<Rating>`
          UPDATE ratings
          SET score = ${score}::int,
              comment = ${comment}::text,
              created_at = now()
          WHERE rater_id = ${raterId}::bigint
            AND ratee_id = ${rateeId}::bigint
            AND session_id IS NOT DISTINCT FROM ${sessionId}::bigint
          RETURNING id, rater_id, ratee_id, session_id,
                    NULL::bigint AS reservation_id,
                    score, comment, created_at;
        `;

    if (updateRows && updateRows.length > 0) {
      return updateRows[0];
    }

    // 2) Si no existe, INSERT según el esquema
    let insertRows: Rating[];
    if (hasReservationCol) {
      if (hasLegacyTutorCol && hasLegacyStudentCol) {
        insertRows = await sql<Rating>`
          INSERT INTO ratings (rater_id, ratee_id, session_id, reservation_id, score, comment, tutor_id, student_id)
          VALUES (${raterId}::bigint, ${rateeId}::bigint, ${sessionId}::bigint, ${reservationId}::bigint, ${score}::int, ${comment}::text, ${rateeId}::bigint, ${raterId}::bigint)
          RETURNING id, rater_id, ratee_id, session_id, reservation_id, score, comment, created_at;
        `;
      } else if (hasLegacyTutorCol) {
        insertRows = await sql<Rating>`
          INSERT INTO ratings (rater_id, ratee_id, session_id, reservation_id, score, comment, tutor_id)
          VALUES (${raterId}::bigint, ${rateeId}::bigint, ${sessionId}::bigint, ${reservationId}::bigint, ${score}::int, ${comment}::text, ${rateeId}::bigint)
          RETURNING id, rater_id, ratee_id, session_id, reservation_id, score, comment, created_at;
        `;
      } else if (hasLegacyStudentCol) {
        insertRows = await sql<Rating>`
          INSERT INTO ratings (rater_id, ratee_id, session_id, reservation_id, score, comment, student_id)
          VALUES (${raterId}::bigint, ${rateeId}::bigint, ${sessionId}::bigint, ${reservationId}::bigint, ${score}::int, ${comment}::text, ${raterId}::bigint)
          RETURNING id, rater_id, ratee_id, session_id, reservation_id, score, comment, created_at;
        `;
      } else {
        insertRows = await sql<Rating>`
          INSERT INTO ratings (rater_id, ratee_id, session_id, reservation_id, score, comment)
          VALUES (${raterId}::bigint, ${rateeId}::bigint, ${sessionId}::bigint, ${reservationId}::bigint, ${score}::int, ${comment}::text)
          RETURNING id, rater_id, ratee_id, session_id, reservation_id, score, comment, created_at;
        `;
      }
    } else {
      if (hasLegacyTutorCol && hasLegacyStudentCol) {
        insertRows = await sql<Rating>`
          INSERT INTO ratings (rater_id, ratee_id, session_id, score, comment, tutor_id, student_id)
          VALUES (${raterId}::bigint, ${rateeId}::bigint, ${sessionId}::bigint, ${score}::int, ${comment}::text, ${rateeId}::bigint, ${raterId}::bigint)
          RETURNING id, rater_id, ratee_id, session_id,
                    NULL::bigint AS reservation_id,
                    score, comment, created_at;
        `;
      } else if (hasLegacyTutorCol) {
        insertRows = await sql<Rating>`
          INSERT INTO ratings (rater_id, ratee_id, session_id, score, comment, tutor_id)
          VALUES (${raterId}::bigint, ${rateeId}::bigint, ${sessionId}::bigint, ${score}::int, ${comment}::text, ${rateeId}::bigint)
          RETURNING id, rater_id, ratee_id, session_id,
                    NULL::bigint AS reservation_id,
                    score, comment, created_at;
        `;
      } else if (hasLegacyStudentCol) {
        insertRows = await sql<Rating>`
          INSERT INTO ratings (rater_id, ratee_id, session_id, score, comment, student_id)
          VALUES (${raterId}::bigint, ${rateeId}::bigint, ${sessionId}::bigint, ${score}::int, ${comment}::text, ${raterId}::bigint)
          RETURNING id, rater_id, ratee_id, session_id,
                    NULL::bigint AS reservation_id,
                    score, comment, created_at;
        `;
      } else {
        insertRows = await sql<Rating>`
          INSERT INTO ratings (rater_id, ratee_id, session_id, score, comment)
          VALUES (${raterId}::bigint, ${rateeId}::bigint, ${sessionId}::bigint, ${score}::int, ${comment}::text)
          RETURNING id, rater_id, ratee_id, session_id,
                    NULL::bigint AS reservation_id,
                    score, comment, created_at;
        `;
      }
    }
    return insertRows?.[0] ?? null;
  } catch (error) {
    console.error('Error al crear/actualizar calificación:', error);
    return null;
  }
}

export async function getUserRatingSummary(userId: number): Promise<{ avg: number; total: number } | null> {
  try {
    const rows = await sql<{ avg: number; total: number }>`
      SELECT COALESCE(ROUND(AVG(score)::numeric, 2), 0)::float AS avg, COUNT(*)::int AS total
      FROM ratings
      WHERE ratee_id = ${userId};
    `;
    return rows?.[0] ?? { avg: 0, total: 0 };
  } catch (error) {
    console.error('Error al obtener resumen de calificaciones:', error);
    return null;
  }
}

export async function listRecentRatingsForUser(userId: number, limit = 10): Promise<Array<Rating & { rater_name: string }>> {
  try {
    type Row = Rating & { rater_name: string };
    const rows = await sql<Row>`
      SELECT r.id, r.rater_id, r.ratee_id, r.session_id, r.score, r.comment, r.created_at,
             (u.first_name || ' ' || u.last_name) AS rater_name
      FROM ratings r
      JOIN users u ON u.id = r.rater_id
      WHERE r.ratee_id = ${userId}
      ORDER BY r.created_at DESC
      LIMIT ${limit};
    `;
    return rows;
  } catch (error) {
    console.error('Error al listar calificaciones:', error);
    return [];
  }
}
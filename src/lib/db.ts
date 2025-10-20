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
  tutors?: string[];
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
      tutors: string[] | null;
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
        -- Lista completa de tutores del curso
        ARRAY(
          SELECT CONCAT(u.first_name, ' ', u.last_name)
          FROM tutor_courses tc
          JOIN users u ON tc.tutor_id = u.id
          WHERE tc.course_id = c.id
          ORDER BY u.last_name, u.first_name
        ) AS tutors,
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
      tutors: Array.isArray(row.tutors) ? row.tutors : [],
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

// Enrollments management (student courses)
export async function setEnrollmentsForUser(userId: number, courseIds: number[]) {
  try {
    const ids = Array.from(new Set(courseIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))));

    await sql/* sql */`
      DELETE FROM enrollments WHERE user_id = ${userId};
    `;

    for (const cid of ids) {
      await sql/* sql */`
        INSERT INTO enrollments (user_id, course_id)
        VALUES (${userId}, ${cid})
        ON CONFLICT DO NOTHING;
      `;
    }

    const rows = await sql<{ id: number; code: string; name: string }>`
      SELECT c.id, c.code, c.name
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ${userId}
      ORDER BY c.code;
    `;
    return rows;
  } catch (error) {
    console.error('Error al establecer inscripciones del usuario:', error);
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

// ===============
// Inicio/Dashboard: próximas sesiones del usuario
// ===============

export type UpcomingSession = {
  session_id: number;
  scheduled_at: string;
  duration_min: number;
  platform: string;
  join_url: string | null;
  course_code: string;
  course_name: string;
  role: 'host' | 'guest';
  partner_id: number | null;
  partner_name: string | null;
};

export async function listUpcomingSessionsForUser(userId: number, limit = 3): Promise<UpcomingSession[]> {
  try {
    const rows = await sql<UpcomingSession>/* sql */`
      WITH host AS (
        SELECT 
          s.id AS session_id,
          s.scheduled_at,
          s.duration_min,
          s.platform,
          COALESCE(s.meet_link, s.join_url) AS join_url,
          c.code AS course_code,
          c.name AS course_name,
          'host'::text AS role,
          r1.student_id AS partner_id,
          u1.first_name || ' ' || u1.last_name AS partner_name
        FROM tutoring_sessions s
        JOIN courses c ON c.id = s.course_id
        LEFT JOIN LATERAL (
          SELECT r.student_id FROM reservations r
          WHERE r.session_id = s.id AND r.status <> 'canceled'
          ORDER BY CASE WHEN r.status = 'reserved' THEN 0 ELSE 1 END, r.id
          LIMIT 1
        ) r1 ON TRUE
        LEFT JOIN users u1 ON u1.id = r1.student_id
        WHERE s.tutor_id = ${userId}
          AND s.scheduled_at >= now()
      ),
      guest AS (
        SELECT 
          s.id AS session_id,
          s.scheduled_at,
          s.duration_min,
          s.platform,
          COALESCE(s.meet_link, s.join_url) AS join_url,
          c.code AS course_code,
          c.name AS course_name,
          'guest'::text AS role,
          s.tutor_id AS partner_id,
          u2.first_name || ' ' || u2.last_name AS partner_name
        FROM tutoring_sessions s
        JOIN reservations r ON r.session_id = s.id AND r.student_id = ${userId} AND r.status <> 'canceled'
        JOIN courses c ON c.id = s.course_id
        LEFT JOIN users u2 ON u2.id = s.tutor_id
        WHERE s.scheduled_at >= now()
      )
      SELECT * FROM host
      UNION ALL
      SELECT * FROM guest
      ORDER BY scheduled_at ASC
      LIMIT ${limit};
    `;
    return rows;
  } catch (error) {
    console.error('Error al listar próximas sesiones del usuario:', error);
    return [];
  }
}

// ===============
// Foros (threads y comments)
// ===============

export type ForumThread = {
  id: number;
  author_id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  last_comment_at: string | null;
  comments_count: number;
  author_name: string;
  likes_count?: number;
  liked_by_me?: boolean;
  attachments?: ForumAttachment[];
};

export type ForumComment = {
  id: number;
  thread_id: number;
  author_id: number;
  parent_id: number | null;
  body: string;
  created_at: string;
  updated_at: string;
  author_name: string;
  likes_count?: number;
  liked_by_me?: boolean;
  attachments?: ForumAttachment[];
};

export type ForumAttachment = {
  id: number;
  thread_id: number | null;
  comment_id: number | null;
  author_id: number;
  kind: 'image' | 'link';
  url: string;
  title: string | null;
  created_at: string;
};

export async function listForumThreads(limit = 50): Promise<ForumThread[]> {
  try {
    const rows = await sql<ForumThread>`
      SELECT t.id,
             t.author_id,
             t.title,
             t.body,
             t.created_at,
             t.updated_at,
             t.last_comment_at,
             t.comments_count,
             (u.first_name || ' ' || u.last_name) AS author_name
      FROM forum_threads t
      JOIN users u ON u.id = t.author_id
      ORDER BY COALESCE(t.last_comment_at, t.created_at) DESC
      LIMIT ${limit};
    `;
    return rows;
  } catch (error) {
    console.error('Error al listar hilos del foro:', error);
    return [];
  }
}

export async function createForumThread(authorId: number, title: string, body: string, attachments?: Array<{ kind: 'image' | 'link'; url: string; title?: string | null }>): Promise<ForumThread | null> {
  try {
    const rows = await sql<ForumThread>`
      WITH ins AS (
        INSERT INTO forum_threads(author_id, title, body)
        VALUES (${authorId}::bigint, ${title}::text, ${body}::text)
        RETURNING id, author_id, title, body, created_at, updated_at, last_comment_at, comments_count
      )
      SELECT i.*, (u.first_name || ' ' || u.last_name) AS author_name
      FROM ins i
      JOIN users u ON u.id = i.author_id
      LIMIT 1;
    `;
    const thread = rows?.[0] ?? null;
    if (!thread) return null;
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const kind = att.kind === 'image' ? 'image' : 'link';
        const title = att.title ?? null;
        await sql/* sql */`
          INSERT INTO forum_attachments (thread_id, comment_id, author_id, kind, url, title)
          VALUES (${thread.id}::bigint, NULL, ${authorId}::bigint, ${kind}::text, ${att.url}::text, ${title}::text)
        `;
      }
    }
    return thread;
  } catch (error) {
    console.error('Error al crear hilo del foro:', error);
    return null;
  }
}

export async function getForumThread(threadId: number, viewerUserId?: number): Promise<ForumThread | null> {
  try {
    const rows = await sql<ForumThread>`
      SELECT t.id,
             t.author_id,
             t.title,
             t.body,
             t.created_at,
             t.updated_at,
             t.last_comment_at,
             t.comments_count,
             (u.first_name || ' ' || u.last_name) AS author_name,
             (SELECT COUNT(*)::int FROM forum_thread_likes l WHERE l.thread_id = t.id) AS likes_count,
             ((${viewerUserId ?? null}::bigint) IS NOT NULL AND EXISTS (
               SELECT 1 FROM forum_thread_likes l2 WHERE l2.thread_id = t.id AND l2.user_id = ${viewerUserId ?? null}::bigint
             )) AS liked_by_me
      FROM forum_threads t
      JOIN users u ON u.id = t.author_id
      WHERE t.id = ${threadId}
      LIMIT 1;
    `;
    const thread = rows?.[0] ?? null;
    if (!thread) return null;
    const atts = await sql<ForumAttachment>`
      SELECT id, thread_id, comment_id, author_id, kind, url, title, created_at
      FROM forum_attachments
      WHERE thread_id = ${threadId}
      ORDER BY created_at ASC;
    `;
    (thread as ForumThread).attachments = atts;
    return thread;
  } catch (error) {
    console.error('Error al obtener hilo del foro:', error);
    return null;
  }
}

export async function listForumComments(threadId: number, viewerUserId?: number): Promise<ForumComment[]> {
  try {
    const rows = await sql<ForumComment>`
      SELECT c.id, c.thread_id, c.author_id, c.parent_id, c.body, c.created_at, c.updated_at,
             (u.first_name || ' ' || u.last_name) AS author_name,
             (SELECT COUNT(*)::int FROM forum_comment_likes cl WHERE cl.comment_id = c.id) AS likes_count,
             ((${viewerUserId ?? null}::bigint) IS NOT NULL AND EXISTS (
               SELECT 1 FROM forum_comment_likes cl2 WHERE cl2.comment_id = c.id AND cl2.user_id = ${viewerUserId ?? null}::bigint
             )) AS liked_by_me
      FROM forum_comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.thread_id = ${threadId}
      ORDER BY c.created_at ASC;
    `;
    const comments = rows;
    if (comments.length > 0) {
      const ids = comments.map((c) => Number(c.id)).filter((n) => Number.isFinite(n));
      const attRows = ids.length > 0
        ? await sql<ForumAttachment>`
            SELECT id, thread_id, comment_id, author_id, kind, url, title, created_at
            FROM forum_attachments
            WHERE comment_id = ANY(${ids}::bigint[])
            ORDER BY created_at ASC;
          `
        : [];
      const byComment = new Map<number, ForumAttachment[]>();
      for (const att of attRows) {
        if (att.comment_id == null) continue;
        const arr = byComment.get(att.comment_id) ?? [];
        arr.push(att);
        byComment.set(att.comment_id, arr);
      }
      for (const c of comments) {
        (c as ForumComment).attachments = byComment.get(c.id) ?? [];
      }
    }
    return comments;
  } catch (error) {
    console.error('Error al listar comentarios del foro:', error);
    return [];
  }
}

export async function addForumComment(authorId: number, threadId: number, body: string, parentId?: number | null, attachments?: Array<{ kind: 'image' | 'link'; url: string; title?: string | null }>): Promise<ForumComment | null> {
  try {
    const rows = await sql<ForumComment>`
      WITH ins AS (
        INSERT INTO forum_comments(thread_id, author_id, parent_id, body)
        VALUES (${threadId}::bigint, ${authorId}::bigint, ${parentId ?? null}::bigint, ${body}::text)
        RETURNING id, thread_id, author_id, parent_id, body, created_at, updated_at
      ), upd AS (
        UPDATE forum_threads
           SET comments_count = comments_count + 1,
               last_comment_at = now(),
               updated_at = now()
         WHERE id = ${threadId}
        RETURNING id
      )
  SELECT i.*, (u.first_name || ' ' || u.last_name) AS author_name
      FROM ins i
      JOIN users u ON u.id = i.author_id
      LIMIT 1;
    `;
    const comment = rows?.[0] ?? null;
    if (!comment) return null;
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const kind = att.kind === 'image' ? 'image' : 'link';
        const title = att.title ?? null;
        await sql/* sql */`
          INSERT INTO forum_attachments (thread_id, comment_id, author_id, kind, url, title)
          VALUES (NULL, ${comment.id}::bigint, ${authorId}::bigint, ${kind}::text, ${att.url}::text, ${title}::text)
        `;
      }
    }
    return comment;
  } catch (error) {
    console.error('Error al agregar comentario de foro:', error);
    return null;
  }
}

export async function deleteForumCommentIfAuthor(userId: number, commentId: number): Promise<{ deleted: boolean; thread_id?: number }> {
  try {
    const rows = await sql<{ deleted: boolean; thread_id: number }>`
      WITH del AS (
        DELETE FROM forum_comments
         WHERE id = ${commentId}::bigint AND author_id = ${userId}::bigint
         RETURNING thread_id
      ), upd AS (
        UPDATE forum_threads t
           SET comments_count = GREATEST(t.comments_count - 1, 0)
          WHERE t.id IN (SELECT thread_id FROM del)
        RETURNING t.id
      )
      SELECT (SELECT COUNT(*) FROM del) > 0 AS deleted, (SELECT thread_id FROM del LIMIT 1) AS thread_id;
    `;
    return rows?.[0] ?? { deleted: false };
  } catch (error) {
    console.error('Error al eliminar comentario:', error);
    return { deleted: false };
  }
}

export async function toggleThreadLike(userId: number, threadId: number): Promise<{ liked: boolean; likes_count: number }> {
  try {
    const existed = await sql<{ exists: boolean }>`
      SELECT EXISTS(SELECT 1 FROM forum_thread_likes WHERE user_id = ${userId} AND thread_id = ${threadId}) AS exists;
    `;
    if (existed?.[0]?.exists) {
      await sql`DELETE FROM forum_thread_likes WHERE user_id = ${userId} AND thread_id = ${threadId};`;
    } else {
      await sql`INSERT INTO forum_thread_likes(user_id, thread_id) VALUES (${userId}, ${threadId}) ON CONFLICT DO NOTHING;`;
    }
    const countRows = await sql<{ c: number }>`SELECT COUNT(*)::int AS c FROM forum_thread_likes WHERE thread_id = ${threadId};`;
    return { liked: !existed?.[0]?.exists, likes_count: countRows?.[0]?.c ?? 0 };
  } catch (error) {
    console.error('Error al alternar like de hilo:', error);
    return { liked: false, likes_count: 0 };
  }
}

export async function toggleCommentLike(userId: number, commentId: number): Promise<{ liked: boolean; likes_count: number }> {
  try {
    const existed = await sql<{ exists: boolean }>`
      SELECT EXISTS(SELECT 1 FROM forum_comment_likes WHERE user_id = ${userId} AND comment_id = ${commentId}) AS exists;
    `;
    if (existed?.[0]?.exists) {
      await sql`DELETE FROM forum_comment_likes WHERE user_id = ${userId} AND comment_id = ${commentId};`;
    } else {
      await sql`INSERT INTO forum_comment_likes(user_id, comment_id) VALUES (${userId}, ${commentId}) ON CONFLICT DO NOTHING;`;
    }
    const countRows = await sql<{ c: number }>`SELECT COUNT(*)::int AS c FROM forum_comment_likes WHERE comment_id = ${commentId};`;
    return { liked: !existed?.[0]?.exists, likes_count: countRows?.[0]?.c ?? 0 };
  } catch (error) {
    console.error('Error al alternar like de comentario:', error);
    return { liked: false, likes_count: 0 };
  }
}

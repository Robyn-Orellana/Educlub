-- scheduling_functions.sql — Actualiza app_schedule_session para soportar estudiante↔estudiante
-- Ejecutar en PostgreSQL (Neon) en el mismo esquema donde existen users, roles, courses, tutoring_sessions, reservations, notifications

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Limpieza: eliminar variante ambigua de 8 parámetros si existiera en public
DROP FUNCTION IF EXISTS public.app_schedule_session(
  bigint, text, bigint, timestamptz, integer, text, text, boolean
);

-- Sobrescribe la función con nueva firma incluyendo _tutor_is_actor
-- Nota: Si deseas mantener compatibilidad, puedes conservar también la versión sin este parámetro.
CREATE OR REPLACE FUNCTION public.app_schedule_session(
  _actor_user_id        bigint,
  _course_code          text,
  _counterparty_user_id bigint,
  _scheduled_at         timestamptz,
  _duration_min         int,
  _platform             text,
  _join_url             text DEFAULT NULL,
  _create_reservation   boolean DEFAULT TRUE,
  _tutor_is_actor       boolean DEFAULT TRUE
) RETURNS TABLE(
  session_id     bigint,
  reservation_id bigint,
  tutor_id       bigint,
  student_id     bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor_role   text;
  v_counter_role text;
  v_course_id    bigint;
  v_tutor_id     bigint;
  v_student_id   bigint;
  v_session_id   bigint;
  v_res_id       bigint;
  v_join_url     text;
BEGIN
  -- 1) Roles del actor y contraparte
  SELECT r.name INTO v_actor_role
  FROM users u JOIN roles r ON r.id = u.role_id
  WHERE u.id = _actor_user_id;
  IF v_actor_role IS NULL THEN RAISE EXCEPTION 'Actor inválido'; END IF;

  SELECT r.name INTO v_counter_role
  FROM users u JOIN roles r ON r.id = u.role_id
  WHERE u.id = _counterparty_user_id;
  IF v_counter_role IS NULL THEN RAISE EXCEPTION 'Contraparte inválida'; END IF;

  -- 2) Curso
  SELECT id INTO v_course_id FROM courses WHERE code = _course_code;
  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'El curso % no existe', _course_code;
  END IF;

  -- 3) Determinar tutor y estudiante
  IF v_actor_role = 'tutor' AND v_counter_role = 'student' THEN
    v_tutor_id   := _actor_user_id;
    v_student_id := _counterparty_user_id;
  ELSIF v_actor_role = 'student' AND v_counter_role = 'tutor' THEN
    v_tutor_id   := _counterparty_user_id;
    v_student_id := _actor_user_id;
  ELSIF v_actor_role = 'student' AND v_counter_role = 'student' THEN
    -- Par estudiante↔estudiante: decidir quién actúa como tutor
    IF COALESCE(_tutor_is_actor, TRUE) THEN
      v_tutor_id   := _actor_user_id;
      v_student_id := _counterparty_user_id;
    ELSE
      v_tutor_id   := _counterparty_user_id;
      v_student_id := _actor_user_id;
    END IF;
  ELSIF v_actor_role = 'admin' THEN
    -- Admin: si contraparte es tutor, crear sin estudiante; si es estudiante => requiere tutor explícito
    IF v_counter_role = 'tutor' THEN
      v_tutor_id := _counterparty_user_id;
      v_student_id := NULL;
    ELSIF v_counter_role = 'student' THEN
      RAISE EXCEPTION 'Si actor es admin y contraparte es estudiante, especifica tutor válido como contraparte';
    ELSE
      RAISE EXCEPTION 'Admin: contraparte debe ser tutor (o crea sin contraparte y luego invita)';
    END IF;
  ELSE
    RAISE EXCEPTION 'Relación inválida: se espera tutor↔estudiante, admin o estudiante↔estudiante';
  END IF;

  -- 4) Reglas básicas
  IF _duration_min < 15 OR _duration_min > 240 THEN
    RAISE EXCEPTION 'Duración inválida (15..240)';
  END IF;
  IF _platform NOT IN ('meet','zoom','webrtc') THEN
    RAISE EXCEPTION 'Plataforma inválida';
  END IF;

  -- 5) Validaciones de curso
  -- Si el tutor es rol 'tutor', debe estar asignado al curso; si es estudiante (tutoría entre pares), no exigimos tutor_courses
  IF v_actor_role = 'tutor' OR v_counter_role = 'tutor' THEN
    IF NOT EXISTS (
      SELECT 1 FROM tutor_courses tc WHERE tc.tutor_id = v_tutor_id AND tc.course_id = v_course_id
    ) THEN
      -- Regla relajada: permitir aunque el tutor (rol tutor) no esté asignado al curso
      RAISE NOTICE 'El tutor % no está asignado al curso %, se permitirá de todos modos', v_tutor_id, _course_code;
    END IF;
  END IF;

  -- (Opcional) verificar matrícula del estudiante en el curso
  IF v_student_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM enrollments e WHERE e.user_id = v_student_id AND e.course_id = v_course_id
  ) THEN
    RAISE NOTICE 'El estudiante % no está matriculado en el curso %, se permitirá de todos modos', v_student_id, _course_code;
  END IF;

  -- 6) Generar join_url si no se envía
  v_join_url := COALESCE(_join_url, 'https://meet.example/' || gen_random_uuid());

  -- 7) Crear la sesión
  INSERT INTO tutoring_sessions(course_id, tutor_id, scheduled_at, duration_min, platform, join_url, status)
  VALUES (v_course_id, v_tutor_id, _scheduled_at, _duration_min, _platform, v_join_url, 'scheduled')
  RETURNING id INTO v_session_id;

  -- 8) (Opcional) Crear reserva del estudiante
  IF _create_reservation AND v_student_id IS NOT NULL THEN
    INSERT INTO reservations(session_id, student_id, status)
    VALUES (v_session_id, v_student_id, 'reserved')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_res_id;
  END IF;

  -- 9) Notificaciones: Solo notificar al invitado (estudiante) si existe
  IF v_student_id IS NOT NULL THEN
    INSERT INTO notifications(user_id, type, payload_json)
    VALUES
      (v_student_id, 'session_scheduled',
        jsonb_build_object(
          'session_id', v_session_id,
          'course_code', _course_code,
          'course_name', (SELECT name FROM courses WHERE id = v_course_id),
          'scheduled_at', _scheduled_at,
          'platform', _platform,
          'host_id', v_tutor_id,
          'guest_id', v_student_id
        ));
  END IF;

  -- 10) Retorno
  session_id     := v_session_id;
  reservation_id := v_res_id;
  tutor_id       := v_tutor_id;
  student_id     := v_student_id;
  RETURN;
END;
$$;

-- V2: función alternativa con semántica host/guest (actor_is_host)
-- No colisiona con la anterior; mantiene compatibilidad durante la transición

CREATE OR REPLACE FUNCTION public.app_schedule_session_v2(
  _actor_user_id        bigint,
  _course_code          text,
  _counterparty_user_id bigint,
  _scheduled_at         timestamptz,
  _duration_min         int,
  _platform             text,
  _join_url             text DEFAULT NULL,
  _create_reservation   boolean DEFAULT TRUE,
  _actor_is_host        boolean DEFAULT TRUE
) RETURNS TABLE(
  session_id     bigint,
  reservation_id bigint,
  host_id        bigint,
  guest_id       bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_course_id  bigint;
  v_host_id    bigint;
  v_guest_id   bigint;
  v_session_id bigint;
  v_res_id     bigint;
  v_join_url   text;
BEGIN
  SELECT id INTO v_course_id FROM courses WHERE code = _course_code;
  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'El curso % no existe', _course_code;
  END IF;

  IF _actor_is_host THEN
    v_host_id  := _actor_user_id;
    v_guest_id := _counterparty_user_id;
  ELSE
    v_host_id  := _counterparty_user_id;
    v_guest_id := _actor_user_id;
  END IF;

  IF v_host_id = v_guest_id THEN
    RAISE EXCEPTION 'Host e invitado no pueden ser la misma persona';
  END IF;

  IF _duration_min < 15 OR _duration_min > 240 THEN
    RAISE EXCEPTION 'Duración inválida (15..240)';
  END IF;

  IF _platform NOT IN ('meet','zoom','webrtc') THEN
    RAISE EXCEPTION 'Plataforma inválida (meet|zoom|webrtc)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tutor_courses WHERE tutor_id = v_host_id AND course_id = v_course_id) THEN
    RAISE NOTICE 'El host % no figura asignado al curso %, se permitirá de todos modos', v_host_id, _course_code;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM enrollments WHERE user_id = v_guest_id AND course_id = v_course_id) THEN
    RAISE NOTICE 'El invitado % no aparece matriculado en el curso %, se permitirá de todos modos', v_guest_id, _course_code;
  END IF;

  v_join_url := COALESCE(_join_url, 'https://meet.example/' || gen_random_uuid());

  INSERT INTO tutoring_sessions(course_id, tutor_id, scheduled_at, duration_min, platform, join_url, status)
  VALUES (v_course_id, v_host_id, _scheduled_at, _duration_min, _platform, v_join_url, 'scheduled')
  RETURNING id INTO v_session_id;

  IF _create_reservation THEN
    INSERT INTO reservations(session_id, student_id, status)
    VALUES (v_session_id, v_guest_id, 'reserved')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_res_id;
  END IF;

  -- Notificar solo al invitado, incluyendo host_id
  INSERT INTO notifications(user_id, type, payload_json) VALUES
    (v_guest_id, 'session_scheduled',
      jsonb_build_object(
        'session_id', v_session_id,
        'course_code', _course_code,
        'course_name', (SELECT name FROM courses WHERE id = v_course_id),
        'scheduled_at', _scheduled_at,
        'platform', _platform,
        'host_id', v_host_id,
        'guest_id', v_guest_id
      ));

  session_id     := v_session_id;
  reservation_id := v_res_id;
  host_id        := v_host_id;
  guest_id       := v_guest_id;
  RETURN;
END;
$$;

COMMIT;

-- auth_schema.sql — Esquema y funciones de autenticación para EduClub
-- Ejecutar en Neon (PostgreSQL 15+)

BEGIN;

-- Limpieza de funciones previas con firmas incompatibles
DROP FUNCTION IF EXISTS app_login(text, text, inet, text, integer);
DROP FUNCTION IF EXISTS app_logout(uuid);
DROP FUNCTION IF EXISTS app_validate_session(uuid);

-- 1) Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- para gen_random_uuid() y crypt()

-- 2) Tabla de sesiones
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip inet,
  user_agent text,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

-- 3) Función app_login: valida credenciales y crea sesión
-- Parámetros: email, password, ip, user-agent, ttl en minutos
-- Retorna: token (uuid), user_id, first_name, last_name, email, role, expires_at
CREATE OR REPLACE FUNCTION app_login(
  _email text,
  _password text,
  _ip inet,
  _ua text,
  _ttl_minutes integer
) RETURNS TABLE (
  token uuid,
  user_id bigint,
  first_name text,
  last_name text,
  email text,
  role text,
  expires_at timestamptz
) AS $$
DECLARE
  v_user RECORD;
  v_expires_at timestamptz;
  v_session_id uuid;
BEGIN
  -- Buscar usuario activo por email y verificar contraseña con bcrypt (pgcrypto)
  SELECT u.*, r.name AS role_name
    INTO v_user
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.email = _email
    AND u.status = 'active'
    AND crypt(_password, u.password_hash) = u.password_hash
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN; -- sin filas => credenciales inválidas
  END IF;

  v_expires_at := now() + make_interval(mins := _ttl_minutes);

  INSERT INTO auth_sessions(user_id, expires_at, ip, user_agent)
  VALUES (v_user.id, v_expires_at, _ip, _ua)
  RETURNING id INTO v_session_id;

  RETURN QUERY
  SELECT v_session_id,
         v_user.id::bigint,
         v_user.first_name,
         v_user.last_name,
         v_user.email,
         v_user.role_name,
         v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Función app_logout: revoca la sesión (soft-delete)
CREATE OR REPLACE FUNCTION app_logout(
  _token uuid
) RETURNS void AS $$
BEGIN
  UPDATE auth_sessions
     SET revoked_at = now()
   WHERE id = _token
     AND revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Función app_validate_session: valida y retorna datos del usuario
-- Retorna user_id, email, first_name, last_name, role, expires_at si válida
CREATE OR REPLACE FUNCTION app_validate_session(
  _token uuid
) RETURNS TABLE (
  user_id bigint,
  email text,
  first_name text,
  last_name text,
  role text,
  expires_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id::bigint,
         u.email,
         u.first_name,
         u.last_name,
         r.name AS role,
         s.expires_at
  FROM auth_sessions s
  JOIN users u ON u.id = s.user_id
  JOIN roles r ON r.id = u.role_id
  WHERE s.id = _token
    AND s.expires_at > now()
    AND s.revoked_at IS NULL
    AND u.status = 'active'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Registro de usuarios con asignación de cursos
-- Firma: app_register_user(role, first_name, last_name, email, password, enroll_course_ids, tutor_course_ids)
-- Nota: Solo permite roles 'student' o 'tutor' desde esta función pública
DROP FUNCTION IF EXISTS app_register_user(text, text, text, text, text, bigint[], bigint[]);

CREATE OR REPLACE FUNCTION app_register_user(
  _role text,
  _first_name text,
  _last_name text,
  _email text,
  _password text,
  _enroll_course_ids bigint[] DEFAULT ARRAY[]::bigint[],
  _tutor_course_ids bigint[] DEFAULT ARRAY[]::bigint[]
) RETURNS TABLE (
  user_id bigint,
  email text,
  role text,
  assigned_student int,
  assigned_tutor int
) AS $$
DECLARE
  v_role_id int;
  v_user_id bigint;
  v_assigned_student int := 0;
  v_assigned_tutor int := 0;
  v_email text := lower(trim(_email));
BEGIN
  IF _role NOT IN ('student','tutor') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  SELECT id INTO v_role_id FROM roles WHERE name = _role LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'role not found';
  END IF;

  -- verificar email único
  IF EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'email already exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO users(role_id, first_name, last_name, email, password_hash)
  VALUES (v_role_id, _first_name, _last_name, v_email, crypt(_password, gen_salt('bf')))
  RETURNING id INTO v_user_id;

  -- Inscribir como estudiante
  IF _enroll_course_ids IS NOT NULL AND array_length(_enroll_course_ids,1) IS NOT NULL THEN
    INSERT INTO enrollments(user_id, course_id)
    SELECT v_user_id, cid FROM unnest(_enroll_course_ids) AS cid
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_assigned_student = ROW_COUNT;
  END IF;

  -- Asignar como tutor
  IF _tutor_course_ids IS NOT NULL AND array_length(_tutor_course_ids,1) IS NOT NULL THEN
    INSERT INTO tutor_courses(tutor_id, course_id)
    SELECT v_user_id, cid FROM unnest(_tutor_course_ids) AS cid
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_assigned_tutor = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT v_user_id, v_email, _role, v_assigned_student, v_assigned_tutor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

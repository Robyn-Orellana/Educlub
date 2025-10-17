-- notifications_guards.sql — Evita que notificaciones de sesiones se inserten para usuarios no participantes
-- Aplica este script en tu base de datos (Neon/PostgreSQL) para asegurar que solo
-- el tutor (host) y el estudiante (guest/reservation) reciban notificaciones de tipo 'session_scheduled'.

BEGIN;

CREATE OR REPLACE FUNCTION public.notifications_validate_session_recipient()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id bigint;
  v_guest_id bigint;
  v_ok boolean := false;
BEGIN
  IF NEW.type = 'session_scheduled' THEN
    v_session_id := NULLIF(NEW.payload_json->>'session_id','')::bigint;
    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'notifications: session_scheduled sin session_id en payload';
    END IF;

    -- Tutor/host participante
    IF EXISTS (
      SELECT 1 FROM tutoring_sessions s
      WHERE s.id = v_session_id AND s.tutor_id = NEW.user_id
    ) THEN
      v_ok := true;
    END IF;

    -- Permitir notificar al invitado (guest) aunque aún no exista la reserva,
    -- validando contra el guest_id del payload
    IF NOT v_ok THEN
      v_guest_id := NULLIF(NEW.payload_json->>'guest_id','')::bigint;
      IF v_guest_id IS NOT NULL AND v_guest_id = NEW.user_id THEN
        v_ok := true;
      END IF;
    END IF;

    -- También permitir si existe una reserva (caso legado)
    IF NOT v_ok THEN
      IF EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.session_id = v_session_id AND r.student_id = NEW.user_id
      ) THEN
        v_ok := true;
      END IF;
    END IF;

    IF NOT v_ok THEN
      RAISE EXCEPTION 'notifications: user % no es participante de session %', NEW.user_id, v_session_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_validate ON notifications;
CREATE TRIGGER trg_notifications_validate
BEFORE INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION public.notifications_validate_session_recipient();

COMMIT;

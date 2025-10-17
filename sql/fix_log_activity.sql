-- Fix for generic log_activity trigger function that referenced columns
-- like NEW.tutor_id on tables that don't have them.
-- This version safely reads from NEW/OLD via JSONB to avoid runtime errors.

BEGIN;

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := to_jsonb(OLD);
  v_user_id bigint;
  v_entity_id bigint;
BEGIN
  -- Try to resolve a meaningful user_id from common column names, safely
  v_user_id := COALESCE(
    NULLIF(v_new->>'student_id', '')::bigint,
    NULLIF(v_new->>'tutor_id', '')::bigint,
    NULLIF(v_new->>'rater_id', '')::bigint,
    NULLIF(v_new->>'author_id', '')::bigint,
    NULLIF(v_new->>'user_id', '')::bigint,
    NULLIF(v_old->>'student_id', '')::bigint,
    NULLIF(v_old->>'tutor_id', '')::bigint,
    NULLIF(v_old->>'rater_id', '')::bigint,
    NULLIF(v_old->>'author_id', '')::bigint,
    NULLIF(v_old->>'user_id', '')::bigint
  );

  -- Resolve entity id from NEW/OLD.id when available
  v_entity_id := COALESCE(
    NULLIF(v_new->>'id', '')::bigint,
    NULLIF(v_old->>'id', '')::bigint
  );

  INSERT INTO activity_log(user_id, entity_type, entity_id, action)
  VALUES (v_user_id, TG_TABLE_NAME, v_entity_id, TG_OP);

  RETURN NEW;
END;
$$;

COMMIT;

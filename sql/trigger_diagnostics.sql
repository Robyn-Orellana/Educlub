-- Trigger diagnostics for tutor scheduling errors
-- Run these queries in your DB (Neon SQL editor or psql) to find triggers
-- that reference columns like tutor_id on tables that don't have them.

-- 1) Inspect columns for relevant tables
SELECT table_schema, table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('tutoring_sessions','reservations','notifications')
ORDER BY table_name, ordinal_position;

-- 2) List triggers on these tables
SELECT tg.tgname AS trigger_name,
       c.relname AS table_name,
       n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_triggerdef(tg.oid, true) AS trigger_def
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = tg.tgfoid
WHERE n.nspname = 'public'
  AND c.relname IN ('tutoring_sessions','reservations','notifications')
  AND NOT tg.tgisinternal
ORDER BY c.relname, tg.tgname;

-- 3) Show trigger function source code to check references like NEW.tutor_id
SELECT p.proname AS function_name,
       n.nspname AS schema_name,
       pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    SELECT DISTINCT p2.proname
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n2 ON n2.oid = c.relnamespace
    JOIN pg_proc p2 ON p2.oid = tg.tgfoid
    WHERE n2.nspname = 'public'
      AND c.relname IN ('tutoring_sessions','reservations','notifications')
      AND NOT tg.tgisinternal
  )
ORDER BY p.proname;

-- 4) Optional: disable an offending trigger (replace <trigger_name> and table)
-- ALTER TABLE public.reservations DISABLE TRIGGER <trigger_name>;
-- -- To re-enable later:
-- ALTER TABLE public.reservations ENABLE TRIGGER <trigger_name>;

-- 5) Optional: drop a buggy trigger function (replace schema and function name/signature)
-- DROP FUNCTION public.<function_name>(...);

-- After disabling/fixing triggers, try the scheduling flow again.

-- Accelerate authenticated progress updates while preserving API polling as a fallback.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = current_schema()
         AND tablename = 'analyses'
     ) THEN
    EXECUTE format(
      'ALTER PUBLICATION supabase_realtime ADD TABLE %I.analyses',
      current_schema()
    );
  END IF;
END;
$$;

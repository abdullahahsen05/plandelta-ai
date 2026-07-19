CREATE OR REPLACE FUNCTION "public"."validate_agentic_scope"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'knowledge_document_versions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "public"."knowledge_documents" d
      WHERE d.id = NEW.document_id AND d.project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Document version scope mismatch.' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'knowledge_chunks' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "public"."knowledge_document_versions" v
      JOIN "public"."knowledge_documents" d ON d.id = v.document_id
      WHERE v.id = NEW.document_version_id AND v.document_id = NEW.document_id
        AND v.project_id = NEW.project_id AND d.project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Knowledge chunk scope mismatch.' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'conversations' THEN
    IF NEW.analysis_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "public"."analyses" a
      WHERE a.id = NEW.analysis_id AND a.project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Conversation analysis scope mismatch.' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'agent_runs' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "public"."conversations" c
      JOIN "public"."messages" m ON m.id = NEW.user_message_id
      WHERE c.id = NEW.conversation_id AND c.project_id = NEW.project_id
        AND m.conversation_id = c.id AND m.role = 'user'
        AND (NEW.analysis_id IS NULL OR c.analysis_id = NEW.analysis_id)
    ) THEN
      RAISE EXCEPTION 'Agent run scope mismatch.' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'citations' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "public"."agent_runs" r
      JOIN "public"."messages" m ON m.id = NEW.message_id
      WHERE r.id = NEW.agent_run_id AND r.project_id = NEW.project_id
        AND m.conversation_id = r.conversation_id AND m.role = 'assistant'
    ) THEN
      RAISE EXCEPTION 'Citation message/run scope mismatch.' USING ERRCODE = '23514';
    END IF;

    IF NEW.citation_type = 'visual_change' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM "public"."detected_changes" c
        JOIN "public"."analyses" a ON a.id = c.analysis_id
        WHERE c.id = NEW.detected_change_id AND a.id = NEW.analysis_id
          AND a.project_id = NEW.project_id
      ) THEN
        RAISE EXCEPTION 'Visual citation scope mismatch.' USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.citation_type = 'document_chunk' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM "public"."knowledge_chunks" c
        JOIN "public"."knowledge_document_versions" v ON v.id = c.document_version_id
        WHERE c.id = NEW.knowledge_chunk_id AND c.document_id = NEW.knowledge_document_id
          AND c.project_id = NEW.project_id AND v.id = NEW.knowledge_version_id
          AND (
            v.is_active
            OR coalesce(
              (NEW.retrieval_metadata ->> 'conflictingOlderRevision')::boolean,
              false
            )
          )
      ) THEN
        RAISE EXCEPTION 'Document citation scope mismatch.' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

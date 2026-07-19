CREATE OR REPLACE FUNCTION "public"."hybrid_search_knowledge_v2"(
  p_project_id UUID,
  p_query_text TEXT,
  p_query_embedding "extensions"."vector"(384),
  p_limit INTEGER DEFAULT 12,
  p_document_types TEXT[] DEFAULT NULL,
  p_effective_at DATE DEFAULT NULL,
  p_revision_labels TEXT[] DEFAULT NULL,
  p_page_numbers INTEGER[] DEFAULT NULL,
  p_section_query TEXT DEFAULT NULL,
  p_include_inactive_conflicts BOOLEAN DEFAULT FALSE,
  p_text_weight REAL DEFAULT 0.45,
  p_vector_weight REAL DEFAULT 0.55
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  document_version_id UUID,
  filename TEXT,
  document_type TEXT,
  page_number INTEGER,
  section_title TEXT,
  excerpt TEXT,
  revision_label TEXT,
  effective_date DATE,
  checksum_sha256 TEXT,
  is_active BOOLEAN,
  is_conflicting BOOLEAN,
  text_score REAL,
  vector_score REAL,
  combined_score REAL,
  conflict_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 24 THEN
    RAISE EXCEPTION 'Result limit must be between 1 and 24.' USING ERRCODE = '22023';
  END IF;
  IF p_query_embedding IS NULL OR length(btrim(p_query_text)) = 0 THEN
    RAISE EXCEPTION 'Text and embedding queries are required.' USING ERRCODE = '22023';
  END IF;
  IF p_text_weight < 0 OR p_vector_weight < 0
     OR abs((p_text_weight + p_vector_weight) - 1.0) > 0.001 THEN
    RAISE EXCEPTION 'Hybrid weights must be non-negative and total 1.' USING ERRCODE = '22023';
  END IF;
  IF p_page_numbers IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM unnest(p_page_numbers) AS requested(page_value)
       WHERE requested.page_value < 1
     ) THEN
    RAISE EXCEPTION 'Page filters must be positive.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      c.id,
      c.document_id,
      c.document_version_id,
      d.original_filename,
      d.document_type::TEXT AS source_document_type,
      c.page_number,
      c.section_title,
      c.excerpt,
      v.revision_label,
      v.effective_date,
      v.checksum_sha256,
      (c.is_active AND v.is_active) AS source_is_active,
      c.conflict_key,
      least(
        1.0,
        ts_rank_cd(c.search_vector, websearch_to_tsquery('english', left(p_query_text, 1000))) * 4
      )::REAL AS lexical,
      greatest(0.0, least(1.0, 1 - (c.embedding <=> p_query_embedding)))::REAL AS semantic
    FROM "public"."knowledge_chunks" c
    JOIN "public"."knowledge_document_versions" v ON v.id = c.document_version_id
    JOIN "public"."knowledge_documents" d ON d.id = c.document_id
    WHERE c.project_id = p_project_id
      AND c.embedding IS NOT NULL
      AND v.status = 'ready'
      AND d.status = 'ready'
      AND d.deleted_at IS NULL
      AND (
        (c.is_active AND v.is_active)
        OR (p_include_inactive_conflicts AND NOT (c.is_active AND v.is_active))
      )
      AND (p_document_types IS NULL OR d.document_type::TEXT = ANY(p_document_types))
      AND (p_effective_at IS NULL OR v.effective_date IS NULL OR v.effective_date <= p_effective_at)
      AND (p_revision_labels IS NULL OR v.revision_label = ANY(p_revision_labels))
      AND (p_page_numbers IS NULL OR c.page_number = ANY(p_page_numbers))
      AND (
        p_section_query IS NULL
        OR c.section_title ILIKE '%' || left(p_section_query, 120) || '%'
      )
  ),
  scored AS (
    SELECT
      candidates.*,
      count(*) OVER (
        PARTITION BY coalesce(candidates.conflict_key, candidates.id::TEXT)
      )::INTEGER AS conflicts
    FROM candidates
    WHERE
      candidates.lexical > 0
      OR candidates.semantic >= 0.2
  )
  SELECT
    s.id,
    s.document_id,
    s.document_version_id,
    s.original_filename,
    s.source_document_type,
    s.page_number,
    s.section_title,
    s.excerpt,
    s.revision_label,
    s.effective_date,
    s.checksum_sha256,
    s.source_is_active,
    (s.conflicts > 1 OR NOT s.source_is_active),
    s.lexical,
    s.semantic,
    (s.lexical * p_text_weight + s.semantic * p_vector_weight)::REAL,
    s.conflicts
  FROM scored s
  ORDER BY
    (s.lexical * p_text_weight + s.semantic * p_vector_weight) DESC,
    s.source_is_active DESC,
    s.effective_date DESC NULLS LAST,
    s.id
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION "public"."hybrid_search_knowledge_v2"(
  UUID, TEXT, "extensions"."vector", INTEGER, TEXT[], DATE, TEXT[], INTEGER[], TEXT, BOOLEAN,
  REAL, REAL
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."hybrid_search_knowledge_v2"(
  UUID, TEXT, "extensions"."vector", INTEGER, TEXT[], DATE, TEXT[], INTEGER[], TEXT, BOOLEAN,
  REAL, REAL
) TO service_role, postgres;

COMMENT ON FUNCTION "public"."hybrid_search_knowledge_v2"(
  UUID, TEXT, "extensions"."vector", INTEGER, TEXT[], DATE, TEXT[], INTEGER[], TEXT, BOOLEAN,
  REAL, REAL
) IS
  'Project-scoped hybrid retrieval with bounded citation metadata filters and explicit inactive-conflict opt-in.';

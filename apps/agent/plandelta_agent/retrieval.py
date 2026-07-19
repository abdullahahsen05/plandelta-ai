from __future__ import annotations

from datetime import date
from uuid import UUID

from plandelta_agent.ingestion.repository import KnowledgeRepository, RetrievedKnowledge
from plandelta_agent.providers.embeddings import EmbeddingProvider

DOCUMENT_TYPES = {
    "specification",
    "drawing_notes",
    "revision_narrative",
    "addendum",
    "boq_schedule",
    "rfi",
    "prior_report",
    "technical_note",
}


class HybridKnowledgeRetriever:
    def __init__(
        self,
        *,
        repository: KnowledgeRepository,
        embeddings: EmbeddingProvider,
        text_weight: float = 0.45,
        vector_weight: float = 0.55,
        max_results: int = 12,
    ) -> None:
        if abs(text_weight + vector_weight - 1) > 0.001:
            raise ValueError("Hybrid search weights must total one.")
        if text_weight < 0 or vector_weight < 0:
            raise ValueError("Hybrid search weights cannot be negative.")
        if not 1 <= max_results <= 12:
            raise ValueError("Hybrid result limit is outside the supported range.")
        self._repository = repository
        self._embeddings = embeddings
        self._text_weight = text_weight
        self._vector_weight = vector_weight
        self._max_results = max_results

    async def search(
        self,
        *,
        project_id: UUID,
        query: str,
        limit: int = 8,
        document_types: list[str] | None = None,
        effective_at: date | None = None,
        revision_labels: list[str] | None = None,
        page_numbers: list[int] | None = None,
        section_query: str | None = None,
        include_inactive_conflicts: bool = False,
    ) -> list[RetrievedKnowledge]:
        normalized_query = " ".join(query.split())
        if not normalized_query or len(normalized_query) > 1000:
            raise ValueError("The hybrid query must contain between 1 and 1000 characters.")
        if not 1 <= limit <= self._max_results:
            raise ValueError("The requested result count exceeds the configured limit.")
        if document_types is not None and (
            not document_types or any(value not in DOCUMENT_TYPES for value in document_types)
        ):
            raise ValueError("A knowledge document filter is invalid.")
        if revision_labels is not None and (
            not revision_labels
            or any(not value.strip() or len(value) > 120 for value in revision_labels)
        ):
            raise ValueError("A revision label filter is invalid.")
        if page_numbers is not None and (
            not page_numbers or len(page_numbers) > 20 or any(page < 1 for page in page_numbers)
        ):
            raise ValueError("A page filter is invalid.")
        normalized_section = " ".join(section_query.split()) if section_query else None
        if normalized_section is not None and (
            not normalized_section or len(normalized_section) > 120
        ):
            raise ValueError("A section filter is invalid.")
        if include_inactive_conflicts and revision_labels is None:
            raise ValueError("Inactive conflict retrieval requires an explicit revision filter.")
        embedding = await self._embeddings.embed([normalized_query])
        return await self._repository.hybrid_search(
            project_id=project_id,
            query_text=normalized_query,
            query_embedding=embedding.vectors[0].values,
            limit=limit,
            document_types=document_types,
            effective_at=effective_at,
            revision_labels=revision_labels,
            page_numbers=page_numbers,
            section_query=normalized_section,
            include_inactive_conflicts=include_inactive_conflicts,
            text_weight=self._text_weight,
            vector_weight=self._vector_weight,
        )

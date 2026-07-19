ALTER TABLE "knowledge_document_versions"
  ADD COLUMN "detected_mime_type" TEXT,
  ADD COLUMN "byte_size" BIGINT,
  ADD COLUMN "storage_provider" "StorageProvider",
  ADD COLUMN "storage_key" TEXT;

UPDATE "knowledge_document_versions" v
SET
  "detected_mime_type" = d."detected_mime_type",
  "byte_size" = d."byte_size",
  "storage_provider" = d."storage_provider",
  "storage_key" = d."storage_key"
FROM "knowledge_documents" d
WHERE d.id = v."document_id";

ALTER TABLE "knowledge_document_versions"
  ALTER COLUMN "detected_mime_type" SET NOT NULL,
  ALTER COLUMN "byte_size" SET NOT NULL,
  ALTER COLUMN "storage_provider" SET NOT NULL,
  ALTER COLUMN "storage_key" SET NOT NULL,
  ADD CONSTRAINT "knowledge_versions_byte_size_positive" CHECK ("byte_size" > 0),
  ADD CONSTRAINT "knowledge_versions_mime_supported" CHECK (
    "detected_mime_type" IN ('application/pdf', 'text/plain')
  );

CREATE UNIQUE INDEX "knowledge_versions_storage_key_unique"
ON "knowledge_document_versions"("storage_provider", "storage_key");

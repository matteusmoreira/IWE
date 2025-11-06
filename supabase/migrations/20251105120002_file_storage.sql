-- Copiado de database/migrations/002_file_storage.sql (corrigido)
-- Suporte a Storage e rastreamento de uploads

-- Create storage bucket for form submissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-submissions', 'form-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies para o bucket serão criadas após a tabela file_uploads

-- Add file_uploads table to track uploaded files
CREATE TABLE IF NOT EXISTS file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_file_uploads_submission ON file_uploads(submission_id);
CREATE INDEX idx_file_uploads_tenant ON file_uploads(tenant_id);

-- RLS policies for file_uploads
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Allow users to read files from their tenant
CREATE POLICY "Users can read their tenant file uploads"
ON file_uploads FOR SELECT
TO authenticated
USING (public.is_admin_of_tenant(tenant_id));

-- Allow users to insert files for their tenant
CREATE POLICY "Users can insert file uploads"
ON file_uploads FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_of_tenant(tenant_id));

-- Allow users to delete files from their tenant
CREATE POLICY "Users can delete their tenant file uploads"
ON file_uploads FOR DELETE
TO authenticated
USING (public.is_admin_of_tenant(tenant_id));

-- Function to get file URL
CREATE OR REPLACE FUNCTION get_file_url(storage_path TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN '/storage/v1/object/authenticated/form-submissions/' || storage_path;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE file_uploads IS 'Tracks files uploaded through form submissions';
COMMENT ON FUNCTION get_file_url IS 'Generates authenticated URL for file access';

-- Agora criar as políticas do bucket com dependência de public.file_uploads
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'form-submissions'
);

CREATE POLICY "Users can read their tenant files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'form-submissions'
  AND EXISTS (
    SELECT 1 FROM public.file_uploads fu
    WHERE fu.storage_path = storage.objects.name
      AND public.is_admin_of_tenant(fu.tenant_id)
  )
);

CREATE POLICY "Users can delete their tenant files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'form-submissions'
  AND EXISTS (
    SELECT 1 FROM public.file_uploads fu
    WHERE fu.storage_path = storage.objects.name
      AND public.is_admin_of_tenant(fu.tenant_id)
  )
);
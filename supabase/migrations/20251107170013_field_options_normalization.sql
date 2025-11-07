-- ============================================
-- Migration: field_options_normalization_to_objects
-- Objetivo: Converter arrays de opções salvos como strings para objetos
--           { label, value }, garantindo padronização no banco.
-- 
-- Escopo: Tabela form_fields, tipos select/radio/checkbox.
-- ============================================

BEGIN;

-- Extensão para remover acentos (melhora geração de slugs)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Função auxiliar para gerar "value" a partir do label
CREATE OR REPLACE FUNCTION public.slugify_label(input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  txt text;
BEGIN
  txt := lower(trim(both '_' from regexp_replace(unaccent(coalesce(input,'')), '[^a-z0-9]+', '_', 'g')));
  IF txt = '' THEN
    -- Fallback seguro quando o label está vazio
    txt := 'option_' || floor(extract(epoch from now())*1000)::bigint;
  END IF;
  RETURN txt;
END;
$$;

-- Atualiza registros onde options contém strings ou objetos incompletos
WITH to_update AS (
  SELECT id, options
  FROM form_fields
  WHERE type IN ('select','radio','checkbox')
    AND options IS NOT NULL
    AND jsonb_typeof(options) = 'array'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(options) e
      WHERE jsonb_typeof(e) = 'string'
         OR (jsonb_typeof(e) = 'object' AND (NOT (e ? 'label') OR NOT (e ? 'value')))
    )
)
UPDATE form_fields f
SET options = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(elem) = 'string' THEN
        jsonb_build_object(
          'label', trim(both '"' from elem::text),
          'value', slugify_label(trim(both '"' from elem::text))
        )
      WHEN jsonb_typeof(elem) = 'object' THEN
        CASE
          WHEN (NOT elem ? 'label') AND (elem ? 'value') THEN
            jsonb_build_object('label', elem->>'value', 'value', slugify_label(elem->>'value'))
          WHEN (elem ? 'label') AND (NOT elem ? 'value') THEN
            jsonb_set(elem, '{value}', to_jsonb(slugify_label(elem->>'label')), true)
          ELSE
            elem
        END
      ELSE
        jsonb_build_object('label', trim(both '"' from elem::text), 'value', slugify_label(trim(both '"' from elem::text)))
    END
  )
  FROM jsonb_array_elements(f.options) AS elem
)
WHERE f.id IN (SELECT id FROM to_update);

-- Garantia: options nunca nulo
UPDATE form_fields
SET options = '[]'::jsonb
WHERE options IS NULL;

COMMENT ON FUNCTION public.slugify_label(text) IS 'Normaliza textos em slugs para campo value de opções.';

COMMIT;

-- ============================================
-- Consultas de verificação (opcional, para execução local)
-- SELECT id, type, options FROM form_fields WHERE type IN ('select','radio','checkbox') LIMIT 10;
-- SELECT count(*) FROM form_fields WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(options) e WHERE jsonb_typeof(e) = 'string');
-- ============================================
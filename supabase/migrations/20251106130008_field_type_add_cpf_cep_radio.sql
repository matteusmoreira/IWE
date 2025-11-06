-- Migration: Add new values to enum field_type
-- Context: Frontend suporta tipos 'radio', 'cpf' e 'cep'. O enum atual não inclui estes valores,
-- causando erro "invalid input value for enum field_type" ao criar campos.
-- Segue adição segura e reversível.

BEGIN;

-- Adiciona 'radio' ao enum field_type, se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'field_type' AND e.enumlabel = 'radio'
  ) THEN
    ALTER TYPE field_type ADD VALUE 'radio';
  END IF;
END$$;

-- Adiciona 'cpf' ao enum field_type, se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'field_type' AND e.enumlabel = 'cpf'
  ) THEN
    ALTER TYPE field_type ADD VALUE 'cpf';
  END IF;
END$$;

-- Adiciona 'cep' ao enum field_type, se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'field_type' AND e.enumlabel = 'cep'
  ) THEN
    ALTER TYPE field_type ADD VALUE 'cep';
  END IF;
END$$;

COMMIT;
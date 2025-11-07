-- Adiciona o novo tipo de campo 'accept' ao enum field_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'field_type' AND e.enumlabel = 'accept'
  ) THEN
    ALTER TYPE field_type ADD VALUE 'accept';
  END IF;
END$$;

-- Comentário: Campo de aceite (checkbox único com texto configurável)
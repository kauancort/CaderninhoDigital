-- Registra o tamanho do pote utilizado em cada produção.
-- Produções antigas permanecem NULL porque não é possível inferir seu tamanho com segurança.
ALTER TABLE producoes
    ADD COLUMN IF NOT EXISTS tamanho_pote INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_producoes_tamanho_pote'
    ) THEN
        ALTER TABLE producoes
            ADD CONSTRAINT ck_producoes_tamanho_pote
            CHECK (tamanho_pote IS NULL OR tamanho_pote IN (20, 44));
    END IF;
END $$;
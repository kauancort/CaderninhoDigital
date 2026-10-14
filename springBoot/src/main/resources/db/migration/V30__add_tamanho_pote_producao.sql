-- Registra o tamanho do pote utilizado em cada produção.
-- Produções antigas permanecem NULL porque não é possível inferir seu tamanho com segurança.
ALTER TABLE producoes
    ADD COLUMN tamanho_pote INTEGER;

ALTER TABLE producoes
    ADD CONSTRAINT ck_producoes_tamanho_pote
    CHECK (tamanho_pote IS NULL OR tamanho_pote IN (20, 44));

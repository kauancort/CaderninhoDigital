ALTER TABLE clientes
    ADD COLUMN cidade VARCHAR(120),
    ADD COLUMN estado VARCHAR(2);

ALTER TABLE clientes
    ADD CONSTRAINT ck_clientes_estado_formato
        CHECK (estado IS NULL OR estado ~ '^[A-Z]{2}$');

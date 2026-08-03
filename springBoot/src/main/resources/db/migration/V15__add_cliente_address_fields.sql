ALTER TABLE clientes
    ADD COLUMN cep VARCHAR(8),
    ADD COLUMN bairro VARCHAR(120),
    ADD COLUMN inscricao_estadual VARCHAR(40);

ALTER TABLE clientes
    ADD CONSTRAINT ck_clientes_cep_formato
        CHECK (cep IS NULL OR cep ~ '^[0-9]{8}$');

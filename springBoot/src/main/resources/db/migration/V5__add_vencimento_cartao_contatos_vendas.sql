ALTER TABLE vendas
    ADD COLUMN data_vencimento DATE,
    ADD COLUMN tipo_cartao VARCHAR(20),
    ADD COLUMN parcelas INTEGER,
    ADD COLUMN contatos TEXT;

ALTER TABLE vendas
    ADD CONSTRAINT ck_vendas_tipo_cartao CHECK (tipo_cartao IS NULL OR tipo_cartao IN ('CREDITO', 'DEBITO'));
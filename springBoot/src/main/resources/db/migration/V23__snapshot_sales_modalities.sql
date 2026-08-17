ALTER TABLE itens_venda ADD COLUMN modalidade_venda VARCHAR(20);
ALTER TABLE itens_venda ADD COLUMN quantidade_modalidade NUMERIC(12,3);
ALTER TABLE itens_venda ADD COLUMN unidades_por_modalidade NUMERIC(12,3);

UPDATE itens_venda
SET modalidade_venda = 'UNIDADE',
    quantidade_modalidade = quantidade,
    unidades_por_modalidade = 1
WHERE modalidade_venda IS NULL;

ALTER TABLE itens_venda ALTER COLUMN modalidade_venda SET NOT NULL;
ALTER TABLE itens_venda ALTER COLUMN quantidade_modalidade SET NOT NULL;
ALTER TABLE itens_venda ALTER COLUMN unidades_por_modalidade SET NOT NULL;

ALTER TABLE itens_venda
    ADD CONSTRAINT ck_itens_venda_modalidade
    CHECK (modalidade_venda IN ('UNIDADE', 'CAIXA', 'PACOTE', 'DUZIA', 'PESO', 'POTE'));
ALTER TABLE itens_venda
    ADD CONSTRAINT ck_itens_venda_quantidade_modalidade
    CHECK (quantidade_modalidade > 0 AND unidades_por_modalidade > 0);

CREATE INDEX idx_itens_venda_produto_modalidade
    ON itens_venda (produto_id, modalidade_venda);

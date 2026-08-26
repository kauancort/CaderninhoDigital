ALTER TABLE itens_venda ALTER COLUMN produto_id DROP NOT NULL;
ALTER TABLE itens_venda ADD COLUMN nome_avulso VARCHAR(120);

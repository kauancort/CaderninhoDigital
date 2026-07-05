CREATE TABLE IF NOT EXISTS produto_gabaritos (
    id BIGINT NOT NULL AUTO_INCREMENT,
    quantidade_base DECIMAL(12,3) NOT NULL,
    observacao VARCHAR(500),
    produto_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_produto_gabaritos_produto UNIQUE (produto_id),
    CONSTRAINT fk_produto_gabaritos_produto FOREIGN KEY (produto_id) REFERENCES produtos (id)
) ENGINE=InnoDB;

INSERT INTO produto_gabaritos (produto_id, quantidade_base)
SELECT DISTINCT pgi.produto_id, 1
FROM produto_gabarito_itens pgi
WHERE NOT EXISTS (
    SELECT 1
    FROM produto_gabaritos pg
    WHERE pg.produto_id = pgi.produto_id
);

ALTER TABLE produto_gabarito_itens
    ADD COLUMN gabarito_id BIGINT;

UPDATE produto_gabarito_itens pgi
JOIN produto_gabaritos pg ON pg.produto_id = pgi.produto_id
SET pgi.gabarito_id = pg.id;

ALTER TABLE produto_gabarito_itens
    MODIFY gabarito_id BIGINT NOT NULL;

ALTER TABLE produto_gabarito_itens
    ADD CONSTRAINT fk_produto_gabarito_itens_gabarito FOREIGN KEY (gabarito_id) REFERENCES produto_gabaritos (id);

ALTER TABLE produto_gabarito_itens
    DROP FOREIGN KEY fk_produto_gabarito_itens_produto;

ALTER TABLE produto_gabarito_itens
    DROP COLUMN produto_id;

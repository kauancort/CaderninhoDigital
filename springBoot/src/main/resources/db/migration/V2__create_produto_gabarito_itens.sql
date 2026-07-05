CREATE TABLE IF NOT EXISTS produto_gabarito_itens (
    id BIGINT NOT NULL AUTO_INCREMENT,
    quantidade_necessaria DECIMAL(12,3) NOT NULL,
    materia_prima_id BIGINT NOT NULL,
    produto_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_produto_gabarito_itens_materia_prima FOREIGN KEY (materia_prima_id) REFERENCES materias_primas (id),
    CONSTRAINT fk_produto_gabarito_itens_produto FOREIGN KEY (produto_id) REFERENCES produtos (id)
) ENGINE=InnoDB;

CREATE TABLE transportadoras (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL UNIQUE REFERENCES clientes(id),
    nome VARCHAR(160) NOT NULL,
    cnpj VARCHAR(20),
    telefone VARCHAR(30),
    email VARCHAR(160),
    cep VARCHAR(8),
    endereco VARCHAR(255),
    numero VARCHAR(20),
    complemento VARCHAR(120),
    bairro VARCHAR(120),
    cidade VARCHAR(120),
    estado VARCHAR(2),
    observacao VARCHAR(500),
    criado_em TIMESTAMP NOT NULL
);

ALTER TABLE vendas
    ADD COLUMN situacao_despacho VARCHAR(30) NOT NULL DEFAULT 'NAO_APLICAVEL';


ALTER TABLE envios_venda
    ADD COLUMN quilometragem NUMERIC(10,2),
    ADD COLUMN custo_estimado NUMERIC(10,2),
    ADD COLUMN entrega_viavel BOOLEAN;
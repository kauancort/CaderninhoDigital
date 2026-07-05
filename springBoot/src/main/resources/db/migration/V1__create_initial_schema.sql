CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT NOT NULL AUTO_INCREMENT,
    cargo_funcao VARCHAR(80) NOT NULL,
    criado_em DATETIME(6) NOT NULL,
    email VARCHAR(160) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    perfil ENUM('FUNCIONARIO','GESTOR') NOT NULL,
    senha VARCHAR(20) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_usuarios_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ativo BIT NOT NULL,
    criado_em DATETIME(6) NOT NULL,
    documento VARCHAR(30),
    email VARCHAR(160),
    endereco VARCHAR(255),
    nome VARCHAR(120) NOT NULL,
    telefone VARCHAR(30),
    gestor_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_clientes_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fornecedores (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ativo BIT NOT NULL,
    criado_em DATETIME(6) NOT NULL,
    documento VARCHAR(30),
    email VARCHAR(160),
    endereco VARCHAR(255),
    nome VARCHAR(120) NOT NULL,
    telefone VARCHAR(30),
    gestor_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_fornecedores_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS produtos (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ativo BIT NOT NULL,
    criado_em DATETIME(6) NOT NULL,
    descricao VARCHAR(500),
    estoque_atual DECIMAL(12,3) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    preco_venda DECIMAL(12,2) NOT NULL,
    unidade_medida VARCHAR(30) NOT NULL,
    gestor_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_produtos_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS materias_primas (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ativo BIT NOT NULL,
    criado_em DATETIME(6) NOT NULL,
    custo_medio DECIMAL(12,2) NOT NULL,
    descricao VARCHAR(500),
    estoque_atual DECIMAL(12,3) NOT NULL,
    estoque_minimo DECIMAL(12,3) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    unidade_medida VARCHAR(30) NOT NULL,
    gestor_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_materias_primas_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lancamentos (
    id BIGINT NOT NULL AUTO_INCREMENT,
    atualizado_em DATETIME(6),
    cliente_ou_fornecedor VARCHAR(120),
    criado_em DATETIME(6) NOT NULL,
    data_lancamento DATE NOT NULL,
    data_vencimento DATE,
    descricao VARCHAR(500),
    forma_pagamento ENUM('BOLETO','CARTAO','DINHEIRO','OUTRO','PIX'),
    nome_produto_ou_insumo VARCHAR(120),
    quantidade DECIMAL(12,3),
    status_pagamento ENUM('ATRASADO','NAO_SE_APLICA','PAGO','PENDENTE') NOT NULL,
    tipo ENUM('COMPRA_PRODUTO','GASTO_GERAL','PRODUCAO','VENDA') NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    unidade_medida VARCHAR(30),
    valor_total DECIMAL(12,2) NOT NULL,
    gestor_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_lancamentos_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vendas (
    id BIGINT NOT NULL AUTO_INCREMENT,
    criado_em DATETIME(6) NOT NULL,
    data_venda DATE NOT NULL,
    forma_pagamento ENUM('BOLETO','CARTAO','DINHEIRO','OUTRO','PIX'),
    observacao VARCHAR(500),
    status_pagamento ENUM('ATRASADO','NAO_SE_APLICA','PAGO','PENDENTE') NOT NULL,
    valor_total DECIMAL(12,2) NOT NULL,
    cliente_id BIGINT,
    gestor_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_vendas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id),
    CONSTRAINT fk_vendas_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS itens_venda (
    id BIGINT NOT NULL AUTO_INCREMENT,
    quantidade DECIMAL(12,3) NOT NULL,
    valor_total DECIMAL(12,2) NOT NULL,
    valor_unitario DECIMAL(12,2) NOT NULL,
    produto_id BIGINT NOT NULL,
    venda_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_itens_venda_produto FOREIGN KEY (produto_id) REFERENCES produtos (id),
    CONSTRAINT fk_itens_venda_venda FOREIGN KEY (venda_id) REFERENCES vendas (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS compras_materias_primas (
    id BIGINT NOT NULL AUTO_INCREMENT,
    criado_em DATETIME(6) NOT NULL,
    data_compra DATE NOT NULL,
    forma_pagamento ENUM('BOLETO','CARTAO','DINHEIRO','OUTRO','PIX'),
    observacao VARCHAR(500),
    status_pagamento ENUM('ATRASADO','NAO_SE_APLICA','PAGO','PENDENTE') NOT NULL,
    valor_total DECIMAL(12,2) NOT NULL,
    fornecedor_id BIGINT,
    gestor_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_compras_materias_primas_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores (id),
    CONSTRAINT fk_compras_materias_primas_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS itens_compra_materia_prima (
    id BIGINT NOT NULL AUTO_INCREMENT,
    quantidade DECIMAL(12,3) NOT NULL,
    valor_total DECIMAL(12,2) NOT NULL,
    valor_unitario DECIMAL(12,2) NOT NULL,
    compra_id BIGINT NOT NULL,
    materia_prima_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_itens_compra_materia_prima_compra FOREIGN KEY (compra_id) REFERENCES compras_materias_primas (id),
    CONSTRAINT fk_itens_compra_materia_prima_materia_prima FOREIGN KEY (materia_prima_id) REFERENCES materias_primas (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS producoes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    criado_em DATETIME(6) NOT NULL,
    custo_estimado DECIMAL(12,2) NOT NULL,
    data_producao DATE NOT NULL,
    observacao VARCHAR(500),
    quantidade_produzida DECIMAL(12,3) NOT NULL,
    gestor_id BIGINT NOT NULL,
    produto_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_producoes_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios (id),
    CONSTRAINT fk_producoes_produto FOREIGN KEY (produto_id) REFERENCES produtos (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS itens_producao_materia_prima (
    id BIGINT NOT NULL AUTO_INCREMENT,
    custo_total DECIMAL(12,2) NOT NULL,
    custo_unitario DECIMAL(12,2) NOT NULL,
    quantidade_utilizada DECIMAL(12,3) NOT NULL,
    materia_prima_id BIGINT NOT NULL,
    producao_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_itens_producao_materia_prima_materia_prima FOREIGN KEY (materia_prima_id) REFERENCES materias_primas (id),
    CONSTRAINT fk_itens_producao_materia_prima_producao FOREIGN KEY (producao_id) REFERENCES producoes (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS insights (
    id BIGINT NOT NULL AUTO_INCREMENT,
    criado_em DATETIME(6) NOT NULL,
    mensagem VARCHAR(1000) NOT NULL,
    tipo ENUM('ALERTA_CUSTO','ALERTA_VENDA','RESUMO_GERAL','SUGESTAO_COMPRA','SUGESTAO_PRODUCAO') NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    gestor_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_insights_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB;

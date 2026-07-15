ALTER TABLE produtos ALTER COLUMN gestor_id DROP NOT NULL;
ALTER TABLE materias_primas ALTER COLUMN gestor_id DROP NOT NULL;

INSERT INTO materias_primas
    (nome, descricao, unidade_medida, estoque_atual, estoque_minimo, custo_medio, ativo, gestor_id, criado_em)
SELECT dados.nome, 'Insumo do catálogo inicial de receitas.', dados.unidade, 0, 0, 0, TRUE, NULL, CURRENT_TIMESTAMP
FROM (VALUES
    ('Amendoim torrado sem pele', 'kg'),
    ('Açúcar cristal', 'kg'),
    ('Farinha de milho amarela', 'kg'),
    ('Sal refinado', 'kg'),
    ('Leite integral', 'L'),
    ('Leite em pó integral', 'kg'),
    ('Embalagem individual', 'unidade')
) AS dados(nome, unidade)
WHERE NOT EXISTS (
    SELECT 1 FROM materias_primas mp WHERE mp.nome = dados.nome AND mp.gestor_id IS NULL
);

INSERT INTO produtos
    (nome, descricao, unidade_medida, preco_venda, estoque_atual, ativo, gestor_id, criado_em)
SELECT dados.nome, dados.descricao, 'unidade', dados.preco, 0, TRUE, NULL, CURRENT_TIMESTAMP
FROM (VALUES
    ('Paçoca', 'Paçoca tradicional prensada de amendoim.', 2.50::NUMERIC),
    ('Fondant de leite', 'Doce de leite cristalizado, macio por dentro e firme por fora.', 3.00::NUMERIC),
    ('Biriba', 'Paçoca de amendoim coberta com fondant de leite, em unidade de aproximadamente 60 g.', 5.00::NUMERIC)
) AS dados(nome, descricao, preco)
WHERE NOT EXISTS (
    SELECT 1 FROM produtos p WHERE p.nome = dados.nome AND p.gestor_id IS NULL
);

INSERT INTO produto_gabaritos (produto_id, quantidade_base, observacao)
SELECT p.id, 100,
    CASE p.nome
        WHEN 'Paçoca' THEN 'Moer e homogeneizar os ingredientes secos, prensar unidades de aproximadamente 20 g e embalar.'
        WHEN 'Fondant de leite' THEN 'Cozinhar leite e açúcar até o ponto, adicionar leite em pó, bater para cristalizar, cortar unidades de aproximadamente 30 g e embalar.'
        ELSE 'Preparar a base de paçoca, cobrir com fondant de leite, porcionar unidades de aproximadamente 60 g e embalar.'
    END
FROM produtos p
WHERE p.gestor_id IS NULL
  AND p.nome IN ('Paçoca', 'Fondant de leite', 'Biriba')
  AND NOT EXISTS (SELECT 1 FROM produto_gabaritos pg WHERE pg.produto_id = p.id);

INSERT INTO produto_gabarito_itens (gabarito_id, materia_prima_id, quantidade_necessaria)
SELECT pg.id, mp.id, receita.quantidade
FROM (VALUES
    ('Paçoca', 'Amendoim torrado sem pele', 0.900::NUMERIC),
    ('Paçoca', 'Açúcar cristal', 0.700::NUMERIC),
    ('Paçoca', 'Farinha de milho amarela', 0.390::NUMERIC),
    ('Paçoca', 'Sal refinado', 0.010::NUMERIC),
    ('Paçoca', 'Embalagem individual', 100.000::NUMERIC),
    ('Fondant de leite', 'Leite integral', 2.000::NUMERIC),
    ('Fondant de leite', 'Açúcar cristal', 1.500::NUMERIC),
    ('Fondant de leite', 'Leite em pó integral', 0.500::NUMERIC),
    ('Fondant de leite', 'Embalagem individual', 100.000::NUMERIC),
    ('Biriba', 'Amendoim torrado sem pele', 2.000::NUMERIC),
    ('Biriba', 'Açúcar cristal', 2.100::NUMERIC),
    ('Biriba', 'Farinha de milho amarela', 0.400::NUMERIC),
    ('Biriba', 'Sal refinado', 0.010::NUMERIC),
    ('Biriba', 'Leite integral', 2.000::NUMERIC),
    ('Biriba', 'Leite em pó integral', 0.800::NUMERIC),
    ('Biriba', 'Embalagem individual', 100.000::NUMERIC)
) AS receita(produto, insumo, quantidade)
JOIN produtos p ON p.nome = receita.produto AND p.gestor_id IS NULL
JOIN produto_gabaritos pg ON pg.produto_id = p.id
JOIN materias_primas mp ON mp.nome = receita.insumo AND mp.gestor_id IS NULL
WHERE NOT EXISTS (
    SELECT 1 FROM produto_gabarito_itens pgi
    WHERE pgi.gabarito_id = pg.id AND pgi.materia_prima_id = mp.id
);

ALTER TABLE produtos MODIFY gestor_id BIGINT NULL;
ALTER TABLE materias_primas MODIFY gestor_id BIGINT NULL;

INSERT INTO materias_primas
    (nome, descricao, unidade_medida, estoque_atual, estoque_minimo, custo_medio, ativo, gestor_id, criado_em)
SELECT dados.nome, 'Insumo do catálogo inicial de receitas.', dados.unidade, 0, 0, 0, 1, NULL, NOW(6)
FROM (
    SELECT 'Amendoim torrado sem pele' nome, 'kg' unidade UNION ALL
    SELECT 'Açúcar cristal', 'kg' UNION ALL
    SELECT 'Farinha de milho amarela', 'kg' UNION ALL
    SELECT 'Sal refinado', 'kg' UNION ALL
    SELECT 'Leite integral', 'L' UNION ALL
    SELECT 'Leite em pó integral', 'kg' UNION ALL
    SELECT 'Embalagem individual', 'unidade'
) dados
WHERE NOT EXISTS (SELECT 1 FROM materias_primas mp WHERE mp.nome = dados.nome AND mp.gestor_id IS NULL);

INSERT INTO produtos
    (nome, descricao, unidade_medida, preco_venda, estoque_atual, ativo, gestor_id, criado_em)
SELECT dados.nome, dados.descricao, 'unidade', dados.preco, 0, 1, NULL, NOW(6)
FROM (
    SELECT 'Paçoca' nome, 'Paçoca tradicional prensada de amendoim.' descricao, 2.50 preco UNION ALL
    SELECT 'Fondant de leite', 'Doce de leite cristalizado, macio por dentro e firme por fora.', 3.00 UNION ALL
    SELECT 'Biriba', 'Paçoca de amendoim coberta com fondant de leite, em unidade de aproximadamente 60 g.', 5.00
) dados
WHERE NOT EXISTS (SELECT 1 FROM produtos p WHERE p.nome = dados.nome AND p.gestor_id IS NULL);

INSERT INTO produto_gabaritos (produto_id, quantidade_base, observacao)
SELECT p.id, 100,
    CASE p.nome
        WHEN 'Paçoca' THEN 'Moer e homogeneizar os ingredientes secos, prensar unidades de aproximadamente 20 g e embalar.'
        WHEN 'Fondant de leite' THEN 'Cozinhar leite e açúcar até o ponto, adicionar leite em pó, bater para cristalizar, cortar unidades de aproximadamente 30 g e embalar.'
        ELSE 'Preparar a base de paçoca, cobrir com fondant de leite, porcionar unidades de aproximadamente 60 g e embalar.'
    END
FROM produtos p
WHERE p.gestor_id IS NULL AND p.nome IN ('Paçoca', 'Fondant de leite', 'Biriba')
  AND NOT EXISTS (SELECT 1 FROM produto_gabaritos pg WHERE pg.produto_id = p.id);

INSERT INTO produto_gabarito_itens (gabarito_id, materia_prima_id, quantidade_necessaria)
SELECT pg.id, mp.id, receita.quantidade
FROM (
    SELECT 'Paçoca' produto, 'Amendoim torrado sem pele' insumo, 0.900 quantidade UNION ALL
    SELECT 'Paçoca', 'Açúcar cristal', 0.700 UNION ALL
    SELECT 'Paçoca', 'Farinha de milho amarela', 0.390 UNION ALL
    SELECT 'Paçoca', 'Sal refinado', 0.010 UNION ALL
    SELECT 'Paçoca', 'Embalagem individual', 100.000 UNION ALL
    SELECT 'Fondant de leite', 'Leite integral', 2.000 UNION ALL
    SELECT 'Fondant de leite', 'Açúcar cristal', 1.500 UNION ALL
    SELECT 'Fondant de leite', 'Leite em pó integral', 0.500 UNION ALL
    SELECT 'Fondant de leite', 'Embalagem individual', 100.000 UNION ALL
    SELECT 'Biriba', 'Amendoim torrado sem pele', 2.000 UNION ALL
    SELECT 'Biriba', 'Açúcar cristal', 2.100 UNION ALL
    SELECT 'Biriba', 'Farinha de milho amarela', 0.400 UNION ALL
    SELECT 'Biriba', 'Sal refinado', 0.010 UNION ALL
    SELECT 'Biriba', 'Leite integral', 2.000 UNION ALL
    SELECT 'Biriba', 'Leite em pó integral', 0.800 UNION ALL
    SELECT 'Biriba', 'Embalagem individual', 100.000
) receita
JOIN produtos p ON p.nome = receita.produto AND p.gestor_id IS NULL
JOIN produto_gabaritos pg ON pg.produto_id = p.id
JOIN materias_primas mp ON mp.nome = receita.insumo AND mp.gestor_id IS NULL
WHERE NOT EXISTS (
    SELECT 1 FROM produto_gabarito_itens pgi
    WHERE pgi.gabarito_id = pg.id AND pgi.materia_prima_id = mp.id
);

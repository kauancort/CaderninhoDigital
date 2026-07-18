\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM clientes WHERE email = 'ana.souza@demo.caderninho.test') THEN
        RAISE EXCEPTION 'A carga realista já foi aplicada neste banco';
    END IF;
END $$;

INSERT INTO usuarios (nome, email, senha, cargo_funcao, perfil, criado_em)
VALUES ('Mariana Costa', 'mariana.costa@demo.caderninho.test', '246', 'Gerente de operações', 'GESTOR', '2026-01-15 08:00:00');

INSERT INTO clientes (nome, email, telefone, documento, endereco, ativo, gestor_id, criado_em) VALUES
('Ana Souza', 'ana.souza@demo.caderninho.test', '(11) 99821-4501', '529.441.780-31', 'Rua das Acácias, 120 - Centro', TRUE, 1, '2026-02-03 09:12:00'),
('Carlos Henrique Lima', 'carlos.lima@demo.caderninho.test', '(11) 99144-7832', '183.750.690-04', 'Av. Brasil, 845 - Jardim América', TRUE, 2, '2026-02-05 14:20:00'),
('Empório Vila Nova Ltda.', 'compras@emporiovilanova.demo', '(11) 3642-1180', '45.801.329/0001-62', 'Rua Vila Nova, 77 - Vila Madalena', TRUE, 1, '2026-02-08 10:05:00'),
('Mercado Bom Vizinho Ltda.', 'financeiro@bomvizinho.demo', '(11) 3874-2290', '18.294.750/0001-18', 'Av. dos Bandeirantes, 1530', TRUE, 2, '2026-02-10 16:35:00'),
('Juliana Martins', 'juliana.martins@demo.caderninho.test', '(11) 99770-1634', '074.962.310-88', 'Rua Aurora, 331 - Santa Cecília', TRUE, 1, '2026-02-18 11:10:00'),
('Padaria Pão da Manhã ME', 'pedidos@paodamanha.demo', '(11) 3321-9088', '27.391.640/0001-05', 'Rua do Trigo, 48 - Mooca', TRUE, 2, '2026-02-22 08:25:00'),
('Roberto Nunes', 'roberto.nunes@demo.caderninho.test', '(11) 98810-4477', '614.208.570-20', 'Rua das Flores, 912', TRUE, 1, '2026-03-01 13:45:00'),
('Café Central Comércio Ltda.', 'administrativo@cafecentral.demo', '(11) 3104-5520', '36.704.125/0001-91', 'Praça da República, 15', TRUE, 2, '2026-03-04 09:50:00'),
('Fernanda Oliveira', 'fernanda.oliveira@demo.caderninho.test', '(11) 99642-7021', '850.317.240-42', 'Alameda Santos, 605', TRUE, 1, '2026-03-09 17:00:00'),
('Armazém São Bento Ltda.', 'compras@armazemsaobento.demo', '(11) 3022-1408', '52.903.481/0001-37', 'Rua São Bento, 204', TRUE, 2, '2026-03-12 10:30:00'),
('Marcos Vinícius Rocha', 'marcos.rocha@demo.caderninho.test', '(11) 99218-6310', '391.685.720-17', 'Rua Harmonia, 188', TRUE, 1, '2026-03-20 15:15:00'),
('Hotel Serra Azul Ltda.', 'eventos@hotelserraazul.demo', '(11) 4002-6601', '09.815.276/0001-44', 'Estrada da Serra, 2200', TRUE, 2, '2026-03-25 08:40:00'),
('Patrícia Gomes', 'patricia.gomes@demo.caderninho.test', '(11) 98550-2944', '267.130.480-06', 'Rua dos Pinheiros, 440', TRUE, 1, '2026-04-02 12:00:00'),
('Cantina da Praça Ltda.', 'contato@cantinadapraca.demo', '(11) 3816-7730', '41.286.903/0001-70', 'Praça das Artes, 32', TRUE, 2, '2026-04-06 09:35:00'),
('Eduardo Siqueira', 'eduardo.siqueira@demo.caderninho.test', '(11) 99413-8206', '705.248.190-53', 'Rua Monte Alegre, 720', TRUE, 1, '2026-04-11 16:10:00'),
('Distribuidora Horizonte Ltda.', 'pedidos@horizonte.demo', '(11) 3468-1155', '63.149.820/0001-26', 'Rodovia Norte, km 18', TRUE, 2, '2026-04-17 07:55:00'),
('Beatriz Cardoso', 'beatriz.cardoso@demo.caderninho.test', '(11) 98331-9090', '148.753.920-64', 'Rua Lisboa, 56', TRUE, 1, '2026-05-03 10:25:00'),
('Loja Sabor & Arte Ltda.', 'compras@saborearte.demo', '(11) 3554-6020', '74.250.396/0001-83', 'Av. Paulista, 1770', TRUE, 2, '2026-05-08 14:05:00'),
('Lucas Almeida', 'lucas.almeida@demo.caderninho.test', '(11) 98920-7731', '430.967.510-09', 'Rua Itália, 310', TRUE, 1, '2026-05-19 11:45:00'),
('Confeitaria Doce Encontro Ltda.', 'estoque@doceencontro.demo', '(11) 3208-4412', '82.617.503/0001-49', 'Rua do Açúcar, 91', TRUE, 2, '2026-06-02 08:15:00'),
('Mônica Ribeiro', 'monica.ribeiro@demo.caderninho.test', '(11) 98204-5518', '916.340.280-75', 'Rua Bela Vista, 112', FALSE, 1, '2026-02-12 15:30:00'),
('Bazar Estrela Ltda.', 'contato@bazarestrela.demo', '(11) 2781-9050', '95.304.728/0001-11', 'Rua Oriente, 608', FALSE, 2, '2026-02-26 09:05:00'),
('Renata Freitas', 'renata.freitas@demo.caderninho.test', '(11) 98117-3640', '352.804.690-95', 'Rua das Palmeiras, 51', FALSE, 1, '2026-03-18 18:20:00'),
('Mini Mercado Avenida Ltda.', 'administracao@miniavenida.demo', '(11) 3907-3321', '11.625.970/0001-58', 'Av. Central, 930', FALSE, 2, '2026-04-28 13:00:00');

INSERT INTO fornecedores (nome, email, telefone, documento, endereco, ativo, gestor_id, criado_em) VALUES
('Cooperativa Amendoim do Vale', 'vendas@amendoimdovale.demo', '(19) 3521-4400', '14.762.930/0001-20', 'Rodovia SP-330, km 142', TRUE, 1, '2026-01-20 09:00:00'),
('Açúcar & Cia Atacadista', 'comercial@acucarecia.demo', '(11) 4152-8801', '28.640.315/0001-76', 'Av. Industrial, 450', TRUE, 2, '2026-01-22 10:00:00'),
('Laticínios Serra Branca', 'pedidos@serrabranca.demo', '(35) 3224-6710', '37.185.402/0001-09', 'Estrada do Leite, km 8', TRUE, 1, '2026-01-24 11:00:00'),
('Cacau Nobre Ingredientes', 'atendimento@cacaunobre.demo', '(13) 3348-1902', '46.903.218/0001-54', 'Rua do Cacau, 180', TRUE, 2, '2026-01-25 14:00:00'),
('PackMais Embalagens', 'vendas@packmais.demo', '(11) 2941-7200', '55.814.627/0001-31', 'Rua das Embalagens, 1000', TRUE, 1, '2026-01-27 08:30:00'),
('Naturale Ingredientes Especiais', 'pedidos@naturale.demo', '(41) 3360-5512', '69.250.143/0001-88', 'Av. das Araucárias, 515', TRUE, 2, '2026-01-29 15:00:00');

INSERT INTO materias_primas
    (nome, descricao, unidade_medida, estoque_atual, estoque_minimo, custo_medio, ativo, gestor_id, criado_em)
VALUES
('Amendoim premium torrado', 'Lote selecionado para a linha premium.', 'kg', 0, 45, 0, TRUE, 1, '2026-02-01 08:00:00'),
('Açúcar demerara', 'Açúcar para receitas artesanais.', 'kg', 0, 35, 0, TRUE, 2, '2026-02-01 08:05:00'),
('Chocolate meio amargo', 'Chocolate 50% cacau em gotas.', 'kg', 0, 18, 0, TRUE, 1, '2026-02-01 08:10:00'),
('Adoçante culinário', 'Mistura para produtos sem adição de açúcar.', 'kg', 0, 8, 0, TRUE, 2, '2026-02-01 08:15:00'),
('Leite condensado', 'Leite condensado integral em embalagem profissional.', 'kg', 0, 25, 0, TRUE, 1, '2026-02-01 08:20:00'),
('Café solúvel', 'Café solúvel para fondant saborizado.', 'kg', 0, 4, 0, TRUE, 2, '2026-02-01 08:25:00'),
('Pote 250 g com tampa', 'Embalagem para varejo.', 'unidade', 0, 500, 0, TRUE, 1, '2026-02-01 08:30:00'),
('Caixa presente 12 unidades', 'Caixa kraft para kits e presentes.', 'unidade', 0, 120, 0, TRUE, 2, '2026-02-01 08:35:00');

INSERT INTO produtos
    (nome, descricao, unidade_medida, preco_venda, estoque_atual, ativo, gestor_id, criado_em)
VALUES
('Paçoca Premium 250 g', 'Categoria: varejo premium. Pote de paçoca artesanal.', 'unidade', 24.90, 0, TRUE, 1, '2026-02-02 08:00:00'),
('Paçoca com Chocolate 250 g', 'Categoria: varejo saborizado. Paçoca com chocolate meio amargo.', 'unidade', 28.90, 0, TRUE, 2, '2026-02-02 08:10:00'),
('Paçoca Zero Açúcar 250 g', 'Categoria: linha especial. Produto com adoçante culinário.', 'unidade', 31.50, 0, TRUE, 1, '2026-02-02 08:20:00'),
('Fondant de Café 250 g', 'Categoria: varejo saborizado. Fondant com café.', 'unidade', 27.90, 0, TRUE, 2, '2026-02-02 08:30:00'),
('Biriba Premium 250 g', 'Categoria: varejo premium. Biriba com cobertura especial.', 'unidade', 32.90, 0, TRUE, 1, '2026-02-02 08:40:00'),
('Kit Degustação 12 unidades', 'Categoria: presentes. Seleção de doces em caixa kraft.', 'unidade', 42.00, 0, TRUE, 2, '2026-02-02 08:50:00');

INSERT INTO produto_gabaritos (produto_id, quantidade_base, observacao)
SELECT id, 100, 'Receita de demonstração validada para lote-base de 100 unidades.'
FROM produtos WHERE descricao LIKE 'Categoria:%';

INSERT INTO produto_gabarito_itens (gabarito_id, materia_prima_id, quantidade_necessaria)
SELECT pg.id, mp.id, receita.quantidade
FROM (VALUES
    ('Paçoca Premium 250 g', 'Amendoim premium torrado', 18.0::NUMERIC),
    ('Paçoca Premium 250 g', 'Açúcar demerara', 7.0::NUMERIC),
    ('Paçoca Premium 250 g', 'Pote 250 g com tampa', 100.0::NUMERIC),
    ('Paçoca com Chocolate 250 g', 'Amendoim premium torrado', 15.0::NUMERIC),
    ('Paçoca com Chocolate 250 g', 'Açúcar demerara', 6.0::NUMERIC),
    ('Paçoca com Chocolate 250 g', 'Chocolate meio amargo', 5.0::NUMERIC),
    ('Paçoca com Chocolate 250 g', 'Pote 250 g com tampa', 100.0::NUMERIC),
    ('Paçoca Zero Açúcar 250 g', 'Amendoim premium torrado', 19.0::NUMERIC),
    ('Paçoca Zero Açúcar 250 g', 'Adoçante culinário', 2.5::NUMERIC),
    ('Paçoca Zero Açúcar 250 g', 'Pote 250 g com tampa', 100.0::NUMERIC),
    ('Fondant de Café 250 g', 'Leite condensado', 20.0::NUMERIC),
    ('Fondant de Café 250 g', 'Açúcar demerara', 5.0::NUMERIC),
    ('Fondant de Café 250 g', 'Café solúvel', 1.2::NUMERIC),
    ('Fondant de Café 250 g', 'Pote 250 g com tampa', 100.0::NUMERIC),
    ('Biriba Premium 250 g', 'Amendoim premium torrado', 13.0::NUMERIC),
    ('Biriba Premium 250 g', 'Leite condensado', 10.0::NUMERIC),
    ('Biriba Premium 250 g', 'Chocolate meio amargo', 4.0::NUMERIC),
    ('Biriba Premium 250 g', 'Pote 250 g com tampa', 100.0::NUMERIC),
    ('Kit Degustação 12 unidades', 'Amendoim premium torrado', 8.0::NUMERIC),
    ('Kit Degustação 12 unidades', 'Açúcar demerara', 3.0::NUMERIC),
    ('Kit Degustação 12 unidades', 'Chocolate meio amargo', 2.0::NUMERIC),
    ('Kit Degustação 12 unidades', 'Caixa presente 12 unidades', 100.0::NUMERIC)
) AS receita(produto, materia, quantidade)
JOIN produtos p ON p.nome = receita.produto
JOIN produto_gabaritos pg ON pg.produto_id = p.id
JOIN materias_primas mp ON mp.nome = receita.materia;

CREATE FUNCTION pg_temp.movimentar_mp(
    p_mp BIGINT, p_usuario BIGINT, p_delta NUMERIC, p_tipo VARCHAR,
    p_origem VARCHAR, p_obs VARCHAR, p_data TIMESTAMP
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_anterior NUMERIC; v_nome VARCHAR; v_unidade VARCHAR;
BEGIN
    SELECT estoque_atual, nome, unidade_medida INTO v_anterior, v_nome, v_unidade
    FROM materias_primas WHERE id = p_mp FOR UPDATE;
    UPDATE materias_primas SET estoque_atual = v_anterior + p_delta WHERE id = p_mp;
    INSERT INTO movimentacoes_estoque
        (tipo_item, materia_prima_id, item_nome, unidade_medida, tipo_movimentacao,
         origem, quantidade, saldo_anterior, saldo_posterior, usuario_id, observacao, ocorrido_em)
    VALUES ('MATERIA_PRIMA', p_mp, v_nome, v_unidade, p_tipo, p_origem, ABS(p_delta),
            v_anterior, v_anterior + p_delta, p_usuario, p_obs, p_data);
END $$;

CREATE FUNCTION pg_temp.movimentar_produto(
    p_produto BIGINT, p_usuario BIGINT, p_delta NUMERIC, p_tipo VARCHAR,
    p_origem VARCHAR, p_obs VARCHAR, p_data TIMESTAMP
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_anterior NUMERIC; v_nome VARCHAR; v_unidade VARCHAR;
BEGIN
    SELECT estoque_atual, nome, unidade_medida INTO v_anterior, v_nome, v_unidade
    FROM produtos WHERE id = p_produto FOR UPDATE;
    UPDATE produtos SET estoque_atual = v_anterior + p_delta WHERE id = p_produto;
    INSERT INTO movimentacoes_estoque
        (tipo_item, produto_id, item_nome, unidade_medida, tipo_movimentacao,
         origem, quantidade, saldo_anterior, saldo_posterior, usuario_id, observacao, ocorrido_em)
    VALUES ('PRODUTO', p_produto, v_nome, v_unidade, p_tipo, p_origem, ABS(p_delta),
            v_anterior, v_anterior + p_delta, p_usuario, p_obs, p_data);
END $$;

DO $$
DECLARE
    mes INTEGER;
    seq INTEGER;
    v_data_base DATE;
    v_criado TIMESTAMP;
    v_usuario BIGINT;
    v_fornecedor BIGINT;
    v_compra BIGINT;
    v_mp RECORD;
    v_qtd NUMERIC;
    v_custo NUMERIC;
    v_estoque_anterior NUMERIC;
    v_prod RECORD;
    v_producao BIGINT;
    v_quantidade_produzida NUMERIC;
    v_item_receita RECORD;
    v_consumo NUMERIC;
    v_custo_producao NUMERIC;
    v_venda BIGINT;
    v_cliente BIGINT;
    v_preco NUMERIC;
    v_quantidade NUMERIC;
    v_total NUMERIC;
BEGIN
    FOR mes IN 0..5 LOOP
        v_data_base := (DATE '2026-02-01' + (mes || ' months')::INTERVAL)::DATE;
        v_usuario := CASE WHEN mes % 2 = 0 THEN 1 ELSE 2 END;
        v_fornecedor := (SELECT id FROM fornecedores ORDER BY id OFFSET (mes % 6) LIMIT 1);
        v_criado := v_data_base + INTERVAL '3 days 9 hours';

        INSERT INTO compras_materias_primas
            (data_compra, forma_pagamento, status_pagamento, observacao, valor_total,
             fornecedor_id, gestor_id, criado_em)
        VALUES (v_criado::DATE, CASE WHEN mes % 3 = 0 THEN 'BOLETO' ELSE 'PIX' END,
                'PAGO', 'Reposição mensal planejada da linha de demonstração.', 0,
                v_fornecedor, v_usuario, v_criado)
        RETURNING id INTO v_compra;

        FOR v_mp IN
            SELECT * FROM materias_primas
            WHERE nome IN ('Amendoim premium torrado','Açúcar demerara','Chocolate meio amargo',
                           'Adoçante culinário','Leite condensado','Café solúvel',
                           'Pote 250 g com tampa','Caixa presente 12 unidades')
            ORDER BY id
        LOOP
            v_qtd := CASE
                WHEN v_mp.unidade_medida = 'unidade' THEN 3200
                WHEN v_mp.nome = 'Café solúvel' THEN 18
                WHEN v_mp.nome = 'Adoçante culinário' THEN 28
                ELSE 320
            END;
            v_custo := CASE v_mp.nome
                WHEN 'Amendoim premium torrado' THEN 16.80 + mes * 0.18
                WHEN 'Açúcar demerara' THEN 5.40 + mes * 0.06
                WHEN 'Chocolate meio amargo' THEN 34.50 + mes * 0.30
                WHEN 'Adoçante culinário' THEN 42.00 + mes * 0.40
                WHEN 'Leite condensado' THEN 12.30 + mes * 0.12
                WHEN 'Café solúvel' THEN 48.00 + mes * 0.45
                WHEN 'Pote 250 g com tampa' THEN 0.82 + mes * 0.01
                ELSE 2.75 + mes * 0.03
            END;
            v_estoque_anterior := v_mp.estoque_atual;
            INSERT INTO itens_compra_materia_prima
                (quantidade, valor_unitario, valor_total, compra_id, materia_prima_id)
            VALUES (v_qtd, v_custo, v_qtd * v_custo, v_compra, v_mp.id);
            UPDATE compras_materias_primas SET valor_total = valor_total + v_qtd * v_custo
            WHERE id = v_compra;
            UPDATE materias_primas
            SET custo_medio = CASE WHEN v_estoque_anterior + v_qtd = 0 THEN 0
                ELSE ROUND((v_estoque_anterior * custo_medio + v_qtd * v_custo) /
                           (v_estoque_anterior + v_qtd), 2) END
            WHERE id = v_mp.id;
            PERFORM pg_temp.movimentar_mp(v_mp.id, v_usuario, v_qtd, 'ENTRADA', 'COMPRA',
                'Entrada referente à reposição mensal.', v_criado);
        END LOOP;

        seq := 0;
        FOR v_prod IN SELECT * FROM produtos WHERE descricao LIKE 'Categoria:%' ORDER BY id LOOP
            seq := seq + 1;
            v_quantidade_produzida := 260 + ((mes + seq) % 4) * 40;
            v_criado := v_data_base + ((8 + seq) || ' days')::INTERVAL + INTERVAL '7 hours 30 minutes';
            INSERT INTO producoes
                (produto_id, gestor_id, data_producao, quantidade_produzida, custo_estimado, observacao, criado_em)
            VALUES (v_prod.id, CASE WHEN seq % 2 = 0 THEN 1 ELSE 2 END, v_criado::DATE,
                    v_quantidade_produzida, 0, 'Lote programado para reposição do estoque.', v_criado)
            RETURNING id INTO v_producao;
            v_custo_producao := 0;
            FOR v_item_receita IN
                SELECT pgi.*, mp.custo_medio
                FROM produto_gabarito_itens pgi
                JOIN produto_gabaritos pg ON pg.id = pgi.gabarito_id
                JOIN materias_primas mp ON mp.id = pgi.materia_prima_id
                WHERE pg.produto_id = v_prod.id
            LOOP
                v_consumo := ROUND(v_item_receita.quantidade_necessaria *
                                   v_quantidade_produzida / 100.0, 3);
                INSERT INTO itens_producao_materia_prima
                    (quantidade_utilizada, custo_unitario, custo_total, producao_id, materia_prima_id)
                VALUES (v_consumo, v_item_receita.custo_medio,
                        ROUND(v_consumo * v_item_receita.custo_medio, 2),
                        v_producao, v_item_receita.materia_prima_id);
                v_custo_producao := v_custo_producao + ROUND(v_consumo * v_item_receita.custo_medio, 2);
                PERFORM pg_temp.movimentar_mp(v_item_receita.materia_prima_id,
                    CASE WHEN seq % 2 = 0 THEN 1 ELSE 2 END, -v_consumo, 'SAIDA', 'PRODUCAO',
                    'Consumo do lote de ' || v_prod.nome || '.', v_criado);
            END LOOP;
            UPDATE producoes SET custo_estimado = v_custo_producao WHERE id = v_producao;
            PERFORM pg_temp.movimentar_produto(v_prod.id,
                CASE WHEN seq % 2 = 0 THEN 1 ELSE 2 END, v_quantidade_produzida, 'ENTRADA', 'PRODUCAO',
                'Conclusão do lote programado.', v_criado + INTERVAL '4 hours');
        END LOOP;

        FOR seq IN 1..18 LOOP
            v_criado := v_data_base + ((10 + (seq % 18)) || ' days')::INTERVAL
                         + ((8 + (seq % 9)) || ' hours')::INTERVAL;
            v_cliente := (SELECT id FROM clientes WHERE email LIKE '%demo%'
                          AND ativo ORDER BY id OFFSET ((mes * 5 + seq * 3) % 20) LIMIT 1);
            SELECT p.* INTO v_prod FROM produtos p WHERE p.descricao LIKE 'Categoria:%'
            ORDER BY p.id OFFSET ((mes + seq) % 6) LIMIT 1;
            v_quantidade := CASE
                WHEN seq IN (5, 12) THEN 55 + mes * 3
                WHEN seq % 4 = 0 THEN 24
                ELSE 6 + (seq % 9)
            END;
            v_preco := v_prod.preco_venda * CASE WHEN v_quantidade >= 50 THEN 0.90 ELSE 1 END;
            v_total := ROUND(v_quantidade * v_preco, 2);
            INSERT INTO vendas
                (cliente_id, gestor_id, data_venda, forma_pagamento, status_pagamento,
                 valor_total, observacao, data_vencimento, tipo_cartao, parcelas, contatos, criado_em)
            VALUES (v_cliente, CASE WHEN seq % 2 = 0 THEN 1 ELSE 2 END, v_criado::DATE,
                    CASE seq % 5 WHEN 0 THEN 'DINHEIRO' WHEN 1 THEN 'PIX' WHEN 2 THEN 'CARTAO'
                         WHEN 3 THEN 'BOLETO' ELSE 'PIX' END,
                    CASE WHEN mes >= 4 AND seq IN (7, 14) THEN 'PENDENTE' ELSE 'PAGO' END,
                    v_total,
                    CASE WHEN v_quantidade >= 50 THEN 'Pedido de revenda com desconto por volume.'
                         ELSE 'Venda recorrente da linha de demonstração.' END,
                    CASE WHEN mes >= 4 AND seq IN (7,14) THEN v_criado::DATE + 15 ELSE NULL END,
                    CASE WHEN seq % 5 = 2 THEN 'CREDITO' ELSE NULL END,
                    CASE WHEN seq % 5 = 2 THEN 2 ELSE NULL END,
                    CASE WHEN mes = 4 AND seq = 7 THEN
                        '[{"data":"2026-06-30T10:00:00","tipo":"WhatsApp","resposta":"Cliente confirmou pagamento para a próxima semana."}]'
                        ELSE NULL END,
                    v_criado)
            RETURNING id INTO v_venda;
            INSERT INTO itens_venda
                (quantidade, valor_unitario, valor_total, produto_id, venda_id)
            VALUES (v_quantidade, v_preco, v_total, v_prod.id, v_venda);
            PERFORM pg_temp.movimentar_produto(v_prod.id,
                CASE WHEN seq % 2 = 0 THEN 1 ELSE 2 END, -v_quantidade, 'SAIDA', 'VENDA',
                CASE WHEN v_quantidade >= 50 THEN 'Saída para pedido de revenda.' ELSE 'Saída por venda.' END,
                v_criado);
        END LOOP;

        SELECT p.* INTO v_prod FROM produtos p WHERE p.descricao LIKE 'Categoria:%'
        ORDER BY p.id OFFSET (mes % 6) LIMIT 1;
        v_criado := v_data_base + INTERVAL '27 days 17 hours';
        PERFORM pg_temp.movimentar_produto(v_prod.id, v_usuario, -(2 + mes % 3), 'AJUSTE',
            'AJUSTE_MANUAL', 'Perda identificada na conferência mensal (avaria de embalagem).', v_criado);
    END LOOP;
END $$;

COMMIT;

SELECT 'Carga concluída' AS status,
       (SELECT COUNT(*) FROM clientes WHERE email LIKE '%demo%') AS clientes_demo,
       (SELECT COUNT(*) FROM vendas WHERE observacao LIKE '%demonstração%'
          OR observacao LIKE '%revenda%') AS vendas_demo,
       (SELECT COUNT(*) FROM producoes WHERE observacao LIKE 'Lote programado%') AS producoes_demo,
       (SELECT COUNT(*) FROM movimentacoes_estoque WHERE ocorrido_em >= '2026-02-01'
          AND item_nome IN (SELECT nome FROM produtos WHERE descricao LIKE 'Categoria:%')) AS movimentos_produtos_demo;

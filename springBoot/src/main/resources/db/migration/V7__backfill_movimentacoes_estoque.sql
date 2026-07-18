WITH eventos AS (
    SELECT
        'MATERIA_PRIMA'::VARCHAR AS tipo_item,
        NULL::BIGINT AS produto_id,
        ic.materia_prima_id,
        mp.nome AS item_nome,
        mp.unidade_medida,
        'ENTRADA'::VARCHAR AS tipo_movimentacao,
        'COMPRA'::VARCHAR AS origem,
        ic.quantidade,
        ic.quantidade AS delta,
        c.gestor_id AS usuario_id,
        c.observacao,
        c.criado_em AS ocorrido_em,
        'C' || ic.id AS evento_ordem,
        mp.estoque_atual AS saldo_atual
    FROM itens_compra_materia_prima ic
    JOIN compras_materias_primas c ON c.id = ic.compra_id
    JOIN materias_primas mp ON mp.id = ic.materia_prima_id

    UNION ALL

    SELECT
        'MATERIA_PRIMA', NULL, ip.materia_prima_id, mp.nome, mp.unidade_medida,
        'SAIDA', 'PRODUCAO', ip.quantidade_utilizada, -ip.quantidade_utilizada,
        p.gestor_id, p.observacao, p.criado_em, 'PI' || ip.id, mp.estoque_atual
    FROM itens_producao_materia_prima ip
    JOIN producoes p ON p.id = ip.producao_id
    JOIN materias_primas mp ON mp.id = ip.materia_prima_id

    UNION ALL

    SELECT
        'PRODUTO', p.produto_id, NULL, pr.nome, pr.unidade_medida,
        'ENTRADA', 'PRODUCAO', p.quantidade_produzida, p.quantidade_produzida,
        p.gestor_id, p.observacao, p.criado_em, 'PP' || p.id, pr.estoque_atual
    FROM producoes p
    JOIN produtos pr ON pr.id = p.produto_id

    UNION ALL

    SELECT
        'PRODUTO', iv.produto_id, NULL, pr.nome, pr.unidade_medida,
        'SAIDA', 'VENDA', iv.quantidade, -iv.quantidade,
        v.gestor_id, v.observacao, v.criado_em, 'V' || iv.id, pr.estoque_atual
    FROM itens_venda iv
    JOIN vendas v ON v.id = iv.venda_id
    JOIN produtos pr ON pr.id = iv.produto_id
), calculados AS (
    SELECT
        eventos.*,
        SUM(delta) OVER (PARTITION BY tipo_item, COALESCE(produto_id, materia_prima_id)) AS delta_total,
        SUM(delta) OVER (
            PARTITION BY tipo_item, COALESCE(produto_id, materia_prima_id)
            ORDER BY ocorrido_em, evento_ordem
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS delta_acumulado
    FROM eventos
)
INSERT INTO movimentacoes_estoque (
    tipo_item, produto_id, materia_prima_id, item_nome, unidade_medida,
    tipo_movimentacao, origem, quantidade, saldo_anterior, saldo_posterior,
    usuario_id, observacao, ocorrido_em
)
SELECT
    tipo_item, produto_id, materia_prima_id, item_nome, unidade_medida,
    tipo_movimentacao, origem, quantidade,
    saldo_atual - delta_total + delta_acumulado - delta,
    saldo_atual - delta_total + delta_acumulado,
    usuario_id, observacao, ocorrido_em
FROM calculados
ORDER BY ocorrido_em, evento_ordem;

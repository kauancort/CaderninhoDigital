WITH ultima_producao AS (
    SELECT DISTINCT ON (produto_id)
           produto_id,
           ROUND(custo_estimado / quantidade_produzida, 2) AS custo_unitario,
           COALESCE(criado_em, data_producao::timestamp) AS inicio_vigencia
      FROM producoes
     WHERE quantidade_produzida > 0
       AND custo_estimado IS NOT NULL
     ORDER BY produto_id, data_producao DESC, criado_em DESC, id DESC
), custos_atualizados AS (
    UPDATE produtos produto
       SET custo_atual = ultima.custo_unitario
      FROM ultima_producao ultima
     WHERE produto.id = ultima.produto_id
       AND produto.custo_atual IS NULL
    RETURNING produto.id, produto.custo_atual
)
INSERT INTO historico_custos_produto
    (produto_id, custo, inicio_vigencia, alterado_em, motivo, origem)
SELECT atualizado.id,
       atualizado.custo_atual,
       ultima.inicio_vigencia,
       CURRENT_TIMESTAMP,
       'Custo reconstruído a partir da produção mais recente',
       'MIGRACAO'
  FROM custos_atualizados atualizado
  JOIN ultima_producao ultima ON ultima.produto_id = atualizado.id;

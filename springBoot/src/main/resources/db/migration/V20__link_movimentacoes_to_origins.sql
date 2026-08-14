ALTER TABLE movimentacoes_estoque
    ADD COLUMN origem_id BIGINT;

ALTER TABLE movimentacoes_estoque
    DROP CONSTRAINT ck_movimentacoes_origem;

ALTER TABLE movimentacoes_estoque
    ADD CONSTRAINT ck_movimentacoes_origem CHECK (
        origem IN ('CADASTRO', 'COMPRA', 'PRODUCAO', 'VENDA', 'AJUSTE_MANUAL', 'REMOCAO_MANUAL')
    );

-- Liga somente eventos reconstruíveis. Os movimentos criados pelo backfill V7
-- têm a mesma data/hora da operação; os eventos gravados pela aplicação ficam
-- poucos segundos próximos. Baixas antigas de vendas pendentes, sem vínculo
-- seguro, permanecem com origem_id nulo em vez de receberem uma origem inventada.
UPDATE movimentacoes_estoque m
   SET origem_id = (
       SELECT c.id
         FROM itens_compra_materia_prima ic
         JOIN compras_materias_primas c ON c.id = ic.compra_id
        WHERE ic.materia_prima_id = m.materia_prima_id
          AND c.gestor_id = m.usuario_id
          AND ic.quantidade = m.quantidade
          AND ABS(EXTRACT(EPOCH FROM (c.criado_em - m.ocorrido_em))) <= 10
        ORDER BY ABS(EXTRACT(EPOCH FROM (c.criado_em - m.ocorrido_em))), c.id
        LIMIT 1
   )
 WHERE m.origem = 'COMPRA'
   AND EXISTS (
       SELECT 1
         FROM itens_compra_materia_prima ic
         JOIN compras_materias_primas c ON c.id = ic.compra_id
        WHERE ic.materia_prima_id = m.materia_prima_id
          AND c.gestor_id = m.usuario_id
          AND ic.quantidade = m.quantidade
          AND ABS(EXTRACT(EPOCH FROM (c.criado_em - m.ocorrido_em))) <= 10
   );

UPDATE movimentacoes_estoque m
   SET origem_id = (
       SELECT p.id
         FROM producoes p
        WHERE p.gestor_id = m.usuario_id
          AND ABS(EXTRACT(EPOCH FROM (p.criado_em - m.ocorrido_em))) <= 10
          AND (
              (m.tipo_item = 'PRODUTO'
               AND p.produto_id = m.produto_id
               AND p.quantidade_produzida = m.quantidade)
              OR
              (m.tipo_item = 'MATERIA_PRIMA'
               AND EXISTS (
                   SELECT 1
                     FROM itens_producao_materia_prima ip
                    WHERE ip.producao_id = p.id
                      AND ip.materia_prima_id = m.materia_prima_id
                      AND ip.quantidade_utilizada = m.quantidade
               ))
          )
        ORDER BY ABS(EXTRACT(EPOCH FROM (p.criado_em - m.ocorrido_em))), p.id
        LIMIT 1
   )
 WHERE m.origem = 'PRODUCAO'
   AND EXISTS (
       SELECT 1
         FROM producoes p
        WHERE p.gestor_id = m.usuario_id
          AND ABS(EXTRACT(EPOCH FROM (p.criado_em - m.ocorrido_em))) <= 10
          AND (
              (m.tipo_item = 'PRODUTO'
               AND p.produto_id = m.produto_id
               AND p.quantidade_produzida = m.quantidade)
              OR
              (m.tipo_item = 'MATERIA_PRIMA'
               AND EXISTS (
                   SELECT 1
                     FROM itens_producao_materia_prima ip
                    WHERE ip.producao_id = p.id
                      AND ip.materia_prima_id = m.materia_prima_id
                      AND ip.quantidade_utilizada = m.quantidade
               ))
          )
   );

UPDATE movimentacoes_estoque m
   SET origem_id = (
       SELECT v.id
         FROM itens_venda iv
         JOIN vendas v ON v.id = iv.venda_id
        WHERE iv.produto_id = m.produto_id
          AND v.gestor_id = m.usuario_id
          AND iv.quantidade = m.quantidade
          AND ABS(EXTRACT(EPOCH FROM (v.criado_em - m.ocorrido_em))) <= 10
        ORDER BY ABS(EXTRACT(EPOCH FROM (v.criado_em - m.ocorrido_em))), v.id
        LIMIT 1
   )
 WHERE m.origem = 'VENDA'
   AND EXISTS (
       SELECT 1
         FROM itens_venda iv
         JOIN vendas v ON v.id = iv.venda_id
        WHERE iv.produto_id = m.produto_id
          AND v.gestor_id = m.usuario_id
          AND iv.quantidade = m.quantidade
          AND ABS(EXTRACT(EPOCH FROM (v.criado_em - m.ocorrido_em))) <= 10
   );

CREATE INDEX idx_movimentacoes_origem_id
    ON movimentacoes_estoque (origem, origem_id, ocorrido_em DESC);

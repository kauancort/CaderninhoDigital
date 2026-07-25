CREATE INDEX idx_vendas_status_vencimento
    ON vendas (status_pagamento, data_vencimento, id);

CREATE INDEX idx_itens_venda_produto_venda
    ON itens_venda (produto_id, venda_id);

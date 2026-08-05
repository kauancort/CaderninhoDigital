ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS ck_lancamentos_forma_pagamento;
ALTER TABLE lancamentos ADD CONSTRAINT ck_lancamentos_forma_pagamento CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('BOLETO', 'CARTAO', 'DINHEIRO', 'OUTRO', 'PIX', 'CHEQUE'));

ALTER TABLE vendas DROP CONSTRAINT IF EXISTS ck_vendas_forma_pagamento;
ALTER TABLE vendas ADD CONSTRAINT ck_vendas_forma_pagamento CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('BOLETO', 'CARTAO', 'DINHEIRO', 'OUTRO', 'PIX', 'CHEQUE'));

ALTER TABLE compras DROP CONSTRAINT IF EXISTS ck_compras_forma_pagamento;
ALTER TABLE compras ADD CONSTRAINT ck_compras_forma_pagamento CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('BOLETO', 'CARTAO', 'DINHEIRO', 'OUTRO', 'PIX', 'CHEQUE'));

package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;

public record ResumoProducaoProdutoDTO(
        Long produtoId,
        String produtoNome,
        long lotes,
        BigDecimal quantidadeProduzida
) {}

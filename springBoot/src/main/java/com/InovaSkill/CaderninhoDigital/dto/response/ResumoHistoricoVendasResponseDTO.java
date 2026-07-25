package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;

public record ResumoHistoricoVendasResponseDTO(
        BigDecimal faturamento,
        long quantidadeVendas,
        BigDecimal quantidadeItens,
        BigDecimal ticketMedio
) {}

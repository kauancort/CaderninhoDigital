package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;

public record ResumoCobrancasResponseDTO(
        BigDecimal totalReceber,
        BigDecimal totalVencido,
        BigDecimal totalEmDia,
        long quantidadeAtrasadas,
        long quantidadeCobrancas
) {}

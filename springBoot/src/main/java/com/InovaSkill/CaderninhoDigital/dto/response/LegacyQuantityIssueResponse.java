package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;

public record LegacyQuantityIssueResponse(
        String arquivo,
        int linha,
        String codigoLegado,
        String coluna,
        BigDecimal valor,
        String unidade,
        String tipo,
        String mensagem
) {
}

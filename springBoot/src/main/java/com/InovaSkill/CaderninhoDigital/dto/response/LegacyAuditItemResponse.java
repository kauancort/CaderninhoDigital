package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record LegacyAuditItemResponse(
        String arquivo,
        int linha,
        String codigoLegado,
        String nome,
        String classificacaoSugerida,
        List<String> contextos,
        List<String> motivos,
        List<String> alertas,
        String unidade,
        BigDecimal estoque,
        Boolean ativo
) {
}

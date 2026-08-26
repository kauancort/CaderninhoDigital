package com.InovaSkill.CaderninhoDigital.dto.response;

public record LegacyHistoricalIssueResponse(
        String arquivo,
        int linha,
        String codigoLegado,
        String dominio,
        String tipo,
        String mensagem,
        boolean bloqueante
) {
}

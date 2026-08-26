package com.InovaSkill.CaderninhoDigital.dto.response;

public record LegacyCatalogDecisionAppliedResponse(
        String arquivo,
        int linha,
        String codigoLegado,
        String classificacaoFinal,
        String observacao
) {
}

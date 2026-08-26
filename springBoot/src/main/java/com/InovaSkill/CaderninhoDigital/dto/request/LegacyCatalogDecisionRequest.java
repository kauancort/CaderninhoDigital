package com.InovaSkill.CaderninhoDigital.dto.request;

public record LegacyCatalogDecisionRequest(
        String arquivo,
        Integer linha,
        String codigoLegado,
        String classificacaoFinal,
        String observacao
) {
}

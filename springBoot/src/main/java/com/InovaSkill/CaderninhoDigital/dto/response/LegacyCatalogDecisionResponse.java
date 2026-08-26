package com.InovaSkill.CaderninhoDigital.dto.response;

import java.util.List;

public record LegacyCatalogDecisionResponse(
        String arquivoPrincipal,
        int arquivosAnalisados,
        long registrosAnalisados,
        boolean prontoParaImportacao,
        long itensAprovados,
        long itensNaoImportados,
        long itensPendentes,
        List<LegacyCatalogDecisionAppliedResponse> decisoesAplicadas,
        List<LegacyImportRejectionResponse> rejeicoes,
        List<String> bloqueios
) {
}

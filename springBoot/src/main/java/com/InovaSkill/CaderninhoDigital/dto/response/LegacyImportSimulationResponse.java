package com.InovaSkill.CaderninhoDigital.dto.response;

import java.util.List;

public record LegacyImportSimulationResponse(
        String arquivoPrincipal,
        int arquivosAnalisados,
        long registrosAnalisados,
        boolean prontoParaImportacao,
        long itensProntos,
        long itensPendentes,
        List<LegacyImportRejectionResponse> rejeicoes,
        List<String> bloqueios
) {
}

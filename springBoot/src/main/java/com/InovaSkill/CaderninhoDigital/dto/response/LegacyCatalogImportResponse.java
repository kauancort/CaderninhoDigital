package com.InovaSkill.CaderninhoDigital.dto.response;

import com.InovaSkill.CaderninhoDigital.enums.LegacyImportRunStatus;
import java.util.List;

public record LegacyCatalogImportResponse(
        Long importacaoId,
        LegacyImportRunStatus status,
        String arquivoPrincipal,
        int arquivosAnalisados,
        long registrosAnalisados,
        long produtosImportados,
        long materiasPrimasImportadas,
        long jaProcessados,
        long naoImportados,
        long aguardandoHistorico,
        List<LegacyImportRejectionResponse> rejeicoes
) {
}

package com.InovaSkill.CaderninhoDigital.dto.response;

import com.InovaSkill.CaderninhoDigital.enums.LegacyImportRunStatus;
import java.util.List;

public record LegacyContactImportResponse(
        Long importacaoId,
        LegacyImportRunStatus status,
        String arquivoPrincipal,
        int arquivosAnalisados,
        long registrosAnalisados,
        long clientesImportados,
        long fornecedoresImportados,
        long jaProcessados,
        long pendentes,
        List<LegacyHistoricalIssueResponse> rejeicoes
) {
}

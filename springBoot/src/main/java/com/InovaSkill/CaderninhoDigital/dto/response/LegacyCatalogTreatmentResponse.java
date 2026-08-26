package com.InovaSkill.CaderninhoDigital.dto.response;

import java.util.List;
import java.util.Map;

public record LegacyCatalogTreatmentResponse(
        String arquivoPrincipal,
        int arquivosAnalisados,
        long registrosAnalisados,
        Map<String, Long> classificacoes,
        long itensProntos,
        long itensParaRevisao,
        List<LegacyCatalogTreatmentItemResponse> itens
) {
}

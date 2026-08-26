package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record LegacyCatalogTreatmentItemResponse(
        String arquivo,
        int linha,
        String codigoLegado,
        String nome,
        String classificacaoSugerida,
        List<String> contextos,
        List<String> motivos,
        List<String> alertas,
        String unidade,
        BigDecimal precoCusto,
        BigDecimal precoVenda,
        BigDecimal estoque,
        BigDecimal estoqueMinimo,
        Boolean ativo,
        String status
) {
}

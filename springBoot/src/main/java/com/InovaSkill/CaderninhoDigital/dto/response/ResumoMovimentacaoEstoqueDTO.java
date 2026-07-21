package com.InovaSkill.CaderninhoDigital.dto.response;

public record ResumoMovimentacaoEstoqueDTO(
        long quantidadeMovimentacoes,
        long entradas,
        long saidas,
        long ajustes
) {}

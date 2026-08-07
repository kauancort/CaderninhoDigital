package com.InovaSkill.CaderninhoDigital.ai.privacy;

import java.math.BigDecimal;

public record ResumoOperacionalIaDTO(
        int materiasPrimasCadastradas,
        long materiasPrimasAbaixoMinimo,
        int produtosCadastrados,
        int vendasRegistradas,
        BigDecimal valorAgregadoVendas,
        int comprasRegistradas,
        BigDecimal valorAgregadoCompras,
        int lancamentosRegistrados,
        BigDecimal valorAgregadoLancamentos,
        int producoesRegistradas,
        BigDecimal quantidadeAgregadaProduzida
) {}

package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;

public record ResumoMateriaPrimaEstoqueDTO(
        long totalItens,
        long itensEmAlerta,
        BigDecimal valorEstoque
) {}

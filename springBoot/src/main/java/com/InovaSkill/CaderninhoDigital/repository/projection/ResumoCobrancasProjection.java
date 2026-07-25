package com.InovaSkill.CaderninhoDigital.repository.projection;

import java.math.BigDecimal;

public interface ResumoCobrancasProjection {
    BigDecimal getTotalReceber();
    BigDecimal getTotalVencido();
    BigDecimal getTotalEmDia();
    Long getQuantidadeAtrasadas();
    Long getQuantidadeCobrancas();
}

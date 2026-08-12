package com.InovaSkill.CaderninhoDigital.repository.projection;

import java.math.BigDecimal;

public interface ResumoGastosProjection {
    BigDecimal getTotal();
    Long getQuantidade();
}

package com.InovaSkill.CaderninhoDigital.repository.projection;

import java.math.BigDecimal;

public interface ResumoHistoricoVendasProjection {
    BigDecimal getFaturamento();
    Long getQuantidadeVendas();
    BigDecimal getTicketMedio();
}

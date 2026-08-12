package com.InovaSkill.CaderninhoDigital.repository.projection;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface AnaliseCompraInsumoAgrupadaProjection extends AnaliseCompraInsumoProjection {
    Long getMateriaPrimaId();
    String getUnidade();
}

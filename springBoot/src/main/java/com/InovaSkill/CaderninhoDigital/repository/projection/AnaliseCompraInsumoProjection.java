package com.InovaSkill.CaderninhoDigital.repository.projection;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface AnaliseCompraInsumoProjection {
    BigDecimal getQuantidadeTotal();
    BigDecimal getValorTotal();
    BigDecimal getMenorPreco();
    BigDecimal getMaiorPreco();
    Long getQuantidadeCompras();
    LocalDate getPrimeiraCompra();
    LocalDate getUltimaCompra();
}

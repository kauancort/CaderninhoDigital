package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DashboardResumoResponseDTO {
    private BigDecimal totalVendas;
    private BigDecimal totalComprasProduto;
    private BigDecimal totalProducao;
    private BigDecimal totalGastosGerais;
    private BigDecimal saldoEstimado;
    private BigDecimal totalPendente;
    private Long quantidadeLancamentos;
}

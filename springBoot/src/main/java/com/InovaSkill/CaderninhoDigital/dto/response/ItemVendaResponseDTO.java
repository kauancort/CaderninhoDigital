package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ItemVendaResponseDTO {
    private Long id;
    private Long produtoId;
    private String produtoNome;
    private BigDecimal quantidade;
    private BigDecimal valorUnitario;
    private BigDecimal valorTotal;
    private BigDecimal custoConsiderado;
}

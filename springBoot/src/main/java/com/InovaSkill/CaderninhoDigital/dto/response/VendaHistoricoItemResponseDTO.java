package com.InovaSkill.CaderninhoDigital.dto.response;

import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class VendaHistoricoItemResponseDTO {

    private Long id;
    private LocalDate dataVenda;
    private Long clienteId;
    private String clienteNome;
    private BigDecimal quantidadeItens;
    private BigDecimal valorTotal;
    private FormaPagamento formaPagamento;
    private Integer parcelas;
    private StatusPagamento statusPagamento;
    private Boolean emAtraso;
}
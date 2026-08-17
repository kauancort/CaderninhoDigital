package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import com.InovaSkill.CaderninhoDigital.enums.ModalidadeVenda;
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
    private ModalidadeVenda modalidadeVenda;
    private BigDecimal quantidadeModalidade;
    private BigDecimal unidadesPorModalidade;
}

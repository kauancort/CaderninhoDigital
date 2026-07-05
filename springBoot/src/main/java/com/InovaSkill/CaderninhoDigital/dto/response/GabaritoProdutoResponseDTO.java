package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class GabaritoProdutoResponseDTO {
    private Long id;
    private BigDecimal quantidadeBase;
    private String observacao;
    private List<ItemGabaritoProdutoResponseDTO> itens;
}

package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ItemGabaritoProdutoResponseDTO {
    private Long id;
    private Long materiaPrimaId;
    private String materiaPrimaNome;
    private String unidadeMedida;
    private BigDecimal quantidadeNecessaria;
}

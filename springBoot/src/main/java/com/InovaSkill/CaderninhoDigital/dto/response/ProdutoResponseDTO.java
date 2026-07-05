package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProdutoResponseDTO {
    private Long id;
    private String nome;
    private String descricao;
    private String unidadeMedida;
    private BigDecimal precoVenda;
    private BigDecimal estoqueAtual;
    private Boolean ativo;
    private GabaritoProdutoResponseDTO gabarito;
}

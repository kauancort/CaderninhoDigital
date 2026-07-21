package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProdutoResumoResponseDTO {
    private Long id;
    private String nome;
    private String sku;
    private String categoria;
    private String unidadeMedida;
    private BigDecimal precoVenda;
    private BigDecimal custoAtual;
    private BigDecimal estoqueAtual;
    private Boolean ativo;
    private String tipo;
}

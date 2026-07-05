package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MateriaPrimaResponseDTO {
    private Long id;
    private String nome;
    private String descricao;
    private String unidadeMedida;
    private BigDecimal estoqueAtual;
    private BigDecimal estoqueMinimo;
    private BigDecimal custoMedio;
    private Boolean ativo;
}

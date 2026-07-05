package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MateriaPrimaRequestDTO {
    @NotBlank(message = "O nome é obrigatório")
    private String nome;
    private String descricao;
    @NotBlank(message = "A unidade de medida é obrigatória")
    private String unidadeMedida;
    private BigDecimal estoqueAtual;
    private BigDecimal estoqueMinimo;
    private BigDecimal custoMedio;
    private Boolean ativo;
}

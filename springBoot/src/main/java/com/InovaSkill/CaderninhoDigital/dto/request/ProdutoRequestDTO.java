package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProdutoRequestDTO {
    @NotBlank(message = "O nome é obrigatório")
    private String nome;
    private String descricao;
    private String sku;
    private Long categoriaId;
    @NotBlank(message = "A unidade de medida é obrigatória")
    private String unidadeMedida;
    @NotNull(message = "O preço de venda é obrigatório")
    @DecimalMin(value = "0.0", inclusive = false, message = "O preço de venda deve ser maior que zero")
    private BigDecimal precoVenda;
    @DecimalMin(value = "0.0", message = "O custo atual não pode ser negativo")
    private BigDecimal custoAtual;
    private BigDecimal estoqueAtual;
    private Boolean ativo;
    @Valid
    private GabaritoProdutoRequestDTO gabarito;
}

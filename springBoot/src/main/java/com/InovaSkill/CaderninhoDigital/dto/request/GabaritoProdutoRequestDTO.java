package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GabaritoProdutoRequestDTO {
    @NotNull(message = "A quantidade base do gabarito é obrigatória")
    @DecimalMin(value = "0.0", inclusive = false, message = "A quantidade base deve ser maior que zero")
    private BigDecimal quantidadeBase;

    private String observacao;

    @Valid
    @NotEmpty(message = "Informe ao menos um item do gabarito")
    private List<ItemGabaritoProdutoRequestDTO> itens;
}

package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProducaoRequestDTO {
    @NotNull(message = "O produto é obrigatório")
    private Long produtoId;
    @NotNull(message = "A data da produção é obrigatória")
    private LocalDate dataProducao;
    @NotNull(message = "O tamanho do pote é obrigatório")
    private Integer tamanhoPote; // Valores permitidos: 20 ou 44 unidades

    @NotNull(message = "A quantidade produzida é obrigatória")
    @DecimalMin(value = "0.0", inclusive = false, message = "A quantidade produzida deve ser maior que zero")
    private BigDecimal quantidadeProduzida;
    private String observacao;
    @Valid
    private List<InsumoProducaoRequestDTO> insumos;
}

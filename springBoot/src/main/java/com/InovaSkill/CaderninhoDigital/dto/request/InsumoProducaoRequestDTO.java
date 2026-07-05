package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InsumoProducaoRequestDTO {
    @NotNull(message = "A matéria-prima é obrigatória")
    private Long materiaPrimaId;
    @NotNull(message = "A quantidade utilizada é obrigatória")
    @DecimalMin(value = "0.0", inclusive = false, message = "A quantidade utilizada deve ser maior que zero")
    private BigDecimal quantidadeUtilizada;
}

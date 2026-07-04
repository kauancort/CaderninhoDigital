package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ItemVendaRequestDTO {
    @NotNull(message = "O produto é obrigatório")
    private Long produtoId;
    @NotNull(message = "A quantidade é obrigatória")
    @DecimalMin(value = "0.0", inclusive = false, message = "A quantidade deve ser maior que zero")
    private BigDecimal quantidade;
    private BigDecimal valorUnitario;
}

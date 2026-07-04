package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ItemCompraMateriaPrimaRequestDTO {
    @NotNull(message = "A matéria-prima é obrigatória")
    private Long materiaPrimaId;
    @NotNull(message = "A quantidade é obrigatória")
    @DecimalMin(value = "0.0", inclusive = false, message = "A quantidade deve ser maior que zero")
    private BigDecimal quantidade;
    @NotNull(message = "O valor unitário é obrigatório")
    @DecimalMin(value = "0.0", inclusive = false, message = "O valor unitário deve ser maior que zero")
    private BigDecimal valorUnitario;
}

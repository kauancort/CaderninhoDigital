package com.InovaSkill.CaderninhoDigital.ai.contract;

import com.InovaSkill.CaderninhoDigital.enums.ModalidadeVenda;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ArgumentosRentabilidadeProduto(
        @NotNull @Positive Long produtoId,
        @NotNull LocalDate inicio,
        @NotNull LocalDate fim,
        ModalidadeVenda modalidade,
        @DecimalMin(value = "0.0", inclusive = false) BigDecimal precoConsultado
) implements ArgumentosFerramenta {}

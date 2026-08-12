package com.InovaSkill.CaderninhoDigital.ai.contract;

import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

public record ArgumentosCompraInsumo(
        @Positive Long materiaPrimaId,
        @jakarta.validation.constraints.NotNull LocalDate inicio,
        @jakarta.validation.constraints.NotNull LocalDate fim
) implements ArgumentosFerramenta {}

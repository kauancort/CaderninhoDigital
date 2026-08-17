package com.InovaSkill.CaderninhoDigital.ai.contract;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

public record ArgumentosProdutoPeriodo(
        @NotNull @Positive Long produtoId,
        @NotNull LocalDate inicio,
        @NotNull LocalDate fim
) implements ArgumentosFerramenta {}

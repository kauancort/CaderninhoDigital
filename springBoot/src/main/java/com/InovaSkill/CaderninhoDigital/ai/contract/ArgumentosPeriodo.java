package com.InovaSkill.CaderninhoDigital.ai.contract;

import java.time.LocalDate;
import jakarta.validation.constraints.NotNull;

public record ArgumentosPeriodo(
        @NotNull LocalDate inicio,
        @NotNull LocalDate fim
) implements ArgumentosFerramenta {}

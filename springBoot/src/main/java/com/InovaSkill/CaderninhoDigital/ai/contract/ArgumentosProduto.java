package com.InovaSkill.CaderninhoDigital.ai.contract;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ArgumentosProduto(@NotNull @Positive Long produtoId) implements ArgumentosFerramenta {}

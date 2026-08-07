package com.InovaSkill.CaderninhoDigital.ai.contract;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record ChamadaFerramenta(
        @NotNull FerramentaPermitida ferramenta,
        @NotNull @Valid ArgumentosFerramenta argumentos
) {}

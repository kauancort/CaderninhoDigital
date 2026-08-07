package com.InovaSkill.CaderninhoDigital.ai.contract;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record PlanoOrquestracao(
        @NotBlank String schemaVersion,
        @NotNull IntencaoOrquestrador intencao,
        @NotNull @Valid List<ChamadaFerramenta> chamadas,
        @NotNull ModoResposta modoResposta
) {}

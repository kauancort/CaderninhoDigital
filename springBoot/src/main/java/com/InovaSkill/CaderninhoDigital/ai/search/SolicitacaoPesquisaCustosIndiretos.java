package com.InovaSkill.CaderninhoDigital.ai.search;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SolicitacaoPesquisaCustosIndiretos(
        @NotBlank @Size(max = 100) String produto,
        @Size(max = 60) String categoria,
        @NotBlank @Size(max = 100) String cidade,
        @NotBlank @Size(min = 2, max = 2) String uf,
        @Size(min = 1, max = 6) List<@NotBlank @Size(max = 30) String> custosAusentes) {}

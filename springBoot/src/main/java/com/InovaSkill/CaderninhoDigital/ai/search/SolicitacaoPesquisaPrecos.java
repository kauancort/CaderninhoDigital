package com.InovaSkill.CaderninhoDigital.ai.search;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record SolicitacaoPesquisaPrecos(
        @NotBlank @Size(max = 100) String insumo,
        @NotBlank @Size(max = 30) String unidade,
        @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal quantidade,
        @NotBlank @Size(max = 100) String cidade,
        @NotBlank @Pattern(regexp = "[A-Z]{2}") String uf) {}

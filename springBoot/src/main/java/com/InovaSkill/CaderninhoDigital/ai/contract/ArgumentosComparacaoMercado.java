package com.InovaSkill.CaderninhoDigital.ai.contract;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ArgumentosComparacaoMercado(
        @Positive Long materiaPrimaId,
        @NotNull LocalDate inicio,
        @NotNull LocalDate fim,
        @NotBlank @Size(max = 30) String unidade,
        @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal quantidadeAlvo,
        @NotBlank @Size(max = 100) String cidade,
        @NotBlank @Pattern(regexp = "[A-Z]{2}") String uf
) implements ArgumentosFerramenta {}

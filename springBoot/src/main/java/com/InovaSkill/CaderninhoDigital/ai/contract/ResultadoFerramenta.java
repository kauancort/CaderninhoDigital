package com.InovaSkill.CaderninhoDigital.ai.contract;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record ResultadoFerramenta(
        FerramentaPermitida ferramenta,
        StatusResultado status,
        Map<String, Object> dadosAgregados,
        LocalDate periodoInicio,
        LocalDate periodoFim,
        Instant atualizadoEm,
        List<String> avisos,
        QualidadeResultado qualidade
) {}

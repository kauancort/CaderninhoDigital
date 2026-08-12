package com.InovaSkill.CaderninhoDigital.ai.search;

import java.time.Instant;
import java.util.List;

public record ResultadoPesquisaPrecos(String consulta, Instant pesquisadoEm,
        List<FontePesquisaPreco> fontes, List<String> avisos) {}

package com.InovaSkill.CaderninhoDigital.ai.gateway;

public record MetadadosModelo(
        String modeloSolicitado,
        String modeloEfetivo,
        Integer tokensEntrada,
        Integer tokensSaida,
        Integer tokensTotais,
        long duracaoMillis,
        boolean modeloDivergente
) {}

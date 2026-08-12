package com.InovaSkill.CaderninhoDigital.ai.observability;

import java.time.Instant;
import java.util.List;

public record EventoAuditoriaIa(
        String correlacao, Long usuarioInterno, String intencao, List<String> ferramentas,
        boolean autorizado, String modeloEfetivo, int chamadasModelo,
        Integer tokensEntrada, Integer tokensSaida, Integer tokensTotal,
        boolean medicaoTokensParcial, long duracaoMillis, String statusFinal,
        String codigoErro, String promptVersion, String schemaVersion, Instant horario
) {}

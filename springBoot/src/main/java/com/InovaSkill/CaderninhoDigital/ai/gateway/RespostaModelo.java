package com.InovaSkill.CaderninhoDigital.ai.gateway;

import java.util.Objects;

public record RespostaModelo<T>(T conteudo, MetadadosModelo metadados) {
    public RespostaModelo {
        Objects.requireNonNull(conteudo, "conteudo");
        Objects.requireNonNull(metadados, "metadados");
    }
}

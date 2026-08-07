package com.InovaSkill.CaderninhoDigital.ai.gateway;

public enum PapelMensagemModelo {
    SYSTEM("system"),
    USER("user"),
    ASSISTANT("assistant");

    private final String providerValue;

    PapelMensagemModelo(String providerValue) {
        this.providerValue = providerValue;
    }

    public String providerValue() {
        return providerValue;
    }
}

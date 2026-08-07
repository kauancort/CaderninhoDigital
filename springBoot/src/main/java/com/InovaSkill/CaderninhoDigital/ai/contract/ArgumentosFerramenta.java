package com.InovaSkill.CaderninhoDigital.ai.contract;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "tipo")
@JsonSubTypes({
        @JsonSubTypes.Type(value = ArgumentosSemFiltro.class, name = "SEM_FILTRO"),
        @JsonSubTypes.Type(value = ArgumentosPeriodo.class, name = "PERIODO")
})
public sealed interface ArgumentosFerramenta permits ArgumentosSemFiltro, ArgumentosPeriodo {}

package com.InovaSkill.CaderninhoDigital.ai.contract;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "tipo")
@JsonSubTypes({
        @JsonSubTypes.Type(value = ArgumentosSemFiltro.class, name = "SEM_FILTRO"),
        @JsonSubTypes.Type(value = ArgumentosPeriodo.class, name = "PERIODO"),
        @JsonSubTypes.Type(value = ArgumentosProduto.class, name = "PRODUTO"),
        @JsonSubTypes.Type(value = ArgumentosCompraInsumo.class, name = "COMPRA_INSUMO"),
        @JsonSubTypes.Type(value = ArgumentosComparacaoMercado.class, name = "COMPARACAO_MERCADO")
})
public sealed interface ArgumentosFerramenta permits ArgumentosSemFiltro, ArgumentosPeriodo,
        ArgumentosProduto, ArgumentosCompraInsumo, ArgumentosComparacaoMercado {}

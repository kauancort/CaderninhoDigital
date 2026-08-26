package com.InovaSkill.CaderninhoDigital.dto.request;

import com.InovaSkill.CaderninhoDigital.enums.SituacaoDespacho;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DespachoUpdateRequestDTO {

    @NotNull(message = "Informe a nova situação de despacho")
    private SituacaoDespacho situacaoDespacho;

    // Opcional: informado ao marcar como DESPACHADO
    private String codigoRastreamento;
}
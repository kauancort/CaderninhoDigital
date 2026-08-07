package com.InovaSkill.CaderninhoDigital.ai.tool;

import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;

public record MetadadosFerramenta(
        FerramentaPermitida identificador,
        String descricao,
        TipoArgumentosFerramenta tipoArgumentos
) {}

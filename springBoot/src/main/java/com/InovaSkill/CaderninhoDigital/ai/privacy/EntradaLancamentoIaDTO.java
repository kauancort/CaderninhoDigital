package com.InovaSkill.CaderninhoDigital.ai.privacy;

import java.util.List;

public record EntradaLancamentoIaDTO(
        String transcricaoSanitizada,
        List<CatalogoItemIaDTO> produtos,
        List<CatalogoItemIaDTO> materiasPrimas,
        String contextoAnteriorSanitizado
) {}

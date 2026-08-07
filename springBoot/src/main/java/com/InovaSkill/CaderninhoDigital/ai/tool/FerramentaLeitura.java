package com.InovaSkill.CaderninhoDigital.ai.tool;

import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.ai.contract.ResultadoFerramenta;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import java.time.Duration;

public interface FerramentaLeitura<A extends ArgumentosFerramenta> {
    FerramentaPermitida identificador();

    String descricao();

    TipoArgumentosFerramenta tipoArgumentos();

    Class<A> classeArgumentos();

    PerfilUsuario permissaoNecessaria();

    Duration timeout();

    default boolean somenteLeitura() {
        return true;
    }

    ResultadoFerramenta executar(A argumentos, ContextoExecucaoFerramenta contexto);
}

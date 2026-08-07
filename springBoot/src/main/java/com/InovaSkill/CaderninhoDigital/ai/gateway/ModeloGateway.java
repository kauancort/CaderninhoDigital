package com.InovaSkill.CaderninhoDigital.ai.gateway;

import com.InovaSkill.CaderninhoDigital.ai.contract.PlanoOrquestracao;

public interface ModeloGateway {
    RespostaModelo<PlanoOrquestracao> gerarPlano(SolicitacaoModelo solicitacao);

    RespostaModelo<String> gerarRespostaFinal(SolicitacaoModelo solicitacao);

    <T> RespostaModelo<T> gerarEstruturado(SolicitacaoModelo solicitacao, Class<T> tipoResposta);
}

package com.InovaSkill.CaderninhoDigital.ai.gateway;

import com.InovaSkill.CaderninhoDigital.ai.contract.PlanoOrquestracao;
import java.time.Duration;

public interface ModeloGateway {
    /**
     * Transcreve uma gravação curta usando o provedor configurado. A implementação
     * padrão mantém gateways de testes e integrações textuais compatíveis.
     */
    default String transcreverAudio(byte[] audio, String formato) {
        throw new UnsupportedOperationException("Transcrição de áudio não configurada");
    }

    RespostaModelo<PlanoOrquestracao> gerarPlano(SolicitacaoModelo solicitacao);

    RespostaModelo<String> gerarRespostaFinal(SolicitacaoModelo solicitacao);

    <T> RespostaModelo<T> gerarEstruturado(SolicitacaoModelo solicitacao, Class<T> tipoResposta);

    <T> RespostaModelo<T> gerarEstruturado(SolicitacaoModelo solicitacao, Class<T> tipoResposta,
            Duration timeout);
}

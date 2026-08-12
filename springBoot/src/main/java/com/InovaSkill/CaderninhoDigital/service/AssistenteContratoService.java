package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.dto.request.AcaoRapidaAssistente;
import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.MensagemConversaDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ConversaResponseDTO;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AssistenteContratoService {
    private final AiOrchestratorProperties properties;

    public AssistenteContratoService(AiOrchestratorProperties properties) {
        this.properties = properties;
    }

    public ConversaRequestDTO preparar(ConversaRequestDTO request) {
        String version = request.getVersaoContrato();
        if (version == null || version.isBlank()) {
            request.setVersaoContrato(AiOrchestratorProperties.CONTRACT_VERSION);
        } else if (!AiOrchestratorProperties.CONTRACT_VERSION.equals(version)
                && !AiOrchestratorProperties.LEGACY_CONTRACT_VERSION.equals(version)) {
            throw entradaInvalida("Versão de contrato não suportada");
        }

        if ((request.getMensagem() == null || request.getMensagem().isBlank()) && request.getAcaoRapida() == null) {
            throw entradaInvalida("Informe uma mensagem ou ação rápida");
        }
        if (request.getMensagem() == null || request.getMensagem().isBlank()) {
            request.setMensagem(mensagemAcaoRapida(request.getAcaoRapida()));
        } else {
            request.setMensagem(request.getMensagem().trim());
        }

        var limits = properties.getLimits();
        if (request.getMensagem().length() > limits.getMessageCharacters()) {
            throw limite("Mensagem excede o limite configurado");
        }
        List<MensagemConversaDTO> historico = request.getHistorico() == null ? List.of() : request.getHistorico();
        if (historico.size() > limits.getHistoryMessages()) {
            throw limite("Histórico excede o limite configurado");
        }
        if (historico.stream().anyMatch(item -> item.getTexto() != null
                && item.getTexto().length() > limits.getHistoryMessageCharacters())) {
            throw limite("Mensagem do histórico excede o limite configurado");
        }
        request.setHistorico(historico);
        if (request.getCorrelacao() != null
                && !request.getCorrelacao().matches("[A-Za-z0-9._-]{1,100}")) {
            throw entradaInvalida("Correlação inválida");
        }
        return request;
    }

    public ConversaResponseDTO finalizar(ConversaResponseDTO response, ConversaRequestDTO request) {
        response.setVersaoContrato(request.getVersaoContrato());
        response.setCorrelacao(request.getCorrelacao());
        return response;
    }

    private String mensagemAcaoRapida(AcaoRapidaAssistente acao) {
        return switch (acao) {
            case RESUMIR_NEGOCIO -> "Apresente um resumo do negócio";
            case VERIFICAR_ESTOQUE -> "Como está o estoque?";
            case RESUMIR_VENDAS -> "Apresente um resumo das vendas";
            case RESUMIR_GASTOS -> "Apresente um resumo dos gastos";
            case VERIFICAR_RECEBIVEIS -> "Como estão os valores a receber?";
        };
    }

    private OrquestradorException entradaInvalida(String message) {
        return new OrquestradorException(CodigoErroOrquestrador.ENTRADA_INVALIDA, HttpStatus.BAD_REQUEST, message);
    }

    private OrquestradorException limite(String message) {
        return new OrquestradorException(CodigoErroOrquestrador.LIMITE_EXCEDIDO,
                HttpStatus.PAYLOAD_TOO_LARGE, message);
    }
}

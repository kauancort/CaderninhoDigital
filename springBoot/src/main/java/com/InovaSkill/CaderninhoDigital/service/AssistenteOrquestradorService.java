package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.gateway.*;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.ai.tool.ExecutorFerramentas;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.dto.request.AcaoRapidaAssistente;
import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ConversaResponseDTO;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AssistenteOrquestradorService {
    private final AiOrchestratorProperties properties;
    private final ModeloGateway gateway;
    private final PlanoContratoValidator planoValidator;
    private final ExecutorFerramentas executor;
    private final PoliticaDadosIa politica;
    private final ObjectMapper mapper;

    public AssistenteOrquestradorService(AiOrchestratorProperties properties, ModeloGateway gateway,
            PlanoContratoValidator planoValidator, ExecutorFerramentas executor,
            PoliticaDadosIa politica, ObjectMapper mapper) {
        this.properties = properties; this.gateway = gateway; this.planoValidator = planoValidator;
        this.executor = executor; this.politica = politica; this.mapper = mapper;
    }

    public ConversaResponseDTO conversar(ConversaRequestDTO request) {
        if (!properties.getFeatures().isOrchestrator() || !properties.getFeatures().isTools()) {
            throw new OrquestradorException(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL,
                    HttpStatus.SERVICE_UNAVAILABLE, "Assistente temporariamente indisponível");
        }
        politica.validarEntradaChat(request.getMensagem());
        ResultadoFerramenta resultado;
        boolean caminhoRapido = request.getAcaoRapida() == AcaoRapidaAssistente.VERIFICAR_ESTOQUE;
        if (caminhoRapido) {
            resultado = executarEstoque(request.getCorrelacao());
        } else {
            PlanoOrquestracao plano = planejar(request.getMensagem());
            validarFatia(plano);
            resultado = executor.executar(plano.chamadas().getFirst(), request.getCorrelacao());
        }
        String texto = caminhoRapido ? respostaDeterministica(resultado) : gerarRespostaOuFallback(resultado);
        return resposta(texto, resultado, caminhoRapido ? "CAMINHO_RAPIDO" : "ORQUESTRADOR");
    }

    private PlanoOrquestracao planejar(String mensagem) {
        var solicitacao = solicitacaoPlano(mensagem, false);
        try {
            return gateway.gerarPlano(solicitacao).conteudo();
        } catch (OrquestradorException primeiraFalha) {
            if (primeiraFalha.getCodigo() != CodigoErroOrquestrador.PLANO_INVALIDO
                    || properties.getLimits().getPlanRepairs() < 1) throw primeiraFalha;
            return gateway.gerarPlano(solicitacaoPlano(mensagem, true)).conteudo();
        }
    }

    private SolicitacaoModelo solicitacaoPlano(String mensagem, boolean reparo) {
        String sistema = "Planejador " + properties.getPromptVersion()
                + ". Use somente intencao CONSULTAR_ESTOQUE, ferramenta RESUMO_ESTOQUE, argumentos {}"
                + ", uma chamada, schemaVersion " + properties.getSchemaVersion()
                + ". Nunca gere SQL, URL, endpoint, classe ou campos extras."
                + (reparo ? " Repare o JSON e devolva somente o contrato válido." : "");
        var solicitacao = new SolicitacaoModelo(List.of(
                new MensagemModelo(PapelMensagemModelo.SYSTEM, sistema),
                new MensagemModelo(PapelMensagemModelo.USER, politica.delimitarEntradaNaoConfiavel(mensagem))));
        politica.validarSolicitacaoModelo(solicitacao);
        return solicitacao;
    }

    private void validarFatia(PlanoOrquestracao plano) {
        planoValidator.validar(plano);
        if (plano.intencao() != IntencaoOrquestrador.CONSULTAR_ESTOQUE || plano.chamadas().size() != 1
                || plano.chamadas().getFirst().ferramenta() != FerramentaPermitida.RESUMO_ESTOQUE
                || !(plano.chamadas().getFirst().argumentos() instanceof ArgumentosSemFiltro)) {
            throw new OrquestradorException(CodigoErroOrquestrador.PLANO_INVALIDO,
                    HttpStatus.BAD_REQUEST, "O plano solicitou uma capacidade não permitida nesta etapa");
        }
    }

    private ResultadoFerramenta executarEstoque(String correlacao) {
        return executor.executar(new ChamadaFerramenta(FerramentaPermitida.RESUMO_ESTOQUE,
                new ArgumentosSemFiltro()), correlacao);
    }

    private String gerarRespostaOuFallback(ResultadoFerramenta resultado) {
        try {
            String dados = mapper.writeValueAsString(resultado);
            var solicitacao = new SolicitacaoModelo(List.of(
                    new MensagemModelo(PapelMensagemModelo.SYSTEM,
                            "Explique de forma simples somente os dados fornecidos, sem acrescentar números."),
                    new MensagemModelo(PapelMensagemModelo.USER, dados)));
            politica.validarSolicitacaoModelo(solicitacao);
            return politica.protegerRespostaTexto(gateway.gerarRespostaFinal(solicitacao).conteudo());
        } catch (OrquestradorException | JsonProcessingException exception) {
            return respostaDeterministica(resultado);
        }
    }

    private String respostaDeterministica(ResultadoFerramenta resultado) {
        int quantidade = ((Number) resultado.dadosAgregados().get("itensCriticos")).intValue();
        return quantidade == 0 ? "Nenhum insumo está com estoque crítico no momento."
                : quantidade + (quantidade == 1 ? " insumo está" : " insumos estão")
                + " com estoque crítico. Consulte a lista para os detalhes.";
    }

    private ConversaResponseDTO resposta(String texto, ResultadoFerramenta resultado, String origem) {
        return new ConversaResponseDTO(texto, AiOrchestratorProperties.CONTRACT_VERSION,
                resultado.status().name(), resultado.dadosAgregados(), List.of(), origem,
                resultado.avisos(), resultado.qualidade().name(), null);
    }
}

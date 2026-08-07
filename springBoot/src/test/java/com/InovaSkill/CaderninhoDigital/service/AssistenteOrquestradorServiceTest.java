package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.gateway.*;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.ai.tool.ExecutorFerramentas;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.dto.request.AcaoRapidaAssistente;
import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.exception.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class AssistenteOrquestradorServiceTest {
    private final ModeloGateway gateway = mock(ModeloGateway.class);
    private final PlanoContratoValidator validator = mock(PlanoContratoValidator.class);
    private final ExecutorFerramentas executor = mock(ExecutorFerramentas.class);
    private final PoliticaDadosIa politica = mock(PoliticaDadosIa.class);
    private final AiOrchestratorProperties properties = new AiOrchestratorProperties();
    private AssistenteOrquestradorService service;

    @BeforeEach void setup() {
        when(politica.delimitarEntradaNaoConfiavel(anyString())).thenAnswer(i -> i.getArgument(0));
        when(politica.protegerRespostaTexto(anyString())).thenAnswer(i -> i.getArgument(0));
        service = new AssistenteOrquestradorService(properties, gateway, validator, executor, politica,
                new ObjectMapper().findAndRegisterModules());
    }

    @Test void acaoRapidaFuncionaSemModelo() {
        when(executor.executar(any(), any())).thenReturn(resultado(2));
        var request = request("Como está?", AcaoRapidaAssistente.VERIFICAR_ESTOQUE);
        assertThat(service.conversar(request).getResposta()).contains("2 insumos");
        verifyNoInteractions(gateway);
    }

    @Test void textoLivrePlanejaExecutaEUsaFallbackSeRespostaFinalFalhar() {
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(planoEstoque(), metadata()));
        when(executor.executar(any(), any())).thenReturn(resultado(1));
        when(gateway.gerarRespostaFinal(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT, "timeout"));
        assertThat(service.conversar(request("Quais insumos estão críticos?", null)).getResposta())
                .contains("1 insumo");
        verify(executor, times(1)).executar(any(), any());
    }

    @Test void reparaPlanoUmaUnicaVez() {
        when(gateway.gerarPlano(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.PLANO_INVALIDO, HttpStatus.BAD_GATEWAY, "json"))
                .thenReturn(new RespostaModelo<>(planoEstoque(), metadata()));
        when(executor.executar(any(), any())).thenReturn(resultado(0));
        when(gateway.gerarRespostaFinal(any())).thenReturn(new RespostaModelo<>("Estoque em ordem", metadata()));
        service.conversar(request("Veja o estoque", null));
        verify(gateway, times(2)).gerarPlano(any());
    }

    @Test void rejeitaOutraFerramentaSemExecutar() {
        var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.CONSULTAR_VENDAS,
                List.of(new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS,
                        new ArgumentosSemFiltro())), ModoResposta.TEXTO_SIMPLES);
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(plano, metadata()));
        assertThatThrownBy(() -> service.conversar(request("SELECT vendas", null)))
                .isInstanceOf(OrquestradorException.class);
        verifyNoInteractions(executor);
    }

    private ConversaRequestDTO request(String texto, AcaoRapidaAssistente acao) {
        var request = new ConversaRequestDTO(); request.setMensagem(texto); request.setAcaoRapida(acao); return request;
    }
    private PlanoOrquestracao planoEstoque() {
        return new PlanoOrquestracao("1.0", IntencaoOrquestrador.CONSULTAR_ESTOQUE,
                List.of(new ChamadaFerramenta(FerramentaPermitida.RESUMO_ESTOQUE,
                        new ArgumentosSemFiltro())), ModoResposta.TEXTO_COM_DADOS);
    }
    private ResultadoFerramenta resultado(int quantidade) {
        return new ResultadoFerramenta(FerramentaPermitida.RESUMO_ESTOQUE, StatusResultado.SUCESSO,
                Map.of("criterio", "estoqueAtual <= estoqueMinimo", "itensCriticos", quantidade,
                        "itensAvaliados", 3, "itens", List.of()), null, null, Instant.parse("2026-08-06T12:00:00Z"),
                List.of(), QualidadeResultado.COMPLETO);
    }
    private MetadadosModelo metadata() { return new MetadadosModelo("m", "m", 1, 1, 2, 1, false); }
}

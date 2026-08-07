package com.InovaSkill.CaderninhoDigital.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosPeriodo;
import com.InovaSkill.CaderninhoDigital.ai.contract.ChamadaFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.ai.contract.IntencaoOrquestrador;
import com.InovaSkill.CaderninhoDigital.ai.contract.ModoResposta;
import com.InovaSkill.CaderninhoDigital.ai.contract.PlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class AiContractsTest {

    @Test
    void serializaEDesserializaPlanoTipado() throws Exception {
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules()
                .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        PlanoOrquestracao plano = new PlanoOrquestracao(
                "1.0", IntencaoOrquestrador.CONSULTAR_VENDAS,
                List.of(new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS,
                        new ArgumentosPeriodo(LocalDate.parse("2026-01-01"), LocalDate.parse("2026-01-31")))),
                ModoResposta.TEXTO_COM_DADOS);

        String json = mapper.writeValueAsString(plano);
        PlanoOrquestracao restaurado = mapper.readValue(json, PlanoOrquestracao.class);

        assertThat(restaurado).isEqualTo(plano);
        assertThat(json).doesNotContain("sql", "url", "endpoint", "repository", "codigo");
    }

    @Test
    void rejeitaCampoGenericoEmPlanoFechado() {
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules()
                .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        String json = """
                {"schemaVersion":"1.0","intencao":"RESUMO_NEGOCIO","chamadas":[],
                 "modoResposta":"TEXTO_SIMPLES","sql":"select *"}
                """;

        assertThatThrownBy(() -> mapper.readValue(json, PlanoOrquestracao.class)).isInstanceOf(Exception.class);
    }

    @Test
    void rejeitaCampoExtraNaSolicitacaoHttp() {
        ObjectMapper mapper = new ObjectMapper();
        assertThatThrownBy(() -> mapper.readValue(
                "{\"mensagem\":\"oi\",\"usuarioId\":99}", ConversaRequestDTO.class))
                .isInstanceOf(Exception.class);
    }

    @Test
    void recursosFuturosNascemDesligados() {
        var flags = new AiOrchestratorProperties().getFeatures();
        assertThat(flags.isOrchestrator()).isTrue();
        assertThat(flags.isTools()).isTrue();
        assertThat(flags.isSearch()).isFalse();
        assertThat(flags.isCharts()).isFalse();
        assertThat(flags.isWrites()).isFalse();
    }
}

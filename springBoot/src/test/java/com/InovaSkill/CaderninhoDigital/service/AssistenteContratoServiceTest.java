package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.dto.request.AcaoRapidaAssistente;
import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.MensagemConversaDTO;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import java.util.List;
import org.junit.jupiter.api.Test;

class AssistenteContratoServiceTest {
    private final AiOrchestratorProperties properties = new AiOrchestratorProperties();
    private final AssistenteContratoService service = new AssistenteContratoService(properties);

    @Test
    void mantemCompatibilidadeComContratoAntigo() {
        ConversaRequestDTO request = new ConversaRequestDTO();
        request.setMensagem("  Como estão as vendas?  ");
        request.setHistorico(List.of());

        ConversaRequestDTO preparada = service.preparar(request);

        assertThat(preparada.getMensagem()).isEqualTo("Como estão as vendas?");
        assertThat(preparada.getVersaoContrato()).isEqualTo("1.0");
    }

    @Test
    void aceitaAcaoRapidaSemConfiarEmIdentidadeDoPayload() {
        ConversaRequestDTO request = new ConversaRequestDTO();
        request.setAcaoRapida(AcaoRapidaAssistente.VERIFICAR_ESTOQUE);

        assertThat(service.preparar(request).getMensagem()).isEqualTo("Como está o estoque?");
    }

    @Test
    void rejeitaVersaoDesconhecida() {
        ConversaRequestDTO request = new ConversaRequestDTO();
        request.setMensagem("Resumo");
        request.setVersaoContrato("2.0");

        assertThatThrownBy(() -> service.preparar(request))
                .isInstanceOfSatisfying(OrquestradorException.class,
                        error -> assertThat(error.getCodigo()).isEqualTo(CodigoErroOrquestrador.ENTRADA_INVALIDA));
    }

    @Test
    void aplicaLimitesExternosAoHistorico() {
        properties.getLimits().setHistoryMessages(1);
        MensagemConversaDTO item = new MensagemConversaDTO();
        item.setAutor("usuario");
        item.setTexto("Mensagem");
        ConversaRequestDTO request = new ConversaRequestDTO();
        request.setMensagem("Resumo");
        request.setHistorico(List.of(item, item));

        assertThatThrownBy(() -> service.preparar(request))
                .isInstanceOfSatisfying(OrquestradorException.class,
                        error -> assertThat(error.getCodigo()).isEqualTo(CodigoErroOrquestrador.LIMITE_EXCEDIDO));
    }
}

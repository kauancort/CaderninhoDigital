package com.InovaSkill.CaderninhoDigital.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class GlobalExceptionHandlerTest {

    @Test
    void retornaCodigoECorrelacaoSemDetalhesSensiveis() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/assistente/conversa");
        when(request.getHeader("X-Correlation-Id")).thenReturn("req-123");
        var exception = new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT, "A assistente demorou para responder");

        var response = new GlobalExceptionHandler().handleOrquestradorException(exception, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GATEWAY_TIMEOUT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo("TIMEOUT");
        assertThat(response.getBody().getCorrelationId()).isEqualTo("req-123");
        assertThat(response.getBody().getMessage()).doesNotContain("Exception", "stack", "payload");
    }

    @Test
    void erroInternoNaoExpoeMensagemComSegredo() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/assistente/conversa");

        var response = new GlobalExceptionHandler().handleGenericException(
                new IllegalStateException("OPENROUTER_API_KEY=segredo-nao-expor"), request);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage())
                .isEqualTo("Erro interno no servidor")
                .doesNotContain("segredo-nao-expor", "OPENROUTER_API_KEY");
    }
}

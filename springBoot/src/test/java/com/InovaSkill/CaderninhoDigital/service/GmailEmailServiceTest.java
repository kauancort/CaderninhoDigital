package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class GmailEmailServiceTest {
    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void renovaTokenEEnviaMensagemPelaGmailApi() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        GmailEmailService service = new GmailEmailService(
                builder,
                "client-id",
                "client-secret",
                "refresh-token",
                "docevocida12@gmail.com");

        server.expect(requestTo(TOKEN_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(content().string(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("client_id=client-id"),
                        org.hamcrest.Matchers.containsString("client_secret=client-secret"),
                        org.hamcrest.Matchers.containsString("refresh_token=refresh-token"),
                        org.hamcrest.Matchers.containsString("grant_type=refresh_token"))))
                .andRespond(withSuccess("{\"access_token\":\"access-token\"}", MediaType.APPLICATION_JSON));

        AtomicReference<String> mensagemRaw = new AtomicReference<>();
        server.expect(requestTo(SEND_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer access-token"))
                .andExpect(request -> {
                    String requestBody = ((MockClientHttpRequest) request).getBodyAsString();
                    JsonNode json = objectMapper.readTree(requestBody);
                    mensagemRaw.set(json.get("raw").asText());
                })
                .andRespond(withSuccess("{\"id\":\"message-id\"}", MediaType.APPLICATION_JSON));

        service.enviarCodigoRecuperacao("maria@teste.com", "Maria", "123456");

        server.verify();
        String mime = new String(
                Base64.getUrlDecoder().decode(mensagemRaw.get()),
                StandardCharsets.UTF_8);
        assertThat(mime)
                .contains("From: docevocida12@gmail.com")
                .contains("To: maria@teste.com")
                .contains("Content-Transfer-Encoding: base64");

        String corpoBase64 = mime.substring(mime.indexOf("\r\n\r\n") + 4);
        String corpo = new String(
                Base64.getMimeDecoder().decode(corpoBase64),
                StandardCharsets.UTF_8);
        assertThat(corpo)
                .contains("Olá, Maria.")
                .contains("Seu código de recuperação é: 123456")
                .contains("Esse código expira em 10 minutos.");
    }

    @Test
    void recusaEnvioSemCredenciaisConfiguradas() {
        GmailEmailService service = new GmailEmailService(
                RestClient.builder(), "", "", "", "docevocida12@gmail.com");

        assertThatThrownBy(() ->
                service.enviarCodigoRecuperacao("maria@teste.com", "Maria", "123456"))
                .isInstanceOf(EmailDeliveryException.class)
                .hasMessage("A integração com a Gmail API não está configurada no servidor.");
    }
}

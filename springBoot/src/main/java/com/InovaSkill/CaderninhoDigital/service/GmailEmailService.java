package com.InovaSkill.CaderninhoDigital.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class GmailEmailService implements EmailService {
    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;
    private final String refreshToken;
    private final String remetente;

    public GmailEmailService(
            RestClient.Builder restClientBuilder,
            @Value("${app.gmail.client-id}") String clientId,
            @Value("${app.gmail.client-secret}") String clientSecret,
            @Value("${app.gmail.refresh-token}") String refreshToken,
            @Value("${app.gmail.sender}") String remetente
    ) {
        this.restClient = restClientBuilder.build();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.refreshToken = refreshToken;
        this.remetente = remetente;
    }

    @Override
    public void enviarCodigoRecuperacao(String destinatario, String nome, String codigo) {
        validarConfiguracao();
        validarCabecalho(destinatario);

        try {
            String accessToken = obterAccessToken();
            restClient.post()
                    .uri(SEND_URL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> headers.setBearerAuth(accessToken))
                    .body(new GmailMessage(criarMensagemRaw(destinatario, nome, codigo)))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException exception) {
            throw new EmailDeliveryException("Não foi possível enviar o e-mail pela Gmail API.", exception);
        }
    }

    private String obterAccessToken() {
        MultiValueMap<String, String> formulario = new LinkedMultiValueMap<>();
        formulario.add("client_id", clientId);
        formulario.add("client_secret", clientSecret);
        formulario.add("refresh_token", refreshToken);
        formulario.add("grant_type", "refresh_token");

        TokenResponse resposta = restClient.post()
                .uri(TOKEN_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(formulario)
                .retrieve()
                .body(TokenResponse.class);
        if (resposta == null || resposta.accessToken() == null || resposta.accessToken().isBlank()) {
            throw new EmailDeliveryException("A Gmail API não retornou um access token.");
        }
        return resposta.accessToken();
    }

    private String criarMensagemRaw(String destinatario, String nome, String codigo) {
        String corpo = """
                Olá, %s.

                Recebemos uma solicitação para redefinir sua senha.

                Seu código de recuperação é: %s

                Esse código expira em 10 minutos.

                Se você não solicitou essa alteração, ignore este e-mail.
                """.formatted(nome, codigo);
        String assunto = Base64.getEncoder().encodeToString(
                "Código de recuperação — Caderninho Digital".getBytes(StandardCharsets.UTF_8));
        String corpoBase64 = Base64.getMimeEncoder(76, "\r\n".getBytes(StandardCharsets.US_ASCII))
                .encodeToString(corpo.getBytes(StandardCharsets.UTF_8));
        String mensagem = String.join("\r\n",
                "From: " + remetente,
                "To: " + destinatario,
                "Subject: =?UTF-8?B?" + assunto + "?=",
                "MIME-Version: 1.0",
                "Content-Type: text/plain; charset=UTF-8",
                "Content-Transfer-Encoding: base64",
                "",
                corpoBase64);
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(mensagem.getBytes(StandardCharsets.UTF_8));
    }

    private void validarConfiguracao() {
        if (clientId.isBlank() || clientSecret.isBlank() || refreshToken.isBlank() || remetente.isBlank()) {
            throw new EmailDeliveryException(
                    "A integração com a Gmail API não está configurada no servidor.");
        }
    }

    private void validarCabecalho(String destinatario) {
        Objects.requireNonNull(destinatario, "destinatario");
        if (destinatario.contains("\r") || destinatario.contains("\n")
                || remetente.contains("\r") || remetente.contains("\n")) {
            throw new EmailDeliveryException("Endereço de e-mail inválido.");
        }
    }

    private record TokenResponse(@JsonProperty("access_token") String accessToken) {}

    private record GmailMessage(String raw) {}
}

package com.InovaSkill.CaderninhoDigital.ai.search;

import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.springframework.stereotype.Component;

@Component
class JdkTavilyTransport implements TavilyTransport {
    private final HttpClient client;
    JdkTavilyTransport(AiOrchestratorProperties properties) {
        client = HttpClient.newBuilder().connectTimeout(
                java.time.Duration.ofMillis(properties.getLimits().getConnectTimeoutMs())).build();
    }
    public java.util.concurrent.CompletableFuture<Resposta> enviar(java.net.URI uri,
            java.util.Map<String,String> headers, String body, java.time.Duration timeout) {
        var builder = HttpRequest.newBuilder(uri).timeout(timeout)
                .POST(HttpRequest.BodyPublishers.ofString(body));
        headers.forEach(builder::header);
        return client.sendAsync(builder.build(), HttpResponse.BodyHandlers.ofString())
                .thenApply(r -> new Resposta(r.statusCode(), r.body()));
    }
}

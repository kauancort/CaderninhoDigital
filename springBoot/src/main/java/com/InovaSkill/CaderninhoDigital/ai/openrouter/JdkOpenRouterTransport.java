package com.InovaSkill.CaderninhoDigital.ai.openrouter;

import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.springframework.stereotype.Component;

@Component
class JdkOpenRouterTransport implements OpenRouterTransport {
    private final HttpClient httpClient;

    JdkOpenRouterTransport(AiOrchestratorProperties properties) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofMillis(properties.getLimits().getConnectTimeoutMs()))
                .build();
    }

    @Override
    public java.util.concurrent.CompletableFuture<OpenRouterHttpResponse> enviar(OpenRouterHttpRequest request) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(request.uri())
                .timeout(request.timeout())
                .POST(HttpRequest.BodyPublishers.ofString(request.body()));
        request.headers().forEach(builder::header);
        return httpClient.sendAsync(builder.build(), HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> new OpenRouterHttpResponse(response.statusCode(), response.body(),
                        response.headers().map().entrySet().stream()
                                .collect(java.util.stream.Collectors.toUnmodifiableMap(
                                        java.util.Map.Entry::getKey,
                                        entry -> entry.getValue().isEmpty() ? "" : entry.getValue().getFirst(),
                                        (first, ignored) -> first))));
    }
}

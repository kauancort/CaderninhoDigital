package com.InovaSkill.CaderninhoDigital.ai.openrouter;

import java.util.concurrent.CompletableFuture;

interface OpenRouterTransport {
    CompletableFuture<OpenRouterHttpResponse> enviar(OpenRouterHttpRequest request);
}

package com.InovaSkill.CaderninhoDigital.ai.search;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

interface TavilyTransport {
    CompletableFuture<Resposta> enviar(URI uri, Map<String,String> headers, String body, Duration timeout);
    record Resposta(int status, String body) {}
}

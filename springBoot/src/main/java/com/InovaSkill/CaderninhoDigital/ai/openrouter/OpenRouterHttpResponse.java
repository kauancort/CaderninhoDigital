package com.InovaSkill.CaderninhoDigital.ai.openrouter;

import java.util.Locale;
import java.util.Map;

record OpenRouterHttpResponse(int statusCode, String body, Map<String, String> headers) {
    OpenRouterHttpResponse(int statusCode, String body) {
        this(statusCode, body, Map.of());
    }

    String header(String name) {
        if (name == null || headers == null) return null;
        String wanted = name.toLowerCase(Locale.ROOT);
        return headers.entrySet().stream()
                .filter(entry -> entry.getKey() != null && entry.getKey().toLowerCase(Locale.ROOT).equals(wanted))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }
}

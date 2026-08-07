package com.InovaSkill.CaderninhoDigital.ai.openrouter;

import java.net.URI;
import java.time.Duration;
import java.util.Map;

record OpenRouterHttpRequest(URI uri, Map<String, String> headers, String body, Duration timeout) {}

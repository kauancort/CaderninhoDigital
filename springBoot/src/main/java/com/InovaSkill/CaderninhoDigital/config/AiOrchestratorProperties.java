package com.InovaSkill.CaderninhoDigital.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Data
@Validated
@Component
@ConfigurationProperties(prefix = "app.ai")
public class AiOrchestratorProperties {
    public static final String CONTRACT_VERSION = "1.1";
    public static final String LEGACY_CONTRACT_VERSION = "1.0";

    @Valid private Provider provider = new Provider();
    @Valid private Search search = new Search();
    @Valid private Limits limits = new Limits();
    @Valid private Features features = new Features();
    @NotBlank private String promptVersion = "1.0";
    @NotBlank private String schemaVersion = "1.0";

    @Data
    public static class Provider {
        private String key = "";
        @NotBlank private String url = "https://openrouter.ai/api/v1/chat/completions";
        @NotBlank private String model = "google/gemma-4-26b-a4b-it:free";
        private String fallbackModel = "";
    }

    @Data
    public static class Search {
        private String key = "";
        @NotBlank private String url = "https://api.tavily.com/search";
        @Min(100) private int timeoutMs = 35_000;
        @Min(100) private int interpretationTimeoutMs = 60_000;
        /** Orçamentos de extração podem conter várias fontes e muitos campos nulos. */
        @Min(512) @Max(20_000) private int interpretationMaxOutputTokens = 4_000;
        @Min(1) @Max(5) private int maxResults = 3;
        @Min(20) @Max(500) private int maxQueryCharacters = 180;
        @Min(100) @Max(4_000) private int maxSnippetCharacters = 4_000;
        @NotBlank private String defaultCity = "Marília";
        @NotBlank private String defaultState = "SP";
    }

    @Data
    public static class Limits {
        @Min(1) @Max(20_000) private int messageCharacters = 2_000;
        @Min(0) @Max(100) private int historyMessages = 30;
        @Min(1) @Max(20_000) private int historyMessageCharacters = 4_000;
        @Min(1) @Max(2) private int toolsPerPlan = 2;
        @Min(1) @Max(2) private int toolCalls = 2;
        @Min(0) @Max(5) private int planRepairs = 1;
        @Min(1) @Max(3_650) private int maxPeriodDays = 366;
        @Min(1) @Max(1_000) private int contextItems = 200;
        @Min(100) @Max(20_000) private int contextStringCharacters = 4_000;
        @Min(1) @Max(200) private int providerMessages = 40;
        @Min(1_000) @Max(200_000) private int providerPayloadCharacters = 30_000;
        @Min(1) private int maxOutputTokens = 1_000;
        @Min(100) private int connectTimeoutMs = 5_000;
        @Min(100) private int readTimeoutMs = 20_000;
        @Min(0) private long requestBudgetMillis = 70_000;
        @Min(1) private int requestsPerUserWindow = 20;
        @Min(1) private int requestsGlobalWindow = 100;
        @Min(1) private int rateWindowSeconds = 60;
        @Min(1) private int modelCallsPerUserDay = 100;
        @Min(1) private int modelCallsGlobalDay = 500;
        @Min(1) private long modelTokensPerUserDay = 100_000;
        @Min(1) private long modelTokensGlobalDay = 500_000;
        @Min(1) private int auditCapacity = 1_000;
        @Min(0) @Max(1) private int transientRetries = 1;
    }

    @Data
    public static class Features {
        private boolean orchestrator = true;
        private boolean tools = true;
        private boolean search = false;
        private boolean charts = false;
        private boolean writes = false;
    }
}

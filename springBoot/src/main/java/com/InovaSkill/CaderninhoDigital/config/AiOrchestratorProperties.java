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
    public static final String CONTRACT_VERSION = "1.0";

    @Valid private Provider provider = new Provider();
    @Valid private Limits limits = new Limits();
    @Valid private Features features = new Features();
    @NotBlank private String promptVersion = "1.0";
    @NotBlank private String schemaVersion = "1.0";

    @Data
    public static class Provider {
        private String key = "";
        @NotBlank private String url = "https://openrouter.ai/api/v1/chat/completions";
        @NotBlank private String model = "openrouter/free";
    }

    @Data
    public static class Limits {
        @Min(1) @Max(20_000) private int messageCharacters = 2_000;
        @Min(0) @Max(100) private int historyMessages = 30;
        @Min(1) @Max(20_000) private int historyMessageCharacters = 4_000;
        @Min(0) @Max(20) private int toolsPerPlan = 5;
        @Min(0) @Max(20) private int toolCalls = 5;
        @Min(0) @Max(5) private int planRepairs = 1;
        @Min(1) @Max(3_650) private int maxPeriodDays = 366;
        @Min(1) @Max(1_000) private int contextItems = 200;
        @Min(100) @Max(20_000) private int contextStringCharacters = 4_000;
        @Min(1) @Max(200) private int providerMessages = 40;
        @Min(1_000) @Max(200_000) private int providerPayloadCharacters = 30_000;
        @Min(1) private int maxOutputTokens = 1_000;
        @Min(100) private int connectTimeoutMs = 5_000;
        @Min(100) private int readTimeoutMs = 20_000;
        @Min(0) private long requestBudgetMillis = 30_000;
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

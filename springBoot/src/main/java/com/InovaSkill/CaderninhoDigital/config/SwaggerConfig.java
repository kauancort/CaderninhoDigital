package com.InovaSkill.CaderninhoDigital.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI caderninhoOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Caderninho Digital Inteligente API")
                        .description("API do MVP do Caderninho Digital Inteligente")
                        .version("v1"));
    }
}

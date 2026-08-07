package com.InovaSkill.CaderninhoDigital.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.MapperFeature;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

@Configuration
public class AiContractConfig {

    @Bean
    @Qualifier("aiContractObjectMapper")
    ObjectMapper aiContractObjectMapper(Jackson2ObjectMapperBuilder objectMapperBuilder) {
        return objectMapperBuilder.build()
                .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
                .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }
}

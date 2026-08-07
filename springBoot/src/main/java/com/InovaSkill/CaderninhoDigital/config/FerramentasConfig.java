package com.InovaSkill.CaderninhoDigital.config;

import com.InovaSkill.CaderninhoDigital.ai.tool.CatalogoFerramentas;
import com.InovaSkill.CaderninhoDigital.ai.tool.ContextoFerramentaFactory;
import com.InovaSkill.CaderninhoDigital.ai.tool.ExecutorFerramentas;
import com.InovaSkill.CaderninhoDigital.ai.stock.ConsultarEstoqueCriticoFerramenta;
import jakarta.validation.Validator;
import java.time.Clock;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FerramentasConfig {

    @Bean
    CatalogoFerramentas catalogoFerramentas(ConsultarEstoqueCriticoFerramenta estoqueCritico) {
        return new CatalogoFerramentas(List.of(estoqueCritico));
    }

    @Bean(destroyMethod = "close")
    ExecutorService executorFerramentasService() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean
    ContextoFerramentaFactory contextoFerramentaFactory(
            Clock clock,
            AiOrchestratorProperties properties
    ) {
        return new ContextoFerramentaFactory(clock, properties);
    }

    @Bean
    ExecutorFerramentas executorFerramentas(
            CatalogoFerramentas catalogo,
            ContextoFerramentaFactory contextoFactory,
            AiOrchestratorProperties properties,
            Validator validator,
            ExecutorService executorFerramentasService
    ) {
        return new ExecutorFerramentas(
                catalogo, contextoFactory, properties, validator, executorFerramentasService);
    }
}

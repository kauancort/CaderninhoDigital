package com.InovaSkill.CaderninhoDigital.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.ai.tool.CatalogoFerramentas;
import com.InovaSkill.CaderninhoDigital.ai.tool.ExecutorFerramentas;
import com.InovaSkill.CaderninhoDigital.ai.stock.ConsultarEstoqueCriticoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.stock.ConsultaEstoqueCriticoService;
import static org.mockito.Mockito.mock;
import jakarta.validation.Validator;
import org.hibernate.validator.messageinterpolation.ParameterMessageInterpolator;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

class FerramentasConfigTest {

    @Test
    void inicializaBeansSemDescobertaDinamicaOuConflito() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.register(AiOrchestratorProperties.class, TimeConfig.class, FerramentasConfig.class);
            context.registerBean(ConsultaEstoqueCriticoService.class,
                    () -> mock(ConsultaEstoqueCriticoService.class));
            context.registerBean(ConsultarEstoqueCriticoFerramenta.class,
                    () -> new ConsultarEstoqueCriticoFerramenta(context.getBean(ConsultaEstoqueCriticoService.class)));
            context.registerBean(Validator.class, () -> {
                LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
                validator.setMessageInterpolator(new ParameterMessageInterpolator());
                validator.afterPropertiesSet();
                return validator;
            });
            context.refresh();

            assertThat(context.getBean(CatalogoFerramentas.class).metadadosParaPlanejamento()).hasSize(1);
            assertThat(context.getBeansOfType(ExecutorFerramentas.class)).hasSize(1);
        }
    }
}

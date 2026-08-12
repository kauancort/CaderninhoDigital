package com.InovaSkill.CaderninhoDigital.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.ai.tool.CatalogoFerramentas;
import com.InovaSkill.CaderninhoDigital.ai.tool.ExecutorFerramentas;
import com.InovaSkill.CaderninhoDigital.ai.stock.ConsultarEstoqueCriticoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.stock.ConsultaEstoqueCriticoService;
import com.InovaSkill.CaderninhoDigital.ai.finance.ConsultarResumoGastosFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.finance.ConsultarResumoRecebiveisFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.finance.ConsultarResumoVendasFerramenta;
import com.InovaSkill.CaderninhoDigital.repository.LancamentoRepository;
import com.InovaSkill.CaderninhoDigital.service.UsuarioAcessoService;
import com.InovaSkill.CaderninhoDigital.service.VendaService;
import com.InovaSkill.CaderninhoDigital.ai.cost.AnalisarComprasInsumoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.cost.AnalisarCustoProdutoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.cost.AnaliseComprasInsumoService;
import com.InovaSkill.CaderninhoDigital.ai.cost.AnaliseCustoProdutoService;
import com.InovaSkill.CaderninhoDigital.ai.search.CompararPrecoMercadoFerramenta;
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
            context.registerBean(ConsultarResumoVendasFerramenta.class,
                    () -> new ConsultarResumoVendasFerramenta(mock(VendaService.class)));
            context.registerBean(ConsultarResumoGastosFerramenta.class,
                    () -> new ConsultarResumoGastosFerramenta(
                            mock(LancamentoRepository.class), mock(UsuarioAcessoService.class)));
            context.registerBean(ConsultarResumoRecebiveisFerramenta.class,
                    () -> new ConsultarResumoRecebiveisFerramenta(mock(VendaService.class)));
            context.registerBean(AnalisarCustoProdutoFerramenta.class,
                    () -> new AnalisarCustoProdutoFerramenta(mock(AnaliseCustoProdutoService.class)));
            context.registerBean(AnalisarComprasInsumoFerramenta.class,
                    () -> new AnalisarComprasInsumoFerramenta(mock(AnaliseComprasInsumoService.class)));
            context.registerBean(CompararPrecoMercadoFerramenta.class,
                    () -> mock(CompararPrecoMercadoFerramenta.class));
            context.registerBean(Validator.class, () -> {
                LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
                validator.setMessageInterpolator(new ParameterMessageInterpolator());
                validator.afterPropertiesSet();
                return validator;
            });
            context.refresh();

            assertThat(context.getBean(CatalogoFerramentas.class).metadadosParaPlanejamento()).hasSize(6);
            assertThat(context.getBeansOfType(ExecutorFerramentas.class)).hasSize(1);
        }
    }
}

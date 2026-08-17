package com.InovaSkill.CaderninhoDigital.config;

import com.InovaSkill.CaderninhoDigital.ai.tool.CatalogoFerramentas;
import com.InovaSkill.CaderninhoDigital.ai.tool.ContextoFerramentaFactory;
import com.InovaSkill.CaderninhoDigital.ai.tool.ExecutorFerramentas;
import com.InovaSkill.CaderninhoDigital.ai.stock.ConsultarEstoqueCriticoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.finance.ConsultarResumoGastosFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.finance.ConsultarResumoRecebiveisFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.finance.ConsultarResumoVendasFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.cost.AnalisarComprasInsumoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.cost.AnalisarCustoProdutoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.cost.AnalisarMargemProdutoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.search.CompararPrecoMercadoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.profit.AnalisarRentabilidadeProdutoFerramenta;
import jakarta.validation.Validator;
import java.time.Clock;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FerramentasConfig {

    @Bean
    CatalogoFerramentas catalogoFerramentas(ConsultarEstoqueCriticoFerramenta estoqueCritico,
            ConsultarResumoVendasFerramenta vendas, ConsultarResumoGastosFerramenta gastos,
            ConsultarResumoRecebiveisFerramenta recebiveis, AnalisarCustoProdutoFerramenta custoProduto,
            AnalisarMargemProdutoFerramenta margemProduto, AnalisarComprasInsumoFerramenta comprasInsumo,
            AnalisarRentabilidadeProdutoFerramenta rentabilidadeProduto,
            CompararPrecoMercadoFerramenta mercado,
            AiOrchestratorProperties properties) {
        var ferramentas = new java.util.ArrayList<com.InovaSkill.CaderninhoDigital.ai.tool.FerramentaLeitura<?>>(
                List.of(estoqueCritico, vendas, gastos, recebiveis, custoProduto, margemProduto,
                        rentabilidadeProduto, comprasInsumo));
        if (properties.getFeatures().isSearch()) ferramentas.add(mercado);
        return new CatalogoFerramentas(ferramentas);
    }

    @Bean(destroyMethod = "close")
    ExecutorService executorFerramentasService() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean
    ContextoFerramentaFactory contextoFerramentaFactory(
            Clock clock,
            AiOrchestratorProperties properties,
            UsuarioRepository usuarios
    ) {
        return new ContextoFerramentaFactory(clock, properties, usuarios);
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

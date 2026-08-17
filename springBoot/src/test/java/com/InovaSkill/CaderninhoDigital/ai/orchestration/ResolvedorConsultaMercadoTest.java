package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosComparacaoMercado;
import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.Test;

class ResolvedorConsultaMercadoTest {
    @Test void resolveNomeCadastradoSemExigirIdOuCidade() {
        var repo=mock(MateriaPrimaRepository.class);
        when(repo.listarAcessiveisParaAnalise(7L)).thenReturn(List.of(MateriaPrima.builder().id(9L)
                .nome("Açúcar demerara").unidadeMedida("kg").ativo(true).build()));
        var props=new AiOrchestratorProperties(); props.getFeatures().setSearch(true);
        var resolvedor=new ResolvedorConsultaMercado(repo,props,
                Clock.fixed(Instant.parse("2026-08-11T12:00:00Z"),ZoneId.of("America/Sao_Paulo")));
        var chamada=resolvedor.resolver("Estou pagando caro por 10 kg de açúcar demerara?", 7L);
        assertThat(chamada.ferramenta()).isEqualTo(FerramentaPermitida.COMPARAR_PRECO_MERCADO);
        var args=(ArgumentosComparacaoMercado)chamada.argumentos();
        assertThat(args.materiaPrimaId()).isEqualTo(9L); assertThat(args.cidade()).isEqualTo("Marília");
        assertThat(args.uf()).isEqualTo("SP");
    }

    @Test void nomeAmbiguoFalhaFechado() {
        var repo=mock(MateriaPrimaRepository.class);
        when(repo.listarAcessiveisParaAnalise(7L)).thenReturn(List.of(
                MateriaPrima.builder().id(1L).nome("Açúcar").ativo(true).build(),
                MateriaPrima.builder().id(2L).nome("Açúcar demerara").ativo(true).build()));
        var props=new AiOrchestratorProperties(); props.getFeatures().setSearch(true);
        assertThat(new ResolvedorConsultaMercado(repo,props,Clock.systemUTC())
                .resolver("Compare 10 kg de açúcar demerara no mercado", 7L)).isNull();
    }

    @Test void resolveApelidoLeiteParaVarianteLiquidaMenosEspecifica() {
        var repo=mock(MateriaPrimaRepository.class);
        when(repo.listarAcessiveisParaAnalise(7L)).thenReturn(List.of(
                MateriaPrima.builder().id(5L).nome("Leite integral").unidadeMedida("L").ativo(true).build(),
                MateriaPrima.builder().id(6L).nome("Leite em pó integral").unidadeMedida("kg").ativo(true).build(),
                MateriaPrima.builder().id(12L).nome("Leite condensado").unidadeMedida("kg").ativo(true).build()));
        var props=new AiOrchestratorProperties(); props.getFeatures().setSearch(true);
        var resolvedor=new ResolvedorConsultaMercado(repo,props,Clock.systemUTC());

        var chamada=resolvedor.resolver("Estou pagando caro no leite?", 7L);

        assertThat(((ArgumentosComparacaoMercado) chamada.argumentos()).materiaPrimaId()).isEqualTo(5L);
    }

    @Test void mencaoExplicitaDeLeiteEmPoSelecionaVarianteCorreta() {
        var repo=mock(MateriaPrimaRepository.class);
        when(repo.listarAcessiveisParaAnalise(7L)).thenReturn(List.of(
                MateriaPrima.builder().id(5L).nome("Leite integral").unidadeMedida("L").ativo(true).build(),
                MateriaPrima.builder().id(6L).nome("Leite em pó integral").unidadeMedida("kg").ativo(true).build()));
        var props=new AiOrchestratorProperties(); props.getFeatures().setSearch(true);
        var resolvedor=new ResolvedorConsultaMercado(repo,props,Clock.systemUTC());

        var chamada=resolvedor.resolver("Estou pagando caro no leite em pó?", 7L);

        assertThat(((ArgumentosComparacaoMercado) chamada.argumentos()).materiaPrimaId()).isEqualTo(6L);
    }
}

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
        when(repo.findAllByOrderByNomeAsc()).thenReturn(List.of(MateriaPrima.builder().id(9L)
                .nome("Açúcar demerara").unidadeMedida("kg").ativo(true).build()));
        var props=new AiOrchestratorProperties(); props.getFeatures().setSearch(true);
        var resolvedor=new ResolvedorConsultaMercado(repo,props,
                Clock.fixed(Instant.parse("2026-08-11T12:00:00Z"),ZoneId.of("America/Sao_Paulo")));
        var chamada=resolvedor.resolver("Estou pagando caro por 10 kg de açúcar demerara?");
        assertThat(chamada.ferramenta()).isEqualTo(FerramentaPermitida.COMPARAR_PRECO_MERCADO);
        var args=(ArgumentosComparacaoMercado)chamada.argumentos();
        assertThat(args.materiaPrimaId()).isEqualTo(9L); assertThat(args.cidade()).isEqualTo("Marília");
        assertThat(args.uf()).isEqualTo("SP");
    }

    @Test void nomeAmbiguoFalhaFechado() {
        var repo=mock(MateriaPrimaRepository.class);
        when(repo.findAllByOrderByNomeAsc()).thenReturn(List.of(
                MateriaPrima.builder().id(1L).nome("Açúcar").ativo(true).build(),
                MateriaPrima.builder().id(2L).nome("Açúcar demerara").ativo(true).build()));
        var props=new AiOrchestratorProperties(); props.getFeatures().setSearch(true);
        assertThat(new ResolvedorConsultaMercado(repo,props,Clock.systemUTC())
                .resolver("Compare 10 kg de açúcar demerara no mercado")).isNull();
    }
}

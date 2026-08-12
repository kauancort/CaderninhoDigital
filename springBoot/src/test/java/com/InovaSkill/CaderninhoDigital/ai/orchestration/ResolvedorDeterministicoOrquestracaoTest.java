package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class ResolvedorDeterministicoOrquestracaoTest {
    private static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");
    private final ResolvedorDeterministicoOrquestracao resolvedor = new ResolvedorDeterministicoOrquestracao(
            new AiOrchestratorProperties(), Clock.fixed(Instant.parse("2026-08-08T14:00:00Z"), FUSO));

    @Test
    void resolveHojeESemanaAtualNoFusoConfigurado() {
        assertThat(argumentos("Quanto vendemos hoje?")).isEqualTo(
                new ArgumentosPeriodo(LocalDate.parse("2026-08-08"), LocalDate.parse("2026-08-08")));
        assertThat(argumentos("Quanto vendemos esta semana?")).isEqualTo(
                new ArgumentosPeriodo(LocalDate.parse("2026-08-03"), LocalDate.parse("2026-08-08")));
    }

    @Test
    void rejeitaDataInexistenteEIntervaloComUmaData() {
        assertThatThrownBy(() -> resolvedor.consultaDireta("Vendas de 31/02/2026 a 05/03/2026"))
                .isInstanceOfSatisfying(OrquestradorException.class,
                        erro -> assertThat(erro.getCodigo()).isEqualTo(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS));
        assertThatThrownBy(() -> resolvedor.consultaDireta("Vendas em 01/08/2026"))
                .isInstanceOf(OrquestradorException.class);
    }

    @Test
    void comparaMesAtualParcialComMesAnteriorPelosMesmosDias() {
        PlanoOrquestracao plano = resolvedor.comparacaoDireta(
                "Compare minhas vendas do mês passado com este mês");
        assertThat(plano.chamadas()).extracting(chamada -> (ArgumentosPeriodo) chamada.argumentos())
                .containsExactly(
                        new ArgumentosPeriodo(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-08")),
                        new ArgumentosPeriodo(LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-08")));
    }

    @Test
    void resolveMesAnteriorNaViradaDoAnoEAnoBissexto() {
        var virada = new ResolvedorDeterministicoOrquestracao(new AiOrchestratorProperties(),
                Clock.fixed(Instant.parse("2027-01-10T12:00:00Z"), FUSO));
        assertThat((ArgumentosPeriodo) virada.consultaDireta("Vendas do mês passado").argumentos())
                .isEqualTo(new ArgumentosPeriodo(LocalDate.parse("2026-12-01"), LocalDate.parse("2026-12-31")));
        var bissexto = new ResolvedorDeterministicoOrquestracao(new AiOrchestratorProperties(),
                Clock.fixed(Instant.parse("2024-03-10T12:00:00Z"), FUSO));
        assertThat((ArgumentosPeriodo) bissexto.consultaDireta("Vendas do mês anterior").argumentos())
                .isEqualTo(new ArgumentosPeriodo(LocalDate.parse("2024-02-01"), LocalDate.parse("2024-02-29")));
    }

    @Test
    void resolvePerguntaAmplaDeComprasSemExigirIdDoGestor() {
        ChamadaFerramenta chamada = resolvedor.consultaDireta(
                "Estou gastando de forma desnecessária comprando matéria-prima?");
        assertThat(chamada.ferramenta()).isEqualTo(FerramentaPermitida.ANALISE_COMPRAS_INSUMO);
        assertThat(chamada.argumentos()).isEqualTo(new ArgumentosCompraInsumo(null,
                LocalDate.parse("2026-02-09"), LocalDate.parse("2026-08-08")));
    }

    @Test
    void comparacaoDeMercadoUsaMariliaSpQuandoLocalNaoFoiInformado() {
        var props = new AiOrchestratorProperties(); props.getFeatures().setSearch(true);
        var comPesquisa = new ResolvedorDeterministicoOrquestracao(props,
                Clock.fixed(Instant.parse("2026-08-08T14:00:00Z"), FUSO));
        ChamadaFerramenta chamada = comPesquisa.consultaDireta(
                "Compare o preço de 10 kg da matéria-prima 9 entre 01/02/2026 e 31/07/2026");
        assertThat(chamada.ferramenta()).isEqualTo(FerramentaPermitida.COMPARAR_PRECO_MERCADO);
        var argumentos = (ArgumentosComparacaoMercado) chamada.argumentos();
        assertThat(argumentos.cidade()).isEqualTo("Marília");
        assertThat(argumentos.uf()).isEqualTo("SP");
        assertThat(argumentos.quantidadeAlvo()).isEqualByComparingTo("10");
    }

    @Test
    void localInformadoSubstituiPadrao() {
        var props = new AiOrchestratorProperties(); props.getFeatures().setSearch(true);
        var comPesquisa = new ResolvedorDeterministicoOrquestracao(props,
                Clock.fixed(Instant.parse("2026-08-08T14:00:00Z"), FUSO));
        var argumentos = (ArgumentosComparacaoMercado) comPesquisa.consultaDireta(
                "Compare o preço de 5 kg da matéria-prima 10 em Bauru/SP entre 01/02/2026 e 31/07/2026")
                .argumentos();
        assertThat(argumentos.cidade()).isEqualTo("Bauru");
        assertThat(argumentos.uf()).isEqualTo("SP");
    }

    private ArgumentosPeriodo argumentos(String mensagem) {
        return (ArgumentosPeriodo) resolvedor.consultaDireta(mensagem).argumentos();
    }
}

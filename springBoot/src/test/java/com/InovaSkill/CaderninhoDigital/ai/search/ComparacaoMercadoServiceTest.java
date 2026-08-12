package com.InovaSkill.CaderninhoDigital.ai.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.InovaSkill.CaderninhoDigital.ai.contract.QualidadeResultado;
import com.InovaSkill.CaderninhoDigital.ai.cost.AnaliseComprasInsumoService;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.net.URI;
import java.time.*;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ComparacaoMercadoServiceTest {
    private final AnaliseComprasInsumoService interna=mock(AnaliseComprasInsumoService.class);
    private final MateriaPrimaRepository materias=mock(MateriaPrimaRepository.class);
    private final PesquisaPrecosGateway pesquisa=mock(PesquisaPrecosGateway.class);
    private final Clock clock=Clock.fixed(Instant.parse("2026-08-09T12:00:00Z"),ZoneOffset.UTC);
    private final ComparacaoMercadoService service=new ComparacaoMercadoService(interna,materias,pesquisa,clock);

    @BeforeEach void preparar() {
        when(materias.findById(3L)).thenReturn(Optional.of(MateriaPrima.builder()
                .id(3L).nome("Amendoim").unidadeMedida("kg").build()));
        var item=new AnaliseComprasInsumoService.Item(3L,"kg",new BigDecimal("10"),new BigDecimal("100"),
                new BigDecimal("10"),BigDecimal.TEN,BigDecimal.TEN,BigDecimal.ZERO,2,new BigDecimal("5"),
                LocalDate.parse("2026-07-01"),LocalDate.parse("2026-07-15"),14L,"QUINZENAL",true);
        when(interna.analisar(anyLong(),eq(3L),any(),any())).thenReturn(new AnaliseComprasInsumoService.Resultado(
                3L,LocalDate.parse("2026-07-01"),LocalDate.parse("2026-07-31"),new BigDecimal("100"),1,
                List.of(item),null,List.of(),QualidadeResultado.PARCIAL));
    }

    @Test void calculaEconomiaComFreteEPedidoMinimo() {
        configurarFonte("R$ 8,00 por kg. Pedido mínimo 12 kg. Frete R$ 5,00");
        var r=comparar();
        assertThat(r.custoInternoComparavel()).isEqualByComparingTo("100.00");
        assertThat(r.menorCustoExterno()).isEqualByComparingTo("101.00");
        assertThat(r.economiaEstimada()).isEqualByComparingTo("0.00");
        assertThat(r.ofertas().getFirst().quantidadeCalculada()).isEqualByComparingTo("12");
    }

    @Test void excluiUnidadeIncompativelEPromocaoVencida() {
        when(pesquisa.pesquisar(any())).thenReturn(new ResultadoPesquisaPrecos("q",Instant.now(clock),List.of(
                fonte("R$ 2,00 por litro"), fonte("R$ 8,00 por kg. Válido até 01/08/2026")),List.of()));
        assertThat(comparar().ofertas()).isEmpty();
    }

    @Test void escolheMelhorEntreMultiplasFontesSemInventarFrete() {
        when(pesquisa.pesquisar(any())).thenReturn(new ResultadoPesquisaPrecos("q",Instant.now(clock),List.of(
                fonte("R$ 9,00 por kg"), fonte("R$ 8,50 por kg")),List.of()));
        var r=comparar();
        assertThat(r.menorCustoExterno()).isEqualByComparingTo("85.00");
        assertThat(r.economiaEstimada()).isEqualByComparingTo("15.00");
        assertThat(r.avisos()).anyMatch(a -> a.contains("não foram estimados"));
    }

    @Test void converteEmbalagemDeQuinhentosGramasParaKg() {
        configurarFonte("Açúcar demerara 500 g por R$ 6,00");
        var r=comparar();
        assertThat(r.ofertas().getFirst().precoUnitario()).isEqualByComparingTo("12.0000");
        assertThat(r.menorCustoExterno()).isEqualByComparingTo("120.00");
    }

    @Test void falhaExternaPreservaAnaliseInterna() {
        when(pesquisa.pesquisar(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT,HttpStatus.GATEWAY_TIMEOUT,"indisponível"));
        var r=comparar();
        assertThat(r.custoInternoComparavel()).isEqualByComparingTo("100.00");
        assertThat(r.ofertas()).isEmpty(); assertThat(r.avisos()).anyMatch(a -> a.contains("preservada"));
    }

    private ComparacaoMercadoService.Resultado comparar(){return service.comparar(7L,3L,
            LocalDate.parse("2026-07-01"),LocalDate.parse("2026-07-31"),"kg",BigDecimal.TEN,"Belo Horizonte","MG");}
    private void configurarFonte(String trecho){when(pesquisa.pesquisar(any())).thenReturn(new ResultadoPesquisaPrecos(
            "q",Instant.now(clock),List.of(fonte(trecho)),List.of()));}
    private FontePesquisaPreco fonte(String trecho){return new FontePesquisaPreco("Loja",URI.create("https://loja.example/item"),"loja.example",trecho);}
}

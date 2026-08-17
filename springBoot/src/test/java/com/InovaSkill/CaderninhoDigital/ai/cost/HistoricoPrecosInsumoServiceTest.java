package com.InovaSkill.CaderninhoDigital.ai.cost;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.repository.CompraMateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class HistoricoPrecosInsumoServiceTest {
    private final CompraMateriaPrimaRepository compras = mock(CompraMateriaPrimaRepository.class);
    private final ProducaoRepository producoes = mock(ProducaoRepository.class);
    private final HistoricoPrecosInsumoService service = new HistoricoPrecosInsumoService(compras, producoes);

    @Test
    void calculaJanelasComMediaPonderadaConsumoETendenciaSemInventarCausa() {
        LocalDate referencia = LocalDate.of(2026, 8, 15);
        var historico = List.of(
                item("2026-08-10", "10", "60", "6"),
                item("2026-07-15", "20", "100", "5"),
                item("2026-03-01", "30", "120", "4"));
        when(compras.historicoPrecos(11L, 7L, LocalDate.of(2026, 2, 16), referencia)).thenReturn(historico);
        when(producoes.consumoMateriaPrima(11L, 7L, LocalDate.of(2026, 5, 18), referencia))
                .thenReturn(new BigDecimal("105"));

        var resultado = service.analisar(11L, 7L, referencia);

        assertThat(resultado.ultimaCompra().precoUnitario()).isEqualByComparingTo("6");
        assertThat(resultado.ultimos30Dias().precoMedioPonderado()).isEqualByComparingTo("6.0000");
        assertThat(resultado.ultimos90Dias().precoMedioPonderado()).isEqualByComparingTo("5.3333");
        assertThat(resultado.ultimos6Meses().precoMedioPonderado()).isEqualByComparingTo("4.6667");
        assertThat(resultado.ultimos6Meses().menorPreco()).isEqualByComparingTo("4");
        assertThat(resultado.ultimos6Meses().maiorPreco()).isEqualByComparingTo("6");
        assertThat(resultado.ultimos6Meses().quantidadeComprada()).isEqualByComparingTo("60");
        assertThat(resultado.consumoMedioMensal()).isEqualByComparingTo("35.000");
        assertThat(resultado.tendencia()).isEqualTo("AUMENTO_RECENTE");
        verify(compras).historicoPrecos(11L, 7L, LocalDate.of(2026, 2, 16), referencia);
    }

    @Test
    void historicoVazioMantemValoresAusentes() {
        LocalDate referencia = LocalDate.of(2026, 8, 15);
        when(compras.historicoPrecos(11L, 7L, LocalDate.of(2026, 2, 16), referencia)).thenReturn(List.of());
        when(producoes.consumoMateriaPrima(11L, 7L, LocalDate.of(2026, 5, 18), referencia)).thenReturn(null);

        var resultado = service.analisar(11L, 7L, referencia);

        assertThat(resultado.ultimaCompra()).isNull();
        assertThat(resultado.ultimos30Dias().precoMedioPonderado()).isNull();
        assertThat(resultado.consumoMedioMensal()).isNull();
        assertThat(resultado.tendencia()).isEqualTo("DADOS_INSUFICIENTES");
    }

    private CompraMateriaPrimaRepository.HistoricoPrecoCompraProjection item(
            String data, String quantidade, String total, String unitario) {
        var item = mock(CompraMateriaPrimaRepository.HistoricoPrecoCompraProjection.class);
        when(item.getDataCompra()).thenReturn(LocalDate.parse(data));
        when(item.getQuantidade()).thenReturn(new BigDecimal(quantidade));
        when(item.getValorTotal()).thenReturn(new BigDecimal(total));
        when(item.getValorUnitario()).thenReturn(new BigDecimal(unitario));
        return item;
    }
}

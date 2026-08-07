package com.InovaSkill.CaderninhoDigital.ai.stock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;

class ConsultaEstoqueCriticoServiceTest {
    private final MateriaPrimaRepository repository = mock(MateriaPrimaRepository.class);
    private final PoliticaDadosIa politica = mock(PoliticaDadosIa.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-08-06T12:00:00Z"), ZoneOffset.UTC);

    @Test
    void classificaIgualZeroENegativoSemEscrever() {
        when(politica.rotuloOperacionalPermitido(anyString())).thenReturn(true);
        var linhas = List.of(linha("Farinha", "kg", "2", "2"), linha("Açúcar", "kg", "0", "1"),
                linha("Sal", "kg", "-1", "1"), linha("Leite", "l", "5", "2"));
        when(repository.listarDadosEstoqueAtivos(any())).thenReturn(linhas);
        var resultado = new ConsultaEstoqueCriticoService(repository, politica, clock,
                new AiOrchestratorProperties()).consultar();
        assertThat(resultado.itensCriticos()).isEqualTo(3);
        assertThat(resultado.itens()).extracting(ConsultaEstoqueCriticoService.Item::nome)
                .containsExactly("Farinha", "Açúcar", "Sal");
        verify(repository).listarDadosEstoqueAtivos(any());
        verifyNoMoreInteractions(repository);
    }

    @Test
    void omiteDadosIncompletosETrataListaVazia() {
        when(politica.rotuloOperacionalPermitido(anyString())).thenReturn(true);
        var incompleta = linha("Item", null, "1", null);
        when(repository.listarDadosEstoqueAtivos(any())).thenReturn(List.of(incompleta));
        var service = new ConsultaEstoqueCriticoService(repository, politica, clock,
                new AiOrchestratorProperties());
        assertThat(service.consultar().dadosInsuficientes()).isEqualTo(1);
        when(repository.listarDadosEstoqueAtivos(any())).thenReturn(List.of());
        assertThat(service.consultar().itensCriticos()).isZero();
    }

    private MateriaPrimaRepository.EstoqueCriticoProjection linha(String nome, String unidade,
            String atual, String minimo) {
        var linha = mock(MateriaPrimaRepository.EstoqueCriticoProjection.class);
        when(linha.getNome()).thenReturn(nome); when(linha.getUnidadeMedida()).thenReturn(unidade);
        when(linha.getEstoqueAtual()).thenReturn(atual == null ? null : new BigDecimal(atual));
        when(linha.getEstoqueMinimo()).thenReturn(minimo == null ? null : new BigDecimal(minimo));
        return linha;
    }
}

package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.entity.HistoricoCustoMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.HistoricoCustoProduto;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.repository.HistoricoCustoMateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.HistoricoCustoProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.HistoricoPrecoProdutoRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HistoricoValorServiceTest {

    @Mock
    private HistoricoPrecoProdutoRepository precos;
    @Mock
    private HistoricoCustoMateriaPrimaRepository custos;
    @Mock
    private HistoricoCustoProdutoRepository custosProduto;

    private HistoricoValorService service;

    @BeforeEach
    void configurar() {
        service = new HistoricoValorService(precos, custos, custosProduto);
    }

    @Test
    void registraCompraComOrigemCorreta() {
        MateriaPrima materia = MateriaPrima.builder()
                .id(10L)
                .custoMedio(new BigDecimal("12.50"))
                .build();
        Usuario usuario = Usuario.builder().id(2L).build();
        when(custos.findFirstByMateriaPrimaIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(10L))
                .thenReturn(Optional.empty());

        service.registrarCusto(
                materia, usuario, new BigDecimal("10.00"), "Custo recalculado", "COMPRA");

        ArgumentCaptor<HistoricoCustoMateriaPrima> captor =
                ArgumentCaptor.forClass(HistoricoCustoMateriaPrima.class);
        verify(custos).save(captor.capture());
        assertThat(captor.getValue().getOrigem()).isEqualTo("COMPRA");
        assertThat(captor.getValue().getCusto()).isEqualByComparingTo("12.50");
    }

    @Test
    void naoRegistraAlteracaoQuandoApenasAEscalaDecimalMuda() {
        MateriaPrima materia = MateriaPrima.builder()
                .id(10L)
                .custoMedio(new BigDecimal("10.00"))
                .build();

        service.registrarCusto(
                materia, Usuario.builder().id(2L).build(), new BigDecimal("10.0"), "Sem mudança", "COMPRA");

        verify(custos, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void criaPrimeiroHistoricoDeCustoDoProduto() {
        Produto produto = Produto.builder()
                .id(20L)
                .custoAtual(new BigDecimal("4.75"))
                .build();
        when(custosProduto.findFirstByProdutoIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(20L))
                .thenReturn(Optional.empty());

        service.registrarCustoProduto(
                produto, Usuario.builder().id(2L).build(), null, "Custo inicial", "PRODUCAO");

        ArgumentCaptor<HistoricoCustoProduto> captor =
                ArgumentCaptor.forClass(HistoricoCustoProduto.class);
        verify(custosProduto).save(captor.capture());
        assertThat(captor.getValue().getCusto()).isEqualByComparingTo("4.75");
        assertThat(captor.getValue().getFimVigencia()).isNull();
    }

    @Test
    void encerraHistoricoAnteriorQuandoCustoDoProdutoMuda() {
        Produto produto = Produto.builder()
                .id(20L)
                .custoAtual(new BigDecimal("5.00"))
                .build();
        HistoricoCustoProduto vigente = HistoricoCustoProduto.builder()
                .produto(produto)
                .custo(new BigDecimal("4.75"))
                .build();
        when(custosProduto.findFirstByProdutoIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(20L))
                .thenReturn(Optional.of(vigente));

        service.registrarCustoProduto(
                produto,
                Usuario.builder().id(2L).build(),
                new BigDecimal("4.75"),
                "Custo alterado",
                "PRODUCAO");

        assertThat(vigente.getFimVigencia()).isNotNull();
        verify(custosProduto).save(vigente);
    }
}

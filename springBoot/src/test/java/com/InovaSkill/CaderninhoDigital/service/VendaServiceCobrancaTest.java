package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.SituacaoCobranca;
import com.InovaSkill.CaderninhoDigital.exception.ConflictException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import com.InovaSkill.CaderninhoDigital.repository.projection.ResumoCobrancasProjection;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class VendaServiceCobrancaTest {

    @Mock private VendaRepository vendaRepository;
    @Mock private ProdutoRepository produtoRepository;
    @Mock private ClienteRepository clienteRepository;
    @Mock private UsuarioAcessoService usuarioAcessoService;
    @Mock private MovimentacaoEstoqueService movimentacaoEstoqueService;
    @Mock private AuditoriaService auditoriaService;
    @Mock private ClassificadorCobrancaService classificadorCobrancaService;
    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private ResumoCobrancasProjection resumoCobrancasProjection;

    private VendaService vendaService;
    private Usuario gestor;

    @BeforeEach
    void configurar() {
        vendaService = new VendaService(
                vendaRepository,
                produtoRepository,
                clienteRepository,
                usuarioAcessoService,
                new ObjectMapper(),
                movimentacaoEstoqueService,
                auditoriaService,
                classificadorCobrancaService,
                jdbcTemplate);
        gestor = Usuario.builder().id(1L).nome("Gestora").build();
        when(usuarioAcessoService.buscarGestor(1L)).thenReturn(gestor);
    }

    @Test
    void confirmaPagamentoPendenteERegistraGestorNaAuditoria() {
        Venda venda = vendaPendente();
        when(vendaRepository.buscarParaConfirmacao(10L)).thenReturn(Optional.of(venda));
        when(vendaRepository.save(venda)).thenReturn(venda);

        var response = vendaService.confirmarPagamento(1L, 10L);

        assertThat(response.getStatusPagamento()).isEqualTo(StatusPagamento.PAGO);
        assertThat(venda.getStatusPagamento()).isEqualTo(StatusPagamento.PAGO);
        verify(auditoriaService).registrar(
                eq(gestor),
                eq("VENDA"),
                eq(10L),
                eq("CONFIRMACAO_PAGAMENTO"),
                eq(StatusPagamento.PENDENTE),
                eq(StatusPagamento.PAGO),
                eq("Pagamento confirmado"),
                eq("A_RECEBER"));
    }

    @Test
    void impedeSegundaConfirmacaoDaMesmaCobranca() {
        Venda venda = vendaPendente();
        venda.setStatusPagamento(StatusPagamento.PAGO);
        when(vendaRepository.buscarParaConfirmacao(10L)).thenReturn(Optional.of(venda));

        assertThatThrownBy(() -> vendaService.confirmarPagamento(1L, 10L))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Esta cobrança já foi confirmada como paga");
    }

    @Test
    void informaQuandoCobrancaNaoExiste() {
        when(vendaRepository.buscarParaConfirmacao(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> vendaService.confirmarPagamento(1L, 99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Cobrança não encontrada");
    }

    @Test
    void permiteVisualizarVendaCompartilhadaEntreGestores() {
        Venda venda = vendaPendente();
        when(classificadorCobrancaService.hoje()).thenReturn(LocalDate.of(2026, 7, 23));
        when(vendaRepository.buscarDetalhesPorId(10L)).thenReturn(Optional.of(venda));

        var detalhes = vendaService.buscarDetalhes(1L, 10L);

        assertThat(detalhes.getId()).isEqualTo(10L);
        verify(vendaRepository).buscarDetalhesPorId(10L);
    }

    @Test
    void resumoFinanceiroUsaFiltrosCombinadosSemSomarApenasUmaPagina() {
        LocalDate hoje = LocalDate.of(2026, 7, 23);
        when(classificadorCobrancaService.hoje()).thenReturn(hoje);
        when(vendaRepository.resumirCobrancas(
                hoje,
                hoje.minusDays(1),
                hoje.minusDays(7),
                hoje.minusDays(8),
                hoje.minusDays(30),
                "ATRASO_MEDIO",
                "Maria",
                2L,
                3L,
                LocalDate.of(2026, 6, 1),
                LocalDate.of(2026, 7, 31),
                null,
                null))
                .thenReturn(resumoCobrancasProjection);
        when(resumoCobrancasProjection.getTotalReceber()).thenReturn(new BigDecimal("500.00"));
        when(resumoCobrancasProjection.getTotalVencido()).thenReturn(new BigDecimal("350.00"));
        when(resumoCobrancasProjection.getTotalEmDia()).thenReturn(new BigDecimal("150.00"));
        when(resumoCobrancasProjection.getQuantidadeAtrasadas()).thenReturn(4L);
        when(resumoCobrancasProjection.getQuantidadeCobrancas()).thenReturn(6L);

        var resumo = vendaService.resumirCobrancas(
                1L,
                " Maria ",
                2L,
                3L,
                LocalDate.of(2026, 6, 1),
                LocalDate.of(2026, 7, 31),
                SituacaoCobranca.ATRASO_MEDIO,
                null,
                null);

        assertThat(resumo.totalReceber()).isEqualByComparingTo("500.00");
        assertThat(resumo.totalVencido()).isEqualByComparingTo("350.00");
        assertThat(resumo.totalEmDia()).isEqualByComparingTo("150.00");
        assertThat(resumo.quantidadeAtrasadas()).isEqualTo(4);
        assertThat(resumo.quantidadeCobrancas()).isEqualTo(6);
    }

    private Venda vendaPendente() {
        return Venda.builder()
                .id(10L)
                .cliente(Cliente.builder().id(20L).nome("Cliente").build())
                .gestor(gestor)
                .dataVenda(LocalDate.of(2026, 7, 1))
                .dataVencimento(LocalDate.of(2026, 7, 20))
                .statusPagamento(StatusPagamento.PENDENTE)
                .valorTotal(new BigDecimal("150.00"))
                .itens(new ArrayList<>())
                .build();
    }
}

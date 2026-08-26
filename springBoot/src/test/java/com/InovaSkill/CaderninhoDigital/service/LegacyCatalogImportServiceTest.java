package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogDecisionResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentItemResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentResponse;
import com.InovaSkill.CaderninhoDigital.entity.LegacyImportRecord;
import com.InovaSkill.CaderninhoDigital.entity.LegacyImportRun;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.LegacyImportRecordStatus;
import com.InovaSkill.CaderninhoDigital.enums.LegacyImportRunStatus;
import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import com.InovaSkill.CaderninhoDigital.repository.LegacyImportRecordRepository;
import com.InovaSkill.CaderninhoDigital.repository.LegacyImportRunRepository;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LegacyCatalogImportServiceTest {

    @Mock
    private LegacyDataAuditService auditService;
    @Mock
    private LegacyDataTreatmentService treatmentService;
    @Mock
    private LegacyCatalogDecisionService decisionService;
    @Mock
    private UsuarioAcessoService usuarioAcessoService;
    @Mock
    private ProdutoRepository produtoRepository;
    @Mock
    private MateriaPrimaRepository materiaPrimaRepository;
    @Mock
    private LegacyImportRunRepository runRepository;
    @Mock
    private LegacyImportRecordRepository recordRepository;
    @Mock
    private HistoricoValorService historicoValorService;
    @Mock
    private MovimentacaoEstoqueService movimentacaoEstoqueService;
    @Mock
    private AuditoriaService auditoriaService;

    private LegacyCatalogImportService service;

    @BeforeEach
    void configurar() {
        service = new LegacyCatalogImportService(
                auditService,
                treatmentService,
                decisionService,
                usuarioAcessoService,
                produtoRepository,
                materiaPrimaRepository,
                runRepository,
                recordRepository,
                historicoValorService,
                movimentacaoEstoqueService,
                auditoriaService);
    }

    @Test
    void importaProdutoComHistoricoMovimentacaoEProveniencia() {
        Usuario gestor = Usuario.builder().id(7L).build();
        LegacyTable tabela = new LegacyTable("produtos.xls", List.of("CODIGO"), List.of(List.of("10")));
        LegacyCatalogTreatmentItemResponse item = new LegacyCatalogTreatmentItemResponse(
                "produtos.xls", 2, "10", "Bolo", "PRODUTO_FINAL", List.of("VENDA"),
                List.of("Aparece como item de venda."), List.of(), "un",
                new BigDecimal("4.50"), new BigDecimal("12.00"), new BigDecimal("3"),
                BigDecimal.ZERO, true, "PRONTO");
        LegacyCatalogTreatmentResponse treatment = treatment(item);
        LegacyCatalogDecisionResponse decisions = decisionResponse(1, 0, 0, true, List.of());

        when(usuarioAcessoService.buscarGestor(7L)).thenReturn(gestor);
        when(treatmentService.treat(List.of(tabela))).thenReturn(treatment);
        when(decisionService.resolveTreatment(treatment, List.of())).thenReturn(decisions);
        when(recordRepository.findByGestorIdAndArquivoAndLinhaAndCodigoLegadoAndDominio(
                7L, "produtos.xls", 2, "10", "CATALOGO"))
                .thenReturn(Optional.empty());
        when(runRepository.save(any(LegacyImportRun.class))).thenAnswer(invocation -> {
            LegacyImportRun run = invocation.getArgument(0);
            if (run.getId() == null) run.setId(40L);
            return run;
        });
        when(produtoRepository.existsBySkuIgnoreCase("LEGADO-10")).thenReturn(false);
        when(produtoRepository.save(any(Produto.class))).thenAnswer(invocation -> {
            Produto produto = invocation.getArgument(0);
            produto.setId(90L);
            return produto;
        });

        var response = service.importTables(7L, List.of(tabela), List.of());

        assertThat(response.status()).isEqualTo(LegacyImportRunStatus.CONCLUIDA);
        assertThat(response.importacaoId()).isEqualTo(40L);
        assertThat(response.produtosImportados()).isEqualTo(1);
        assertThat(response.materiasPrimasImportadas()).isZero();
        verify(historicoValorService).registrarPreco(any(Produto.class), eq(gestor), eq(null),
                eq("Preço inicial importado do catálogo legado"));
        verify(historicoValorService).registrarCustoProduto(any(Produto.class), eq(gestor), eq(null),
                eq("Custo inicial importado do catálogo legado"), eq("MIGRACAO"));
        verify(movimentacaoEstoqueService).registrarProduto(
                any(Produto.class), eq(gestor), eq(BigDecimal.ZERO), eq(new BigDecimal("3")),
                eq(TipoMovimentacaoEstoque.ENTRADA), eq(OrigemMovimentacaoEstoque.MIGRACAO),
                eq(40L), eq("Saldo inicial importado do catálogo legado"));

        ArgumentCaptor<LegacyImportRecord> recordCaptor = ArgumentCaptor.forClass(LegacyImportRecord.class);
        verify(recordRepository).save(recordCaptor.capture());
        assertThat(recordCaptor.getValue().getStatus()).isEqualTo(LegacyImportRecordStatus.IMPORTADO);
        assertThat(recordCaptor.getValue().getEntidadeTipo()).isEqualTo("PRODUTO");
        assertThat(recordCaptor.getValue().getEntidadeId()).isEqualTo(90L);
    }

    @Test
    void bloqueiaAntesDeCriarStagingQuandoHaPendencias() {
        Usuario gestor = Usuario.builder().id(7L).build();
        LegacyTable tabela = new LegacyTable("produtos.xls", List.of("CODIGO"), List.of(List.of("10")));
        LegacyCatalogTreatmentResponse treatment = treatment(itemPendente());
        LegacyCatalogDecisionResponse decisions = decisionResponse(0, 0, 1, false, List.of("Falta decisão manual."));

        when(usuarioAcessoService.buscarGestor(7L)).thenReturn(gestor);
        when(treatmentService.treat(List.of(tabela))).thenReturn(treatment);
        when(decisionService.resolveTreatment(treatment, List.of())).thenReturn(decisions);

        assertThatThrownBy(() -> service.importTables(7L, List.of(tabela), List.of()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Importação bloqueada");

        verifyNoInteractions(runRepository, produtoRepository, materiaPrimaRepository, recordRepository);
    }

    @Test
    void naoDuplicaRegistroJaProcessado() {
        Usuario gestor = Usuario.builder().id(7L).build();
        LegacyTable tabela = new LegacyTable("produtos.xls", List.of("CODIGO"), List.of(List.of("10")));
        LegacyCatalogTreatmentResponse treatment = treatment(itemPronto());
        LegacyCatalogDecisionResponse decisions = decisionResponse(1, 0, 0, true, List.of());

        when(usuarioAcessoService.buscarGestor(7L)).thenReturn(gestor);
        when(treatmentService.treat(List.of(tabela))).thenReturn(treatment);
        when(decisionService.resolveTreatment(treatment, List.of())).thenReturn(decisions);
        when(runRepository.save(any(LegacyImportRun.class))).thenAnswer(invocation -> {
            LegacyImportRun run = invocation.getArgument(0);
            if (run.getId() == null) run.setId(41L);
            return run;
        });
        when(recordRepository.findByGestorIdAndArquivoAndLinhaAndCodigoLegadoAndDominio(
                7L, "produtos.xls", 2, "10", "CATALOGO"))
                .thenReturn(Optional.of(LegacyImportRecord.builder().status(LegacyImportRecordStatus.IMPORTADO).build()));

        var response = service.importTables(7L, List.of(tabela), List.of());

        assertThat(response.jaProcessados()).isEqualTo(1);
        assertThat(response.produtosImportados()).isZero();
        verify(produtoRepository, never()).save(any(Produto.class));
        verify(recordRepository, never()).save(any(LegacyImportRecord.class));
    }

    private LegacyCatalogTreatmentResponse treatment(LegacyCatalogTreatmentItemResponse item) {
        return new LegacyCatalogTreatmentResponse(
                "produtos.xls", 1, 1, Map.of(item.classificacaoSugerida(), 1L),
                "PRONTO".equals(item.status()) ? 1 : 0,
                "PRONTO".equals(item.status()) ? 0 : 1,
                List.of(item));
    }

    private LegacyCatalogTreatmentItemResponse itemPronto() {
        return new LegacyCatalogTreatmentItemResponse(
                "produtos.xls", 2, "10", "Bolo", "PRODUTO_FINAL", List.of("VENDA"), List.of(), List.of(),
                "un", new BigDecimal("4.50"), new BigDecimal("12.00"), new BigDecimal("3"), BigDecimal.ZERO,
                true, "PRONTO");
    }

    private LegacyCatalogTreatmentItemResponse itemPendente() {
        return new LegacyCatalogTreatmentItemResponse(
                "produtos.xls", 2, "10", "Item", "REVISAR", List.of(), List.of(), List.of(),
                "un", null, new BigDecimal("12.00"), BigDecimal.ZERO, BigDecimal.ZERO, true,
                "PENDENTE_REVISAO");
    }

    private LegacyCatalogDecisionResponse decisionResponse(
            long approved,
            long notImported,
            long pending,
            boolean ready,
            List<String> blockingReasons
    ) {
        return new LegacyCatalogDecisionResponse(
                "produtos.xls", 1, 1, ready, approved, notImported, pending,
                List.of(), List.of(), blockingReasons);
    }
}

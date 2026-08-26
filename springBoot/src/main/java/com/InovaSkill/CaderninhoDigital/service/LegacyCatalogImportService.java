package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.LegacyCatalogDecisionRequest;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogDecisionAppliedResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogDecisionResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogImportResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentItemResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentResponse;
import com.InovaSkill.CaderninhoDigital.entity.LegacyImportRecord;
import com.InovaSkill.CaderninhoDigital.entity.LegacyImportRun;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
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
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LegacyCatalogImportService {

    private static final String CATALOG_DOMAIN = "CATALOGO";
    private static final String LEGACY_SKU_PREFIX = "LEGADO-";

    private final LegacyDataAuditService auditService;
    private final LegacyDataTreatmentService treatmentService;
    private final LegacyCatalogDecisionService decisionService;
    private final UsuarioAcessoService usuarioAcessoService;
    private final ProdutoRepository produtoRepository;
    private final MateriaPrimaRepository materiaPrimaRepository;
    private final LegacyImportRunRepository runRepository;
    private final LegacyImportRecordRepository recordRepository;
    private final HistoricoValorService historicoValorService;
    private final MovimentacaoEstoqueService movimentacaoEstoqueService;
    private final AuditoriaService auditoriaService;

    public LegacyCatalogImportService(
            LegacyDataAuditService auditService,
            LegacyDataTreatmentService treatmentService,
            LegacyCatalogDecisionService decisionService,
            UsuarioAcessoService usuarioAcessoService,
            ProdutoRepository produtoRepository,
            MateriaPrimaRepository materiaPrimaRepository,
            LegacyImportRunRepository runRepository,
            LegacyImportRecordRepository recordRepository,
            HistoricoValorService historicoValorService,
            MovimentacaoEstoqueService movimentacaoEstoqueService,
            AuditoriaService auditoriaService
    ) {
        this.auditService = auditService;
        this.treatmentService = treatmentService;
        this.decisionService = decisionService;
        this.usuarioAcessoService = usuarioAcessoService;
        this.produtoRepository = produtoRepository;
        this.materiaPrimaRepository = materiaPrimaRepository;
        this.runRepository = runRepository;
        this.recordRepository = recordRepository;
        this.historicoValorService = historicoValorService;
        this.movimentacaoEstoqueService = movimentacaoEstoqueService;
        this.auditoriaService = auditoriaService;
    }

    @Transactional
    public LegacyCatalogImportResponse importCatalog(
            Long usuarioId,
            List<MultipartFile> files,
            List<LegacyCatalogDecisionRequest> decisions
    ) {
        Map<String, LegacyTable> tables = auditService.parseFiles(files);
        return importTables(usuarioId, tables.values().stream().toList(), decisions);
    }

    @Transactional
    public LegacyCatalogImportResponse importTables(
            Long usuarioId,
            List<LegacyTable> tables,
            List<LegacyCatalogDecisionRequest> decisions
    ) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        LegacyCatalogTreatmentResponse treatment = treatmentService.treat(tables);
        LegacyCatalogDecisionResponse resolved = decisionService.resolveTreatment(treatment, decisions);
        if (!resolved.prontoParaImportacao()) {
            throw new BusinessException(
                    "Importação bloqueada: " + String.join(" ", resolved.bloqueios()));
        }

        LegacyImportRun run = runRepository.save(LegacyImportRun.builder()
                .gestor(gestor)
                .status(LegacyImportRunStatus.EM_EXECUCAO)
                .arquivoPrincipal(treatment.arquivoPrincipal())
                .arquivosAnalisados(treatment.arquivosAnalisados())
                .registrosAnalisados(treatment.registrosAnalisados())
                .build());

        Map<String, LegacyCatalogDecisionAppliedResponse> manualDecisions = resolved.decisoesAplicadas()
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        decision -> key(decision.arquivo(), decision.linha(), decision.codigoLegado()),
                        decision -> decision));

        long productsImported = 0;
        long materialsImported = 0;
        long alreadyProcessed = 0;
        long notImported = 0;
        long awaitingHistory = 0;

        for (LegacyCatalogTreatmentItemResponse item : treatment.itens()) {
            String key = key(item.arquivo(), item.linha(), item.codigoLegado());
            Optional<LegacyImportRecord> existing = recordRepository
                    .findByGestorIdAndArquivoAndLinhaAndCodigoLegadoAndDominio(
                            gestor.getId(), item.arquivo(), item.linha(), item.codigoLegado(), CATALOG_DOMAIN);
            if (existing.isPresent()) {
                alreadyProcessed++;
                continue;
            }

            LegacyCatalogDecisionAppliedResponse manual = manualDecisions.get(key);
            String classification = manual == null ? item.classificacaoSugerida() : manual.classificacaoFinal();
            String observation = manual == null ? null : manual.observacao();

            if ("NAO_IMPORTAR".equals(classification)) {
                saveRecord(run, gestor, item, classification, LegacyImportRecordStatus.NAO_IMPORTADO,
                        null, null, observation);
                notImported++;
                continue;
            }
            if ("GASTO_OPERACIONAL".equals(classification)) {
                saveRecord(run, gestor, item, classification, LegacyImportRecordStatus.AGUARDANDO_HISTORICO,
                        null, null, "Classificação aguardando importação dos lançamentos históricos.");
                awaitingHistory++;
                continue;
            }
            if ("PRODUTO_FINAL".equals(classification)) {
                Produto produto = importarProduto(gestor, run, item);
                saveRecord(run, gestor, item, classification, LegacyImportRecordStatus.IMPORTADO,
                        "PRODUTO", produto.getId(), observation);
                productsImported++;
                continue;
            }
            if ("MATERIA_PRIMA".equals(classification)) {
                MateriaPrima materiaPrima = importarMateriaPrima(gestor, run, item);
                saveRecord(run, gestor, item, classification, LegacyImportRecordStatus.IMPORTADO,
                        "MATERIA_PRIMA", materiaPrima.getId(), observation);
                materialsImported++;
                continue;
            }
            throw new BusinessException("Classificação não suportada para o item " + item.codigoLegado() + ".");
        }

        run.setStatus(LegacyImportRunStatus.CONCLUIDA);
        run.setFinalizadoEm(LocalDateTime.now());
        runRepository.save(run);

        return new LegacyCatalogImportResponse(
                run.getId(),
                run.getStatus(),
                treatment.arquivoPrincipal(),
                treatment.arquivosAnalisados(),
                treatment.registrosAnalisados(),
                productsImported,
                materialsImported,
                alreadyProcessed,
                notImported,
                awaitingHistory,
                List.of()
        );
    }

    private Produto importarProduto(
            Usuario gestor,
            LegacyImportRun run,
            LegacyCatalogTreatmentItemResponse item
    ) {
        requirePositive(item.precoVenda(), "Produto final precisa de preço de venda maior que zero.");
        String sku = legacySku(item.codigoLegado());
        if (sku != null && produtoRepository.existsBySkuIgnoreCase(sku)) {
            throw new BusinessException("O SKU legado " + sku + " já está cadastrado.");
        }
        BigDecimal stock = zeroIfNull(item.estoque());
        Produto produto = produtoRepository.save(Produto.builder()
                .nome(item.nome())
                .sku(sku)
                .unidadeMedida(item.unidade())
                .precoVenda(item.precoVenda())
                .custoAtual(item.precoCusto())
                .estoqueAtual(stock)
                .ativo(item.ativo() == null ? Boolean.TRUE : item.ativo())
                .gestor(gestor)
                .build());

        historicoValorService.registrarPreco(produto, gestor, null,
                "Preço inicial importado do catálogo legado");
        historicoValorService.registrarCustoProduto(produto, gestor, null,
                "Custo inicial importado do catálogo legado", "MIGRACAO");
        registrarSaldoProduto(produto, gestor, run.getId(), stock);
        auditoriaService.registrar(gestor, "PRODUTO", produto.getId(), "IMPORTACAO_CATALOGO",
                null, item.codigoLegado(), "Produto importado do catálogo legado", "MIGRACAO");
        return produto;
    }

    private MateriaPrima importarMateriaPrima(
            Usuario gestor,
            LegacyImportRun run,
            LegacyCatalogTreatmentItemResponse item
    ) {
        requirePositive(item.precoCusto(), "Matéria-prima precisa de custo maior que zero.");
        BigDecimal stock = zeroIfNull(item.estoque());
        MateriaPrima materiaPrima = materiaPrimaRepository.save(MateriaPrima.builder()
                .nome(item.nome())
                .unidadeMedida(item.unidade())
                .estoqueAtual(stock)
                .estoqueMinimo(zeroIfNull(item.estoqueMinimo()))
                .custoMedio(item.precoCusto())
                .ativo(item.ativo() == null ? Boolean.TRUE : item.ativo())
                .gestor(gestor)
                .build());

        historicoValorService.registrarCusto(materiaPrima, gestor, null,
                "Custo inicial importado do catálogo legado", "MIGRACAO");
        registrarSaldoMateriaPrima(materiaPrima, gestor, run.getId(), stock);
        auditoriaService.registrar(gestor, "MATERIA_PRIMA", materiaPrima.getId(), "IMPORTACAO_CATALOGO",
                null, item.codigoLegado(), "Matéria-prima importada do catálogo legado", "MIGRACAO");
        return materiaPrima;
    }

    private void registrarSaldoProduto(Produto produto, Usuario gestor, Long runId, BigDecimal stock) {
        movimentacaoEstoqueService.registrarProduto(
                produto, gestor, BigDecimal.ZERO, stock,
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MIGRACAO,
                runId, "Saldo inicial importado do catálogo legado");
    }

    private void registrarSaldoMateriaPrima(
            MateriaPrima materiaPrima,
            Usuario gestor,
            Long runId,
            BigDecimal stock
    ) {
        movimentacaoEstoqueService.registrarMateriaPrima(
                materiaPrima, gestor, BigDecimal.ZERO, stock,
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.MIGRACAO,
                runId, "Saldo inicial importado do catálogo legado");
    }

    private void saveRecord(
            LegacyImportRun run,
            Usuario gestor,
            LegacyCatalogTreatmentItemResponse item,
            String classification,
            LegacyImportRecordStatus status,
            String entityType,
            Long entityId,
            String observation
    ) {
        recordRepository.save(LegacyImportRecord.builder()
                .importacao(run)
                .gestor(gestor)
                .arquivo(item.arquivo())
                .linha(item.linha())
                .codigoLegado(item.codigoLegado())
                .dominio(CATALOG_DOMAIN)
                .classificacao(classification)
                .status(status)
                .entidadeTipo(entityType)
                .entidadeId(entityId)
                .observacao(observation)
                .build());
    }

    private String legacySku(String legacyCode) {
        if (legacyCode == null || legacyCode.isBlank()) {
            return null;
        }
        String candidate = LEGACY_SKU_PREFIX + legacyCode.trim();
        return candidate.length() <= 60 ? candidate : null;
    }

    private BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private void requirePositive(BigDecimal value, String message) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(message);
        }
    }

    private String key(String file, int line, String code) {
        return (file == null ? "" : file) + ":" + line + ":" + (code == null ? "" : code);
    }
}

package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyAuditItemResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyDataAuditResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyQuantityIssueResponse;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyHtmlTableParser;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyItemClassification;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LegacyDataAuditService {

    private static final String PRODUCTS_FILE = "produtos.xls";
    private static final int MAX_FILES_PER_ANALYSIS = 50;
    private static final BigDecimal HARD_QUANTITY_LIMIT = new BigDecimal("1000000");
    private static final BigDecimal PRODUCT_STOCK_EXTREME_LIMIT = new BigDecimal("100000");
    private static final BigDecimal OUTLIER_MULTIPLIER = new BigDecimal("100");
    private static final int MINIMUM_OUTLIER_SAMPLE = 5;
    private static final int MAX_RESPONSE_ALERTS = 200;

    private final LegacyHtmlTableParser parser;

    public LegacyDataAuditService(LegacyHtmlTableParser parser) {
        this.parser = parser;
    }

    public LegacyDataAuditResponse preview(List<MultipartFile> files) {
        return audit(parseFiles(files));
    }

    public Map<String, LegacyTable> parseFiles(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw new BusinessException("Envie ao menos um arquivo legado para análise.");
        }
        if (files.size() > MAX_FILES_PER_ANALYSIS) {
            throw new BusinessException("Envie no máximo " + MAX_FILES_PER_ANALYSIS + " arquivos por análise.");
        }

        Map<String, LegacyTable> tables = new LinkedHashMap<>();
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            String fileName = safeFileName(file.getOriginalFilename());
            if (fileName.startsWith(".~lock.")) {
                continue;
            }
            try {
                String key = normalizeFileName(fileName);
                if (tables.containsKey(key)) {
                    throw new BusinessException("O arquivo " + fileName + " foi enviado mais de uma vez.");
                }
                tables.put(key, parser.parse(fileName, file.getBytes()));
            } catch (IOException exception) {
                throw new BusinessException("Não foi possível ler o arquivo " + fileName + ".");
            }
        }

        return Map.copyOf(tables);
    }

    public LegacyDataAuditResponse audit(List<LegacyTable> tables) {
        Map<String, LegacyTable> byName = new LinkedHashMap<>();
        if (tables != null) {
            for (LegacyTable table : tables) {
                if (table != null) {
                    byName.put(normalizeFileName(table.fileName()), table);
                }
            }
        }
        return audit(byName);
    }

    private LegacyDataAuditResponse audit(Map<String, LegacyTable> tables) {
        LegacyTable products = tables.get(PRODUCTS_FILE);
        if (products == null) {
            throw new BusinessException("Envie o arquivo produtos.xls para iniciar a classificação.");
        }

        Map<String, Set<String>> contextsByProduct = collectProductContexts(tables);
        List<QuantityObservation> observations = collectQuantityObservations(tables);
        List<QuantityIssue> quantityIssues = validateQuantities(observations);
        Map<String, List<String>> productAlerts = productAlerts(quantityIssues);

        Map<String, Long> classifications = new TreeMap<>();
        List<LegacyAuditItemResponse> reviewItems = new ArrayList<>();
        Set<String> alertRows = new HashSet<>();

        for (int rowIndex = 0; rowIndex < products.rows().size(); rowIndex++) {
            List<String> row = products.rows().get(rowIndex);
            String code = products.firstAvailableValue(row, "CODIGO");
            String name = products.firstAvailableValue(row, "IXPROD", "ICPROD", "NOME");
            Set<String> contexts = contextsByProduct.getOrDefault(code, Set.of());
            List<String> reasons = classificationReasons(contexts);
            LegacyItemClassification classification = classify(contexts);
            classifications.merge(classification.name(), 1L, Long::sum);

            List<String> alerts = new ArrayList<>(productAlerts.getOrDefault(productRowKey(rowIndex + 2), List.of()));
            if (code.isBlank()) {
                alerts.add("CODIGO_LEGADO_AUSENTE: o item precisa de um código para garantir idempotência.");
            }
            if (name.isBlank()) {
                alerts.add("NOME_AUSENTE: informe o nome antes da importação.");
            } else if (name.length() > 120) {
                alerts.add("NOME_EXCEDIDO: o nome ultrapassa o limite de 120 caracteres.");
            }
            BigDecimal salePrice = decimal(products.value(row, "PRECOVENDA"), products.fileName(), rowIndex + 2, "PRECOVENDA");
            if (salePrice != null && salePrice.compareTo(BigDecimal.ZERO) <= 0) {
                alerts.add("PRECO_VENDA_INVALIDO: o preço de venda precisa ser maior que zero.");
            }
            BigDecimal costPrice = decimal(products.value(row, "PRECOCUSTO"), products.fileName(), rowIndex + 2, "PRECOCUSTO");
            if (classification == LegacyItemClassification.MATERIA_PRIMA
                    && (costPrice == null || costPrice.compareTo(BigDecimal.ZERO) <= 0)) {
                alerts.add("PRECO_CUSTO_INVALIDO: matéria-prima precisa de um custo maior que zero.");
            }
            String unit = products.firstAvailableValue(row, "IUCOM", "UNIDADE", "UNIDADEMEDIDA");
            if (unit.isBlank()) {
                alerts.add("UNIDADE_AUSENTE: informe a unidade antes da importação.");
            } else if (unit.length() > 30) {
                alerts.add("UNIDADE_EXCEDIDA: a unidade ultrapassa o limite de 30 caracteres.");
            }

            if (classification == LegacyItemClassification.REVISAR || !alerts.isEmpty()) {
                int line = rowIndex + 2;
                reviewItems.add(new LegacyAuditItemResponse(
                        products.fileName(),
                        line,
                        code,
                        name,
                        classification.name(),
                        contexts.stream().sorted().toList(),
                        reasons,
                        List.copyOf(alerts),
                        unit,
                        decimal(products.value(row, "ESTOQUE"), products.fileName(), line, "ESTOQUE"),
                        booleanValue(products.value(row, "ATIVO"))
                ));
                alertRows.add(productRowKey(line));
            }
        }

        for (QuantityIssue issue : quantityIssues) {
            alertRows.add(issue.rowKey());
        }

        long exorbitantCount = quantityIssues.stream()
                .filter(QuantityIssue::exorbitant)
                .count();
        long totalRows = tables.values().stream().mapToLong(table -> table.rows().size()).sum();

        return new LegacyDataAuditResponse(
                products.fileName(),
                tables.size(),
                totalRows,
                Map.copyOf(classifications),
                alertRows.size(),
                exorbitantCount,
                List.copyOf(reviewItems),
                quantityIssues.stream()
                        .map(QuantityIssue::response)
                        .limit(MAX_RESPONSE_ALERTS)
                        .toList()
        );
    }

    private Map<String, Set<String>> collectProductContexts(Map<String, LegacyTable> tables) {
        Map<String, Set<String>> contexts = new HashMap<>();
        registerContext(tables, contexts, "vendasitens.xls", "CODPRODUTO", "VENDA");
        registerContext(tables, contexts, "comprasitens.xls", "CODPRODUTO", "COMPRA");
        registerContext(tables, contexts, "prodreceitas.xls", "CODPRODUTO", "RECEITA_PRODUTO");
        registerContext(tables, contexts, "prodreceitasitens.xls", "CODINSUMO", "RECEITA_INSUMO");
        registerContext(tables, contexts, "producaoitens.xls", "CODPRODUTO", "PRODUCAO");
        registerContext(tables, contexts, "ajusteestoqueitens.xls", "CODPRODUTO", "AJUSTE_ESTOQUE");
        return contexts;
    }

    private void registerContext(
            Map<String, LegacyTable> tables,
            Map<String, Set<String>> contexts,
            String fileName,
            String codeColumn,
            String context
    ) {
        LegacyTable table = tables.get(fileName);
        if (table == null || !table.hasHeader(codeColumn)) {
            return;
        }
        for (List<String> row : table.rows()) {
            String code = table.value(row, codeColumn);
            if (!code.isBlank()) {
                contexts.computeIfAbsent(code, ignored -> new LinkedHashSet<>()).add(context);
            }
        }
    }

    private LegacyItemClassification classify(Set<String> contexts) {
        boolean sold = contexts.contains("VENDA");
        boolean finalRecipe = contexts.contains("RECEITA_PRODUTO");
        boolean material = contexts.contains("RECEITA_INSUMO") || contexts.contains("PRODUCAO");

        if ((sold || finalRecipe) && material) {
            return LegacyItemClassification.REVISAR;
        }
        if (sold || finalRecipe) {
            return LegacyItemClassification.PRODUTO_FINAL;
        }
        if (material) {
            return LegacyItemClassification.MATERIA_PRIMA;
        }
        return LegacyItemClassification.REVISAR;
    }

    private List<String> classificationReasons(Set<String> contexts) {
        if (contexts.isEmpty()) {
            return List.of("O item não possui referência nos arquivos históricos enviados.");
        }
        List<String> reasons = new ArrayList<>();
        if (contexts.contains("VENDA")) {
            reasons.add("Aparece como item de venda.");
        }
        if (contexts.contains("RECEITA_PRODUTO")) {
            reasons.add("Aparece como produto de uma receita.");
        }
        if (contexts.contains("RECEITA_INSUMO")) {
            reasons.add("Aparece como insumo de uma receita.");
        }
        if (contexts.contains("PRODUCAO")) {
            reasons.add("Aparece nos itens históricos de produção.");
        }
        if (contexts.contains("COMPRA") && !contexts.contains("RECEITA_INSUMO") && !contexts.contains("PRODUCAO")) {
            reasons.add("Aparece apenas em compras; pode ser matéria-prima ou gasto operacional.");
        }
        if (contexts.contains("AJUSTE_ESTOQUE")) {
            reasons.add("Possui histórico de ajuste de estoque.");
        }
        return List.copyOf(reasons);
    }

    private List<QuantityObservation> collectQuantityObservations(Map<String, LegacyTable> tables) {
        List<QuantityObservation> observations = new ArrayList<>();
        for (LegacyTable table : tables.values()) {
            for (int rowIndex = 0; rowIndex < table.rows().size(); rowIndex++) {
                List<String> row = table.rows().get(rowIndex);
                for (String column : table.headers()) {
                    if (!isQuantityColumn(column)) {
                        continue;
                    }
                    String raw = table.value(row, column);
                    if (raw.isBlank()) {
                        continue;
                    }
                    String code = table.firstAvailableValue(
                            row, "CODIGO", "CODPRODUTO", "CODVENDA", "CODCOMPRA", "CODPRODUCAO");
                    String unit = table.firstAvailableValue(row, "IUCOM", "UNIDADE", "UNIDADEMEDIDA", "UCOM");
                    try {
                        BigDecimal value = parseDecimal(raw);
                        String normalizedFile = normalizeFileName(table.fileName());
                        String group = normalizedFile.equals(PRODUCTS_FILE)
                                ? normalizedFile + "|" + column + "|" + normalizeUnit(unit)
                                : normalizedFile + "|" + column + "|COD=" + code;
                        observations.add(new QuantityObservation(
                                table.fileName(), rowIndex + 2, code, column, unit, group, value, null));
                    } catch (NumberFormatException exception) {
                        observations.add(new QuantityObservation(
                                table.fileName(), rowIndex + 2, code, column, unit, "", null,
                                "O valor '" + raw + "' não é uma quantidade numérica válida."));
                    }
                }
            }
        }
        return observations;
    }

    private List<QuantityIssue> validateQuantities(List<QuantityObservation> observations) {
        Map<String, List<BigDecimal>> positiveByGroup = new HashMap<>();
        for (QuantityObservation observation : observations) {
            if (observation.value() != null && observation.value().compareTo(BigDecimal.ZERO) > 0) {
                positiveByGroup.computeIfAbsent(observation.group(), ignored -> new ArrayList<>())
                        .add(observation.value());
            }
        }

        Map<String, BigDecimal> outlierThresholds = new HashMap<>();
        for (Map.Entry<String, List<BigDecimal>> entry : positiveByGroup.entrySet()) {
            BigDecimal threshold = outlierThreshold(entry.getValue());
            if (threshold != null) {
                outlierThresholds.put(entry.getKey(), threshold);
            }
        }

        List<QuantityIssue> issues = new ArrayList<>();
        for (QuantityObservation observation : observations) {
            if (observation.invalidMessage() != null) {
                issues.add(issue(observation, "QUANTIDADE_INVALIDA", observation.invalidMessage(), false));
                continue;
            }
            if (observation.value() == null) {
                continue;
            }
            if (observation.value().abs().compareTo(HARD_QUANTITY_LIMIT) >= 0) {
                issues.add(issue(observation, "QUANTIDADE_EXORBITANTE",
                        "A quantidade atinge o limite absoluto de " + HARD_QUANTITY_LIMIT + "; revise antes de importar.", true));
                continue;
            }
            if (isExtremeProductStock(observation)) {
                issues.add(issue(observation, "QUANTIDADE_EXORBITANTE",
                        "O estoque legado supera o limite conservador de " + PRODUCT_STOCK_EXTREME_LIMIT
                                + "; confirme a unidade e a escala antes de importar.", true));
                continue;
            }
            if (observation.value().compareTo(BigDecimal.ZERO) < 0) {
                String type = observation.column().equals("ESTOQUE")
                        ? "ESTOQUE_NEGATIVO"
                        : "QUANTIDADE_NEGATIVA";
                issues.add(issue(observation, type,
                        "A quantidade é negativa e precisa ser confirmada no contexto do lançamento.", false));
                continue;
            }
            BigDecimal threshold = outlierThresholds.get(observation.group());
            if (threshold != null && observation.value().compareTo(threshold) > 0) {
                issues.add(issue(observation, "QUANTIDADE_EXORBITANTE",
                        "A quantidade está muito acima do padrão dos registros equivalentes; limiar estatístico="
                                + threshold.stripTrailingZeros().toPlainString() + ".",
                        true));
            }
        }
        return List.copyOf(issues);
    }

    private BigDecimal outlierThreshold(List<BigDecimal> values) {
        if (values.size() < MINIMUM_OUTLIER_SAMPLE) {
            return null;
        }
        List<BigDecimal> sorted = values.stream().sorted().toList();
        BigDecimal q1 = percentile(sorted, 0.25);
        BigDecimal median = percentile(sorted, 0.50);
        BigDecimal q3 = percentile(sorted, 0.75);
        BigDecimal iqrThreshold = q3.add(q3.subtract(q1).multiply(new BigDecimal("3")));
        BigDecimal relativeThreshold = median.multiply(OUTLIER_MULTIPLIER);
        return iqrThreshold.max(relativeThreshold);
    }

    private BigDecimal percentile(List<BigDecimal> sorted, double percentile) {
        int index = (int) Math.ceil(percentile * sorted.size()) - 1;
        index = Math.max(0, Math.min(index, sorted.size() - 1));
        return sorted.get(index);
    }

    private Map<String, List<String>> productAlerts(List<QuantityIssue> issues) {
        Map<String, List<String>> alerts = new HashMap<>();
        for (QuantityIssue issue : issues) {
            if (!normalizeFileName(issue.response().arquivo()).equals(PRODUCTS_FILE)) {
                continue;
            }
            alerts.computeIfAbsent(productRowKey(issue.response().linha()), ignored -> new ArrayList<>())
                    .add(issue.response().tipo() + ": " + issue.response().mensagem());
        }
        return alerts;
    }

    private QuantityIssue issue(QuantityObservation observation, String type, String message, boolean exorbitant) {
        return new QuantityIssue(
                new LegacyQuantityIssueResponse(
                        observation.fileName(),
                        observation.line(),
                        observation.code(),
                        observation.column(),
                        observation.value(),
                        observation.unit(),
                        type,
                        message
                ),
                exorbitant,
                observation.fileName() + ":" + observation.line()
        );
    }

    private boolean isQuantityColumn(String column) {
        return column.equals("QUANT")
                || column.startsWith("QUANTIDADE")
                || column.startsWith("QNT")
                || column.equals("ESTOQUE")
                || column.equals("ESTOQUEMINIMO")
                || column.equals("RESERVADO")
                || column.equals("OC")
                || column.equals("OP");
    }

    private boolean isExtremeProductStock(QuantityObservation observation) {
        return normalizeFileName(observation.fileName()).equals(PRODUCTS_FILE)
                && (observation.column().equals("ESTOQUE") || observation.column().equals("ESTOQUEMINIMO"))
                && observation.value().abs().compareTo(PRODUCT_STOCK_EXTREME_LIMIT) >= 0;
    }

    private BigDecimal decimal(String raw, String fileName, int line, String column) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return parseDecimal(raw);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private BigDecimal parseDecimal(String raw) {
        String value = raw.trim().replace("\u00a0", "").replace(" ", "");
        if (value.contains(",") && value.contains(".")) {
            if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
                value = value.replace(".", "").replace(',', '.');
            } else {
                value = value.replace(",", "");
            }
        } else {
            value = value.replace(',', '.');
        }
        return new BigDecimal(value);
    }

    private Boolean booleanValue(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        if (raw.equals("1") || raw.equalsIgnoreCase("true") || raw.equalsIgnoreCase("sim")) {
            return true;
        }
        if (raw.equals("0") || raw.equalsIgnoreCase("false") || raw.equalsIgnoreCase("nao")) {
            return false;
        }
        return null;
    }

    private String normalizeUnit(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private String safeFileName(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            throw new BusinessException("Foi enviado um arquivo sem nome.");
        }
        String normalized = originalName.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        String fileName = slash >= 0 ? normalized.substring(slash + 1) : normalized;
        if (fileName.isBlank() || fileName.length() > 180) {
            throw new BusinessException("O nome de um arquivo enviado é inválido.");
        }
        return fileName;
    }

    private String normalizeFileName(String fileName) {
        return fileName == null ? "" : fileName.trim().toLowerCase(Locale.ROOT);
    }

    private String productRowKey(int line) {
        return PRODUCTS_FILE + ":" + line;
    }

    private record QuantityObservation(
            String fileName,
            int line,
            String code,
            String column,
            String unit,
            String group,
            BigDecimal value,
            String invalidMessage
    ) {
    }

    private record QuantityIssue(
            LegacyQuantityIssueResponse response,
            boolean exorbitant,
            String rowKey
    ) {
    }
}

package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyHistoricalIssueResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyHistoricalTreatmentResponse;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyCatalogClassifier;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LegacyHistoricalTreatmentService {

    private static final String PRODUCTS_FILE = "produtos.xls";

    private final LegacyDataAuditService auditService;

    public LegacyHistoricalTreatmentService(LegacyDataAuditService auditService) {
        this.auditService = auditService;
    }

    public LegacyHistoricalTreatmentResponse preview(List<MultipartFile> files) {
        return treat(auditService.parseFiles(files).values().stream().toList());
    }

    public LegacyHistoricalTreatmentResponse treat(List<LegacyTable> tables) {
        Map<String, LegacyTable> byName = new LinkedHashMap<>();
        if (tables != null) {
            for (LegacyTable table : tables) {
                if (table != null) {
                    byName.put(LegacyCatalogClassifier.normalizeFileName(table.fileName()), table);
                }
            }
        }
        LegacyTable products = byName.get(PRODUCTS_FILE);
        if (products == null) {
            throw new BusinessException("Envie o arquivo produtos.xls para validar os históricos.");
        }

        Set<String> productCodes = codes(products, "CODIGO");
        Set<String> supplierOrCustomerCodes = new HashSet<>();
        Set<String> purchaseCodes = codes(byName.get("compras.xls"), "CODIGO");
        Set<String> saleCodes = codes(byName.get("vendas.xls"), "CODIGO");
        Set<String> productionCodes = codes(byName.get("producao.xls"), "CODIGO");
        Set<String> recipeCodes = codes(byName.get("prodreceitas.xls"), "CODIGO");
        Map<String, Set<String>> referencedContacts = referencedContacts(byName);
        supplierOrCustomerCodes.addAll(referencedContacts.keySet());

        Map<String, Long> byDomain = new LinkedHashMap<>();
        Set<String> readyRows = new HashSet<>();
        Map<String, LegacyHistoricalIssueResponse> issues = new LinkedHashMap<>();

        analyzeContacts(byName.get("contatos.xls"), supplierOrCustomerCodes, byDomain, readyRows, issues);
        analyzeParents(byName.get("compras.xls"), "COMPRAS", "DTCOMPRA", purchaseCodes, byDomain, readyRows, issues);
        analyzeParents(byName.get("vendas.xls"), "VENDAS", "DTVENDA", saleCodes, byDomain, readyRows, issues);
        analyzeParents(byName.get("producao.xls"), "PRODUCOES", "DTINICIO", productionCodes, byDomain, readyRows, issues);
        analyzePurchaseItems(byName.get("comprasitens.xls"), purchaseCodes, productCodes, byDomain, readyRows, issues);
        analyzeSaleItems(byName.get("vendasitens.xls"), saleCodes, productCodes, byDomain, readyRows, issues);
        analyzeProductionItems(byName.get("producaoitens.xls"), productionCodes, productCodes, byDomain, readyRows, issues);
        analyzeRecipeItems(byName.get("prodreceitasitens.xls"), recipeCodes, productCodes,
                byDomain, readyRows, issues);
        analyzeFinance(byName.get("financeiro.xls"), byDomain, readyRows, issues);

        long totalRows = byName.values().stream().mapToLong(table -> table.rows().size()).sum();
        Set<String> blockedRows = issues.values().stream()
                .filter(LegacyHistoricalIssueResponse::bloqueante)
                .map(issue -> issue.arquivo() + ":" + issue.linha())
                .collect(java.util.stream.Collectors.toSet());
        long blocked = blockedRows.size();
        long ready = readyRows.size();
        return new LegacyHistoricalTreatmentResponse(
                products.fileName(),
                byName.size(),
                totalRows,
                Map.copyOf(byDomain),
                ready,
                blocked,
                List.copyOf(issues.values())
        );
    }

    private void analyzeContacts(
            LegacyTable table,
            Set<String> referenced,
            Map<String, Long> byDomain,
            Set<String> ready,
            Map<String, LegacyHistoricalIssueResponse> issues
    ) {
        if (table == null) return;
        for (int index = 0; index < table.rows().size(); index++) {
            List<String> row = table.rows().get(index);
            int line = index + 2;
            String code = table.value(row, "CODIGO");
            String name = table.value(row, "NOME");
            count(byDomain, "CONTATOS");
            if (code.isBlank() || name.isBlank()) {
                addIssue(issues, table, line, code, "CONTATOS", "CONTATO_INCOMPLETO",
                        "Contato sem código ou nome não pode ser mapeado com segurança.");
            } else if (!referenced.contains(code)) {
                addIssue(issues, table, line, code, "CONTATOS", "CONTATO_SEM_REFERENCIA",
                        "Contato não aparece nas compras, vendas ou financeiro enviados.");
            } else {
                ready.add(key(table, line));
            }
        }
    }

    private void analyzeParents(
            LegacyTable table,
            String domain,
            String dateColumn,
            Set<String> parentCodes,
            Map<String, Long> byDomain,
            Set<String> ready,
            Map<String, LegacyHistoricalIssueResponse> issues
    ) {
        if (table == null) return;
        for (int index = 0; index < table.rows().size(); index++) {
            List<String> row = table.rows().get(index);
            int line = index + 2;
            String code = table.value(row, "CODIGO");
            count(byDomain, domain);
            if (code.isBlank() || !parentCodes.contains(code)) {
                addIssue(issues, table, line, code, domain, "ID_HISTORICO_AUSENTE",
                        "Registro sem identificador legado válido.");
            } else if (!isDate(table.value(row, dateColumn))) {
                addIssue(issues, table, line, code, domain, "DATA_INVALIDA",
                        "A data histórica não pode ser convertida.");
            } else {
                ready.add(key(table, line));
            }
        }
    }

    private void analyzePurchaseItems(
            LegacyTable table,
            Set<String> purchaseCodes,
            Set<String> productCodes,
            Map<String, Long> byDomain,
            Set<String> ready,
            Map<String, LegacyHistoricalIssueResponse> issues
    ) {
        analyzeItems(table, "COMPRAS_ITENS", "CODCOMPRA", "CODPRODUTO", purchaseCodes, productCodes,
                "QUANT", "CUSTOBRUTO", byDomain, ready, issues, false);
    }

    private void analyzeSaleItems(
            LegacyTable table,
            Set<String> saleCodes,
            Set<String> productCodes,
            Map<String, Long> byDomain,
            Set<String> ready,
            Map<String, LegacyHistoricalIssueResponse> issues
    ) {
        analyzeItems(table, "VENDAS_ITENS", "CODVENDA", "CODPRODUTO", saleCodes, productCodes,
                "QUANT", "PRECO", byDomain, ready, issues, true);
    }

    private void analyzeProductionItems(
            LegacyTable table,
            Set<String> productionCodes,
            Set<String> productCodes,
            Map<String, Long> byDomain,
            Set<String> ready,
            Map<String, LegacyHistoricalIssueResponse> issues
    ) {
        analyzeItems(table, "PRODUCOES_ITENS", "CODPRODUCAO", "CODPRODUTO", productionCodes, productCodes,
                "QUANT", "CUSTOCALCULADO", byDomain, ready, issues, false);
    }

    private void analyzeItems(
            LegacyTable table,
            String domain,
            String parentColumn,
            String productColumn,
            Set<String> parentCodes,
            Set<String> productCodes,
            String quantityColumn,
            String valueColumn,
            Map<String, Long> byDomain,
            Set<String> ready,
            Map<String, LegacyHistoricalIssueResponse> issues,
            boolean valueMustBePositive
    ) {
        if (table == null) return;
        for (int index = 0; index < table.rows().size(); index++) {
            List<String> row = table.rows().get(index);
            int line = index + 2;
            String code = table.value(row, "CODIGO");
            count(byDomain, domain);
            if (!parentCodes.contains(table.value(row, parentColumn))) {
                addIssue(issues, table, line, code, domain, "PAI_NAO_ENCONTRADO",
                        "O item aponta para um histórico pai que não foi enviado.");
                continue;
            }
            if (!productCodes.contains(table.value(row, productColumn))) {
                addIssue(issues, table, line, code, domain, "ITEM_NAO_ENCONTRADO",
                        "O item aponta para um código ausente em produtos.xls.");
                continue;
            }
            BigDecimal quantity = decimal(table.value(row, quantityColumn));
            if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
                addIssue(issues, table, line, code, domain, "QUANTIDADE_INVALIDA",
                        "A quantidade histórica precisa ser numérica e maior que zero.");
                continue;
            }
            BigDecimal value = decimal(table.value(row, valueColumn));
            if (valueMustBePositive && (value == null || value.compareTo(BigDecimal.ZERO) <= 0)) {
                addIssue(issues, table, line, code, domain, "VALOR_INVALIDO",
                        "O valor histórico precisa ser numérico e maior que zero.");
                continue;
            }
            ready.add(key(table, line));
        }
    }

    private void analyzeRecipeItems(
            LegacyTable table,
            Set<String> recipeCodes,
            Set<String> productCodes,
            Map<String, Long> byDomain,
            Set<String> ready,
            Map<String, LegacyHistoricalIssueResponse> issues
    ) {
        if (table == null) return;
        for (int index = 0; index < table.rows().size(); index++) {
            List<String> row = table.rows().get(index);
            int line = index + 2;
            String code = table.value(row, "CODIGO");
            count(byDomain, "RECEITAS_ITENS");
            if (!recipeCodes.contains(table.value(row, "CODRECEITA"))) {
                addIssue(issues, table, line, code, "RECEITAS_ITENS", "RECEITA_NAO_ENCONTRADA",
                        "O item aponta para uma receita que não foi enviada.");
            } else if (!productCodes.contains(table.value(row, "CODINSUMO"))) {
                addIssue(issues, table, line, code, "RECEITAS_ITENS", "INSUMO_NAO_ENCONTRADO",
                        "A receita aponta para um código ausente em produtos.xls.");
            } else if (decimal(table.value(row, "QUANT")) == null
                    || decimal(table.value(row, "QUANT")).compareTo(BigDecimal.ZERO) <= 0) {
                addIssue(issues, table, line, code, "RECEITAS_ITENS", "QUANTIDADE_INVALIDA",
                        "A quantidade da receita precisa ser numérica e maior que zero.");
            } else {
                ready.add(key(table, line));
            }
        }
    }

    private void analyzeFinance(
            LegacyTable table,
            Map<String, Long> byDomain,
            Set<String> ready,
            Map<String, LegacyHistoricalIssueResponse> issues
    ) {
        if (table == null) return;
        for (int index = 0; index < table.rows().size(); index++) {
            List<String> row = table.rows().get(index);
            int line = index + 2;
            String code = table.value(row, "CODIGO");
            count(byDomain, "FINANCEIRO");
            if (code.isBlank() || !isDate(table.value(row, "DTCOMP"))) {
                addIssue(issues, table, line, code, "FINANCEIRO", "DATA_INVALIDA",
                        "Lançamento financeiro sem código ou data de competência válida.");
            } else if (decimal(table.value(row, "VALOR")) == null
                    || decimal(table.value(row, "VALOR")).compareTo(BigDecimal.ZERO) <= 0) {
                addIssue(issues, table, line, code, "FINANCEIRO", "VALOR_INVALIDO",
                        "Lançamento financeiro sem valor maior que zero.");
            } else {
                addIssue(issues, table, line, code, "FINANCEIRO", "DECISAO_FINANCEIRA_NECESSARIA",
                        "O arquivo não informa de forma confiável se o lançamento é receita, compra ou gasto geral.");
            }
        }
    }

    private Map<String, Set<String>> referencedContacts(Map<String, LegacyTable> tables) {
        Map<String, Set<String>> references = new HashMap<>();
        registerContactReferences(references, tables.get("compras.xls"));
        registerContactReferences(references, tables.get("vendas.xls"));
        registerContactReferences(references, tables.get("financeiro.xls"));
        return references;
    }

    private void registerContactReferences(Map<String, Set<String>> references, LegacyTable table) {
        if (table == null || !table.hasHeader("CODCONTATO")) return;
        for (List<String> row : table.rows()) {
            String code = table.value(row, "CODCONTATO");
            if (!code.isBlank()) references.computeIfAbsent(code, ignored -> new LinkedHashSet<>()).add(table.fileName());
        }
    }

    private Set<String> codes(LegacyTable table, String column) {
        if (table == null || !table.hasHeader(column)) return Set.of();
        Set<String> codes = new HashSet<>();
        for (List<String> row : table.rows()) {
            String code = table.value(row, column);
            if (!code.isBlank()) codes.add(code);
        }
        return codes;
    }

    private void addIssue(
            Map<String, LegacyHistoricalIssueResponse> issues,
            LegacyTable table,
            int line,
            String code,
            String domain,
            String type,
            String message
    ) {
        String key = table.fileName() + ":" + line + ":" + type;
        issues.putIfAbsent(key, new LegacyHistoricalIssueResponse(
                table.fileName(), line, code, domain, type, message, true));
    }

    private void count(Map<String, Long> byDomain, String domain) {
        byDomain.merge(domain, 1L, Long::sum);
    }

    private boolean isDate(String value) {
        if (value == null || value.isBlank()) return false;
        try {
            LocalDate.parse(value.trim().substring(0, 10));
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private BigDecimal decimal(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim().replace("\u00a0", "").replace(" ", "");
        if (value.contains(",") && value.contains(".")) {
            value = value.lastIndexOf(',') > value.lastIndexOf('.')
                    ? value.replace(".", "").replace(',', '.')
                    : value.replace(",", "");
        } else {
            value = value.replace(',', '.');
        }
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String key(LegacyTable table, int line) {
        return table.fileName() + ":" + line;
    }
}

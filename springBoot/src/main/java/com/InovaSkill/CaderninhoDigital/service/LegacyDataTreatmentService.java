package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyAuditItemResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentItemResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyDataAuditResponse;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyCatalogClassifier;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyItemClassification;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LegacyDataTreatmentService {

    private static final String PRODUCTS_FILE = "produtos.xls";

    private final LegacyDataAuditService auditService;

    public LegacyDataTreatmentService(LegacyDataAuditService auditService) {
        this.auditService = auditService;
    }

    public LegacyCatalogTreatmentResponse preview(List<MultipartFile> files) {
        return treat(auditService.parseFiles(files).values().stream().toList());
    }

    public LegacyCatalogTreatmentResponse treat(List<LegacyTable> tables) {
        Map<String, LegacyTable> byName = new HashMap<>();
        if (tables != null) {
            for (LegacyTable table : tables) {
                if (table != null) {
                    byName.put(LegacyCatalogClassifier.normalizeFileName(table.fileName()), table);
                }
            }
        }

        LegacyTable products = byName.get(PRODUCTS_FILE);
        if (products == null) {
            throw new com.InovaSkill.CaderninhoDigital.exception.BusinessException(
                    "Envie o arquivo produtos.xls para tratar o catálogo.");
        }

        LegacyDataAuditResponse audit = auditService.audit(tables);
        Map<String, Set<String>> contextsByProduct = LegacyCatalogClassifier.collectProductContexts(byName);
        Map<String, LegacyAuditItemResponse> reviewedByLine = new HashMap<>();
        for (LegacyAuditItemResponse item : audit.itensParaRevisao()) {
            reviewedByLine.put(item.arquivo() + ":" + item.linha(), item);
        }

        Map<String, Long> classifications = new TreeMap<>();
        List<LegacyCatalogTreatmentItemResponse> items = new ArrayList<>();
        long ready = 0;
        long review = 0;

        for (int rowIndex = 0; rowIndex < products.rows().size(); rowIndex++) {
            int line = rowIndex + 2;
            List<String> row = products.rows().get(rowIndex);
            String code = products.firstAvailableValue(row, "CODIGO");
            String name = products.firstAvailableValue(row, "IXPROD", "ICPROD", "NOME");
            Set<String> contexts = contextsByProduct.getOrDefault(code, Set.of());
            LegacyItemClassification classification = LegacyCatalogClassifier.classify(contexts);
            classifications.merge(classification.name(), 1L, Long::sum);

            LegacyAuditItemResponse reviewed = reviewedByLine.get(products.fileName() + ":" + line);
            List<String> alerts = new ArrayList<>();
            if (reviewed != null) {
                alerts.addAll(reviewed.alertas());
            }
            alerts.addAll(localAlerts(products, row, classification));
            alerts = alerts.stream().distinct().toList();
            String unit = products.firstAvailableValue(row, "IUCOM", "UNIDADE", "UNIDADEMEDIDA");
            BigDecimal costPrice = decimal(products.value(row, "PRECOCUSTO"));
            BigDecimal salePrice = decimal(products.value(row, "PRECOVENDA"));
            BigDecimal stock = decimal(products.value(row, "ESTOQUE"));
            BigDecimal minimumStock = decimal(products.value(row, "ESTOQUEMINIMO"));
            String status = classification == LegacyItemClassification.REVISAR || !alerts.isEmpty()
                    ? "PENDENTE_REVISAO"
                    : "PRONTO";

            if (status.equals("PRONTO")) {
                ready++;
            } else {
                review++;
            }

            items.add(new LegacyCatalogTreatmentItemResponse(
                    products.fileName(),
                    line,
                    code,
                    name,
                    classification.name(),
                    contexts.stream().sorted().toList(),
                    LegacyCatalogClassifier.reasons(contexts),
                    List.copyOf(alerts),
                    unit,
                    costPrice,
                    salePrice,
                    stock,
                    minimumStock,
                    booleanValue(products.value(row, "ATIVO")),
                    status
            ));
        }

        return new LegacyCatalogTreatmentResponse(
                audit.arquivoPrincipal(),
                audit.arquivosAnalisados(),
                audit.registrosAnalisados(),
                Map.copyOf(classifications),
                ready,
                review,
                List.copyOf(items)
        );
    }

    private List<String> localAlerts(
            LegacyTable products,
            List<String> row,
            LegacyItemClassification classification
    ) {
        List<String> alerts = new ArrayList<>();
        String code = products.firstAvailableValue(row, "CODIGO");
        if (code.isBlank()) {
            alerts.add("CODIGO_LEGADO_AUSENTE: o item precisa de um código para garantir idempotência.");
        }
        String name = products.firstAvailableValue(row, "IXPROD", "ICPROD", "NOME");
        if (name.isBlank()) {
            alerts.add("NOME_AUSENTE: informe o nome antes da importação.");
        } else if (name.length() > 120) {
            alerts.add("NOME_EXCEDIDO: o nome ultrapassa o limite de 120 caracteres.");
        }
        BigDecimal salePrice = decimal(products.value(row, "PRECOVENDA"));
        String rawSalePrice = products.value(row, "PRECOVENDA");
        if (rawSalePrice.isBlank() && classification == LegacyItemClassification.PRODUTO_FINAL) {
            alerts.add("PRECO_VENDA_AUSENTE: produto final precisa de preço de venda.");
        } else if (!rawSalePrice.isBlank() && salePrice == null) {
            alerts.add("PRECO_VENDA_INVALIDO: o preço de venda não é numérico.");
        } else if (salePrice != null && salePrice.compareTo(BigDecimal.ZERO) <= 0) {
            alerts.add("PRECO_VENDA_INVALIDO: o preço de venda precisa ser maior que zero.");
        }
        BigDecimal costPrice = decimal(products.value(row, "PRECOCUSTO"));
        String rawCostPrice = products.value(row, "PRECOCUSTO");
        if (!rawCostPrice.isBlank() && costPrice == null) {
            alerts.add("PRECO_CUSTO_INVALIDO: o custo não é numérico.");
        }
        if (classification == LegacyItemClassification.MATERIA_PRIMA
                && (costPrice == null || costPrice.compareTo(BigDecimal.ZERO) <= 0)) {
            alerts.add("PRECO_CUSTO_INVALIDO: matéria-prima precisa de um custo maior que zero.");
        }
        String rawStock = products.value(row, "ESTOQUE");
        if (!rawStock.isBlank() && decimal(rawStock) == null) {
            alerts.add("ESTOQUE_INVALIDO: o estoque não é numérico.");
        }
        String rawMinimumStock = products.value(row, "ESTOQUEMINIMO");
        if (!rawMinimumStock.isBlank() && decimal(rawMinimumStock) == null) {
            alerts.add("ESTOQUE_MINIMO_INVALIDO: o estoque mínimo não é numérico.");
        }
        String unit = products.firstAvailableValue(row, "IUCOM", "UNIDADE", "UNIDADEMEDIDA");
        if (unit.isBlank()) {
            alerts.add("UNIDADE_AUSENTE: informe a unidade antes da importação.");
        } else if (unit.length() > 30) {
            alerts.add("UNIDADE_EXCEDIDA: a unidade ultrapassa o limite de 30 caracteres.");
        }
        String rawActive = products.value(row, "ATIVO");
        if (!rawActive.isBlank() && booleanValue(rawActive) == null) {
            alerts.add("ATIVO_INVALIDO: o indicador de ativo não é reconhecido.");
        }
        return List.copyOf(alerts);
    }

    private BigDecimal decimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
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
}

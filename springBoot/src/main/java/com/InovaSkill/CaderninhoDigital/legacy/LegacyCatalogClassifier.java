package com.InovaSkill.CaderninhoDigital.legacy;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class LegacyCatalogClassifier {

    private LegacyCatalogClassifier() {
    }

    public static Map<String, Set<String>> collectProductContexts(Map<String, LegacyTable> tables) {
        Map<String, Set<String>> contexts = new HashMap<>();
        registerContext(tables, contexts, "vendasitens.xls", "CODPRODUTO", "VENDA");
        registerContext(tables, contexts, "comprasitens.xls", "CODPRODUTO", "COMPRA");
        registerContext(tables, contexts, "prodreceitas.xls", "CODPRODUTO", "RECEITA_PRODUTO");
        registerContext(tables, contexts, "prodreceitasitens.xls", "CODINSUMO", "RECEITA_INSUMO");
        registerContext(tables, contexts, "producaoitens.xls", "CODPRODUTO", "PRODUCAO");
        registerContext(tables, contexts, "ajusteestoqueitens.xls", "CODPRODUTO", "AJUSTE_ESTOQUE");
        return contexts;
    }

    public static LegacyItemClassification classify(Set<String> contexts) {
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

    public static List<String> reasons(Set<String> contexts) {
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
        if (contexts.contains("COMPRA") && !contexts.contains("RECEITA_INSUMO")
                && !contexts.contains("PRODUCAO")) {
            reasons.add("Aparece apenas em compras; pode ser matéria-prima ou gasto operacional.");
        }
        if (contexts.contains("AJUSTE_ESTOQUE")) {
            reasons.add("Possui histórico de ajuste de estoque.");
        }
        return List.copyOf(reasons);
    }

    public static String normalizeFileName(String fileName) {
        return fileName == null ? "" : fileName.trim().toLowerCase(Locale.ROOT);
    }

    private static void registerContext(
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
}

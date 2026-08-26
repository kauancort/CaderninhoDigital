package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.LegacyCatalogDecisionRequest;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogDecisionAppliedResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogDecisionResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentItemResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyImportRejectionResponse;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LegacyCatalogDecisionService {

    private static final Set<String> ALLOWED_CLASSIFICATIONS = Set.of(
            "PRODUTO_FINAL",
            "MATERIA_PRIMA",
            "GASTO_OPERACIONAL",
            "NAO_IMPORTAR"
    );

    private final LegacyDataTreatmentService treatmentService;

    public LegacyCatalogDecisionService(LegacyDataTreatmentService treatmentService) {
        this.treatmentService = treatmentService;
    }

    public LegacyCatalogDecisionResponse preview(
            List<MultipartFile> files,
            List<LegacyCatalogDecisionRequest> decisions
    ) {
        return resolveTreatment(treatmentService.preview(files), decisions);
    }

    public LegacyCatalogDecisionResponse resolveTables(
            List<LegacyTable> tables,
            List<LegacyCatalogDecisionRequest> decisions
    ) {
        return resolveTreatment(treatmentService.treat(tables), decisions);
    }

    public LegacyCatalogDecisionResponse resolveTreatment(
            LegacyCatalogTreatmentResponse treatment,
            List<LegacyCatalogDecisionRequest> decisions
    ) {
        List<LegacyImportRejectionResponse> rejections = new ArrayList<>();
        Map<String, LegacyCatalogDecisionRequest> decisionsByKey = new HashMap<>();
        Map<String, LegacyCatalogTreatmentItemResponse> itemsByKey = new HashMap<>();
        for (LegacyCatalogTreatmentItemResponse item : treatment.itens()) {
            itemsByKey.put(key(item.arquivo(), item.linha(), item.codigoLegado()), item);
        }

        List<LegacyCatalogDecisionRequest> safeDecisions = decisions == null ? List.of() : decisions;
        for (LegacyCatalogDecisionRequest decision : safeDecisions) {
            String decisionKey = key(decision.arquivo(), decision.linha(), decision.codigoLegado());
            if (decisionsByKey.putIfAbsent(decisionKey, decision) != null) {
                rejections.add(rejection(decision, "DECISAO_DUPLICADA",
                        "Existe mais de uma decisão para o mesmo item."));
                continue;
            }
            if (!itemsByKey.containsKey(decisionKey)) {
                rejections.add(rejection(decision, "ITEM_NAO_ENCONTRADO",
                        "A decisão não corresponde a nenhum item do catálogo enviado."));
                continue;
            }
            if (!ALLOWED_CLASSIFICATIONS.contains(decision.classificacaoFinal())) {
                rejections.add(rejection(decision, "CLASSIFICACAO_INVALIDA",
                        "A classificação final informada não é aceita."));
            }
            if ("PRODUTO_FINAL".equals(decision.classificacaoFinal())
                    && (itemFor(itemsByKey, decisionKey).precoVenda() == null
                    || itemFor(itemsByKey, decisionKey).precoVenda().compareTo(java.math.BigDecimal.ZERO) <= 0)) {
                rejections.add(rejection(decision, "PRECO_VENDA_INVALIDO",
                        "Produto final precisa de preço de venda maior que zero."));
            }
            if ("MATERIA_PRIMA".equals(decision.classificacaoFinal())
                    && (itemFor(itemsByKey, decisionKey).precoCusto() == null
                    || itemFor(itemsByKey, decisionKey).precoCusto().compareTo(java.math.BigDecimal.ZERO) <= 0)) {
                rejections.add(rejection(decision, "PRECO_CUSTO_INVALIDO",
                        "Matéria-prima precisa de custo maior que zero."));
            }
            if ("NAO_IMPORTAR".equals(decision.classificacaoFinal())
                    && (decision.observacao() == null || decision.observacao().isBlank())) {
                rejections.add(rejection(decision, "OBSERVACAO_OBRIGATORIA",
                        "Informe o motivo para não importar o item."));
            }
        }

        List<LegacyCatalogDecisionAppliedResponse> applied = new ArrayList<>();
        Set<String> rejectionKeys = new HashSet<>();
        for (LegacyImportRejectionResponse rejection : rejections) {
            rejectionKeys.add(key(rejection.arquivo(), rejection.linha(), rejection.codigoLegado()));
        }

        long approved = 0;
        long notImported = 0;
        long pending = 0;
        Set<String> blockingReasons = new HashSet<>();

        for (LegacyCatalogTreatmentItemResponse item : treatment.itens()) {
            String itemKey = key(item.arquivo(), item.linha(), item.codigoLegado());
            LegacyCatalogDecisionRequest decision = decisionsByKey.get(itemKey);
            if ("PRONTO".equals(item.status())) {
                approved++;
                continue;
            }
            if (decision == null) {
                pending++;
                rejections.add(rejection(item, "DECISAO_AUSENTE",
                        "Informe uma classificação final para este item."));
                blockingReasons.add("Existem itens sem decisão manual.");
                continue;
            }
            if (item.alertas() != null && !item.alertas().isEmpty()) {
                pending++;
                rejections.add(rejection(item, "DADOS_INVALIDOS",
                        String.join(" ", item.alertas())));
                blockingReasons.add("Existem itens com alertas que precisam ser corrigidos.");
                continue;
            }
            if (rejectionKeys.contains(itemKey)
                    || !ALLOWED_CLASSIFICATIONS.contains(decision.classificacaoFinal())) {
                pending++;
                blockingReasons.add("Existem decisões inválidas ou duplicadas.");
                continue;
            }
            applied.add(new LegacyCatalogDecisionAppliedResponse(
                    item.arquivo(),
                    item.linha(),
                    item.codigoLegado(),
                    decision.classificacaoFinal(),
                    decision.observacao()
            ));
            if ("NAO_IMPORTAR".equals(decision.classificacaoFinal())) {
                notImported++;
            } else {
                approved++;
            }
        }

        if (!rejections.isEmpty()) {
            blockingReasons.add("A importação permanece bloqueada enquanto houver rejeições.");
        }

        return new LegacyCatalogDecisionResponse(
                treatment.arquivoPrincipal(),
                treatment.arquivosAnalisados(),
                treatment.registrosAnalisados(),
                pending == 0 && rejections.isEmpty(),
                approved,
                notImported,
                pending,
                List.copyOf(applied),
                List.copyOf(rejections),
                List.copyOf(blockingReasons)
        );
    }

    private LegacyCatalogTreatmentItemResponse itemFor(
            Map<String, LegacyCatalogTreatmentItemResponse> itemsByKey,
            String key
    ) {
        return itemsByKey.get(key);
    }

    private LegacyImportRejectionResponse rejection(
            LegacyCatalogDecisionRequest decision,
            String type,
            String message
    ) {
        return new LegacyImportRejectionResponse(
                decision.arquivo(),
                decision.linha() == null ? 0 : decision.linha(),
                decision.codigoLegado(),
                "",
                type,
                message,
                true
        );
    }

    private LegacyImportRejectionResponse rejection(
            LegacyCatalogTreatmentItemResponse item,
            String type,
            String message
    ) {
        return new LegacyImportRejectionResponse(
                item.arquivo(),
                item.linha(),
                item.codigoLegado(),
                item.nome(),
                type,
                message,
                true
        );
    }

    private String key(String file, Integer line, String code) {
        return (file == null ? "" : file) + ":" + (line == null ? 0 : line) + ":" + (code == null ? "" : code);
    }
}

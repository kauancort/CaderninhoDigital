package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentItemResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyImportRejectionResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyImportSimulationResponse;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LegacyImportSimulationService {

    private final LegacyDataTreatmentService treatmentService;

    public LegacyImportSimulationService(LegacyDataTreatmentService treatmentService) {
        this.treatmentService = treatmentService;
    }

    public LegacyImportSimulationResponse simulate(List<MultipartFile> files) {
        return simulate(treatmentService.preview(files));
    }

    public LegacyImportSimulationResponse simulateTables(List<LegacyTable> tables) {
        return simulate(treatmentService.treat(tables));
    }

    private LegacyImportSimulationResponse simulate(LegacyCatalogTreatmentResponse treatment) {
        List<LegacyImportRejectionResponse> rejections = new ArrayList<>();
        Set<String> blockingReasons = new LinkedHashSet<>();

        for (LegacyCatalogTreatmentItemResponse item : treatment.itens()) {
            if (!item.status().equals("PENDENTE_REVISAO")) {
                continue;
            }
            if (item.alertas().isEmpty()) {
                rejections.add(new LegacyImportRejectionResponse(
                        item.arquivo(),
                        item.linha(),
                        item.codigoLegado(),
                        item.nome(),
                        "CLASSIFICACAO_AMBIGUA",
                        "A classificação precisa ser confirmada antes da importação.",
                        true
                ));
                blockingReasons.add("Existem itens com classificação ambígua.");
                continue;
            }
            for (String alert : item.alertas()) {
                int separator = alert.indexOf(':');
                String type = separator > 0 ? alert.substring(0, separator) : "DADO_INVALIDO";
                String message = separator > 0 ? alert.substring(separator + 1).trim() : alert;
                rejections.add(new LegacyImportRejectionResponse(
                        item.arquivo(),
                        item.linha(),
                        item.codigoLegado(),
                        item.nome(),
                        type,
                        message,
                        true
                ));
                blockingReasons.add("Existem dados inválidos ou alertas bloqueantes.");
            }
        }

        long pending = treatment.itensParaRevisao();
        if (pending > 0) {
            blockingReasons.add("A simulação não pode liberar a importação enquanto houver pendências.");
        }

        return new LegacyImportSimulationResponse(
                treatment.arquivoPrincipal(),
                treatment.arquivosAnalisados(),
                treatment.registrosAnalisados(),
                pending == 0 && !treatment.itens().isEmpty(),
                treatment.itensProntos(),
                pending,
                List.copyOf(rejections),
                List.copyOf(blockingReasons)
        );
    }
}

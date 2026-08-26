package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.LegacyCatalogDecisionRequest;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogDecisionResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogImportResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyDataAuditResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyHistoricalTreatmentResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyContactImportResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyContactPreviewResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyImportSimulationResponse;
import com.InovaSkill.CaderninhoDigital.service.LegacyDataAuditService;
import com.InovaSkill.CaderninhoDigital.service.LegacyDataTreatmentService;
import com.InovaSkill.CaderninhoDigital.service.LegacyImportSimulationService;
import com.InovaSkill.CaderninhoDigital.service.LegacyCatalogDecisionService;
import com.InovaSkill.CaderninhoDigital.service.LegacyCatalogImportService;
import com.InovaSkill.CaderninhoDigital.service.LegacyHistoricalTreatmentService;
import com.InovaSkill.CaderninhoDigital.service.LegacyContactImportService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/configuracoes/dados-legados")
@RequiredArgsConstructor
public class LegacyDataController {

    private final LegacyDataAuditService auditService;
    private final LegacyDataTreatmentService treatmentService;
    private final LegacyImportSimulationService simulationService;
    private final LegacyCatalogDecisionService decisionService;
    private final LegacyCatalogImportService importService;
    private final LegacyHistoricalTreatmentService historicalTreatmentService;
    private final LegacyContactImportService contactImportService;

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LegacyDataAuditResponse> preview(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestPart("arquivos") List<MultipartFile> arquivos
    ) {
        return ResponseEntity.ok(auditService.preview(arquivos));
    }

    @PostMapping(value = "/tratamento-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LegacyCatalogTreatmentResponse> treatmentPreview(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestPart("arquivos") List<MultipartFile> arquivos
    ) {
        return ResponseEntity.ok(treatmentService.preview(arquivos));
    }

    @PostMapping(value = "/simulacao", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LegacyImportSimulationResponse> simulation(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestPart("arquivos") List<MultipartFile> arquivos
    ) {
        return ResponseEntity.ok(simulationService.simulate(arquivos));
    }

    @PostMapping(value = "/decisoes-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LegacyCatalogDecisionResponse> decisionsPreview(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestPart("arquivos") List<MultipartFile> arquivos,
            @RequestPart("decisoes") List<LegacyCatalogDecisionRequest> decisoes
    ) {
        return ResponseEntity.ok(decisionService.preview(arquivos, decisoes));
    }

    @PostMapping(value = "/importacao-catalogo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LegacyCatalogImportResponse> importCatalog(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestPart("arquivos") List<MultipartFile> arquivos,
            @RequestPart("decisoes") List<LegacyCatalogDecisionRequest> decisoes
    ) {
        return ResponseEntity.ok(importService.importCatalog(usuarioId, arquivos, decisoes));
    }

    @PostMapping(value = "/historicos-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LegacyHistoricalTreatmentResponse> historicalPreview(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestPart("arquivos") List<MultipartFile> arquivos
    ) {
        return ResponseEntity.ok(historicalTreatmentService.preview(arquivos));
    }

    @PostMapping(value = "/importacao-contatos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LegacyContactImportResponse> importContacts(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestPart("arquivos") List<MultipartFile> arquivos
    ) {
        return ResponseEntity.ok(contactImportService.importContacts(usuarioId, arquivos));
    }

    @PostMapping(value = "/contatos-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LegacyContactPreviewResponse> contactsPreview(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestPart("arquivos") List<MultipartFile> arquivos
    ) {
        return ResponseEntity.ok(contactImportService.previewContacts(arquivos));
    }
}

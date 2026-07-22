package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.response.InsightResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.InsightService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/insights")
@RequiredArgsConstructor
public class InsightController {

    private final InsightService insightService;

    @GetMapping
    public ResponseEntity<List<InsightResponseDTO>> listar(@UsuarioIdAutenticado Long usuarioId) {
        List<InsightResponseDTO> response = insightService.listar(usuarioId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/gerar")
    public ResponseEntity<List<InsightResponseDTO>> gerar(@UsuarioIdAutenticado Long usuarioId) {
        List<InsightResponseDTO> response = insightService.gerar(usuarioId);
        return ResponseEntity.ok(response);
    }
}

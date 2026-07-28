package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.InterpretarVozRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ConversaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VozResultadoResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.GeminiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/assistente")
@RequiredArgsConstructor
public class AssistenteController {

    private final GeminiService geminiService;

    @PostMapping("/interpretar-voz")
    public ResponseEntity<VozResultadoResponseDTO> interpretarVoz(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestBody @Valid InterpretarVozRequestDTO request
    ) {
        VozResultadoResponseDTO response = geminiService.interpretarVoz(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/conversa")
    public ResponseEntity<ConversaResponseDTO> conversa(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestBody @Valid ConversaRequestDTO request
    ) {
        ConversaResponseDTO response = geminiService.conversar(usuarioId, request);
        return ResponseEntity.ok(response);
    }
}

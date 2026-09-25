package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.InterpretarVozRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ConversaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VozResultadoResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.OpenRouterService;
import com.InovaSkill.CaderninhoDigital.service.AssistenteContratoService;
import com.InovaSkill.CaderninhoDigital.service.AssistenteOrquestradorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/assistente")
@RequiredArgsConstructor
public class AssistenteController {

    private final OpenRouterService openRouterService;
    private final AssistenteContratoService contratoService;
    private final AssistenteOrquestradorService orquestradorService;

    @PostMapping("/interpretar-voz")
    public ResponseEntity<VozResultadoResponseDTO> interpretarVoz(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestBody @Valid InterpretarVozRequestDTO request
    ) {
        VozResultadoResponseDTO response = openRouterService.interpretarVoz(usuarioId, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/transcrever-audio", consumes = "multipart/form-data")
    public ResponseEntity<java.util.Map<String, String>> transcreverAudio(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestPart("audio") MultipartFile audio
    ) {
        return ResponseEntity.ok(java.util.Map.of("texto", openRouterService.transcreverAudio(usuarioId, audio)));
    }

    @PostMapping("/conversa")
    public ResponseEntity<ConversaResponseDTO> conversa(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestBody @Valid ConversaRequestDTO request
    ) {
        ConversaRequestDTO preparada = contratoService.preparar(request);
        ConversaResponseDTO response = contratoService.finalizar(
                orquestradorService.conversar(preparada), preparada);
        return ResponseEntity.ok(response);
    }
}

package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.ProducaoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ProducaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.ProducaoService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/producoes")
@RequiredArgsConstructor
public class ProducaoController {

    private final ProducaoService producaoService;

    @PostMapping
    public ResponseEntity<ProducaoResponseDTO> criar(@RequestHeader("X-Usuario-Id") Long usuarioId, @RequestBody @Valid ProducaoRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(producaoService.criar(usuarioId, dto));
    }

    @GetMapping
    public ResponseEntity<List<ProducaoResponseDTO>> listar(@RequestHeader("X-Usuario-Id") Long usuarioId) {
        return ResponseEntity.ok(producaoService.listar(usuarioId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProducaoResponseDTO> buscar(@RequestHeader("X-Usuario-Id") Long usuarioId, @PathVariable Long id) {
        return ResponseEntity.ok(producaoService.buscar(usuarioId, id));
    }
}

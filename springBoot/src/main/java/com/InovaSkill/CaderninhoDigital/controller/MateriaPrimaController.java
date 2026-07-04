package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.MateriaPrimaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.MateriaPrimaResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.MateriaPrimaService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/materias-primas")
@RequiredArgsConstructor
public class MateriaPrimaController {

    private final MateriaPrimaService materiaPrimaService;

    @PostMapping
    public ResponseEntity<MateriaPrimaResponseDTO> criar(@RequestHeader("X-Usuario-Id") Long usuarioId, @RequestBody @Valid MateriaPrimaRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(materiaPrimaService.criar(usuarioId, dto));
    }

    @GetMapping
    public ResponseEntity<List<MateriaPrimaResponseDTO>> listar(@RequestHeader("X-Usuario-Id") Long usuarioId) {
        return ResponseEntity.ok(materiaPrimaService.listar(usuarioId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MateriaPrimaResponseDTO> buscar(@RequestHeader("X-Usuario-Id") Long usuarioId, @PathVariable Long id) {
        return ResponseEntity.ok(materiaPrimaService.buscar(usuarioId, id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MateriaPrimaResponseDTO> atualizar(@RequestHeader("X-Usuario-Id") Long usuarioId, @PathVariable Long id, @RequestBody @Valid MateriaPrimaRequestDTO dto) {
        return ResponseEntity.ok(materiaPrimaService.atualizar(usuarioId, id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@RequestHeader("X-Usuario-Id") Long usuarioId, @PathVariable Long id) {
        materiaPrimaService.deletar(usuarioId, id);
        return ResponseEntity.noContent().build();
    }
}

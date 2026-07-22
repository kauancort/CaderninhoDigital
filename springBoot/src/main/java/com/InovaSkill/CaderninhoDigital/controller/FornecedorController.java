package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.FornecedorRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.FornecedorResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.FornecedorService;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/fornecedores")
@RequiredArgsConstructor
public class FornecedorController {

    private final FornecedorService fornecedorService;

    @PostMapping
    public ResponseEntity<FornecedorResponseDTO> criar(@UsuarioIdAutenticado Long usuarioId, @RequestBody @Valid FornecedorRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(fornecedorService.criar(usuarioId, dto));
    }

    @GetMapping
    public ResponseEntity<List<FornecedorResponseDTO>> listar(@UsuarioIdAutenticado Long usuarioId) {
        return ResponseEntity.ok(fornecedorService.listar(usuarioId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<FornecedorResponseDTO> buscar(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id) {
        return ResponseEntity.ok(fornecedorService.buscar(usuarioId, id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FornecedorResponseDTO> atualizar(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id, @RequestBody @Valid FornecedorRequestDTO dto) {
        return ResponseEntity.ok(fornecedorService.atualizar(usuarioId, id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id) {
        fornecedorService.deletar(usuarioId, id);
        return ResponseEntity.noContent().build();
    }
}

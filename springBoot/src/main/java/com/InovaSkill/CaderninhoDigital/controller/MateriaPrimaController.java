package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.MateriaPrimaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.MateriaPrimaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.PaginaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoMateriaPrimaEstoqueDTO;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/api/v1/materias-primas")
@RequiredArgsConstructor
public class MateriaPrimaController {

    private final MateriaPrimaService materiaPrimaService;

    @PostMapping
    public ResponseEntity<MateriaPrimaResponseDTO> criar(@UsuarioIdAutenticado Long usuarioId, @RequestBody @Valid MateriaPrimaRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(materiaPrimaService.criar(usuarioId, dto));
    }

    @GetMapping
    public ResponseEntity<List<MateriaPrimaResponseDTO>> listar(@UsuarioIdAutenticado Long usuarioId) {
        return ResponseEntity.ok(materiaPrimaService.listar(usuarioId));
    }

    @GetMapping("/pagina")
    public ResponseEntity<PaginaResponseDTO<MateriaPrimaResponseDTO>> pesquisar(
            @UsuarioIdAutenticado Long usuarioId, @RequestParam(required = false) String busca,
            @RequestParam(defaultValue = "0") int pagina, @RequestParam(defaultValue = "20") int tamanho,
            @RequestParam(required = false) Boolean ativo,
            @RequestParam(required = false) Boolean emAlerta) {
        return ResponseEntity.ok(PaginaResponseDTO.de(
                materiaPrimaService.pesquisar(usuarioId, busca, pagina, tamanho, ativo, emAlerta)));
    }

    @GetMapping("/resumo-estoque")
    public ResponseEntity<ResumoMateriaPrimaEstoqueDTO> resumirEstoque(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) Boolean ativo
    ) {
        return ResponseEntity.ok(materiaPrimaService.resumirEstoque(usuarioId, busca, ativo));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MateriaPrimaResponseDTO> buscar(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id) {
        return ResponseEntity.ok(materiaPrimaService.buscar(usuarioId, id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MateriaPrimaResponseDTO> atualizar(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id, @RequestBody @Valid MateriaPrimaRequestDTO dto) {
        return ResponseEntity.ok(materiaPrimaService.atualizar(usuarioId, id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(
            @UsuarioIdAutenticado Long usuarioId,
            @PathVariable Long id,
            @RequestParam(required = false) String motivo
    ) {
        materiaPrimaService.deletar(usuarioId, id, motivo);
        return ResponseEntity.noContent().build();
    }
}

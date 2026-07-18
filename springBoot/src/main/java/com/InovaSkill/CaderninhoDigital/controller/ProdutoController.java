package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.ProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ProdutoResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ProdutoResumoResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.PaginaResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.ProdutoService;
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
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/api/v1/produtos")
@RequiredArgsConstructor
public class ProdutoController {

    private final ProdutoService produtoService;

    @PostMapping
    public ResponseEntity<ProdutoResponseDTO> criar(@RequestHeader("X-Usuario-Id") Long usuarioId, @RequestBody @Valid ProdutoRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(produtoService.criar(usuarioId, dto));
    }

    @GetMapping
    public ResponseEntity<List<ProdutoResponseDTO>> listar(@RequestHeader("X-Usuario-Id") Long usuarioId) {
        return ResponseEntity.ok(produtoService.listar(usuarioId));
    }

    @GetMapping("/pagina")
    public ResponseEntity<PaginaResponseDTO<ProdutoResumoResponseDTO>> pesquisar(
            @RequestHeader("X-Usuario-Id") Long usuarioId, @RequestParam(required = false) String busca,
            @RequestParam(defaultValue = "0") int pagina, @RequestParam(defaultValue = "20") int tamanho,
            @RequestParam(required = false) Boolean ativo) {
        return ResponseEntity.ok(PaginaResponseDTO.de(produtoService.pesquisar(usuarioId, busca, pagina, tamanho, ativo)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProdutoResponseDTO> buscar(@RequestHeader("X-Usuario-Id") Long usuarioId, @PathVariable Long id) {
        return ResponseEntity.ok(produtoService.buscar(usuarioId, id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProdutoResponseDTO> atualizar(@RequestHeader("X-Usuario-Id") Long usuarioId, @PathVariable Long id, @RequestBody @Valid ProdutoRequestDTO dto) {
        return ResponseEntity.ok(produtoService.atualizar(usuarioId, id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@RequestHeader("X-Usuario-Id") Long usuarioId, @PathVariable Long id) {
        produtoService.deletar(usuarioId, id);
        return ResponseEntity.noContent().build();
    }
}

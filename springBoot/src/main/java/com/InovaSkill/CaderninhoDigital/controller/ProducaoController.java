package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.ProducaoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.PaginaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ProducaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.ProducaoService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public ResponseEntity<List<ProducaoResponseDTO>> listar(
            @RequestHeader("X-Usuario-Id") Long usuarioId,
            @RequestParam(required = false) Long produtoId
    ) {
        return ResponseEntity.ok(producaoService.listar(usuarioId, produtoId));
    }

    @GetMapping("/pagina")
    public ResponseEntity<PaginaResponseDTO<ProducaoResponseDTO>> listarPaginado(
            @RequestHeader("X-Usuario-Id") Long usuarioId,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamanho,
            @RequestParam(defaultValue = "dataProducao") String ordenarPor,
            @RequestParam(defaultValue = "DESC") Sort.Direction direcao,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @RequestParam(required = false) Long produtoId
    ) {
        return ResponseEntity.ok(PaginaResponseDTO.de(producaoService.listarPaginado(
                usuarioId, pagina, tamanho, ordenarPor, direcao, inicio, fim, produtoId)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProducaoResponseDTO> buscar(@RequestHeader("X-Usuario-Id") Long usuarioId, @PathVariable Long id) {
        return ResponseEntity.ok(producaoService.buscar(usuarioId, id));
    }
}

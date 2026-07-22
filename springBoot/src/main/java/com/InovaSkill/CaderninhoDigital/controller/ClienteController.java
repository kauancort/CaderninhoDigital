package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.ClienteRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ClienteResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.PaginaResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.ClienteService;
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
@RequestMapping("/api/v1/clientes")
@RequiredArgsConstructor
public class ClienteController {

    private final ClienteService clienteService;

    @PostMapping
    public ResponseEntity<ClienteResponseDTO> criar(@UsuarioIdAutenticado Long usuarioId, @RequestBody @Valid ClienteRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(clienteService.criar(usuarioId, dto));
    }

    @GetMapping
    public ResponseEntity<List<ClienteResponseDTO>> listar(@UsuarioIdAutenticado Long usuarioId) {
        return ResponseEntity.ok(clienteService.listar(usuarioId));
    }

    @GetMapping("/pagina")
    public ResponseEntity<PaginaResponseDTO<ClienteResponseDTO>> pesquisar(
            @UsuarioIdAutenticado Long usuarioId, @RequestParam(required = false) String busca,
            @RequestParam(defaultValue = "0") int pagina, @RequestParam(defaultValue = "20") int tamanho,
            @RequestParam(required = false) Boolean ativo) {
        return ResponseEntity.ok(PaginaResponseDTO.de(clienteService.pesquisar(usuarioId, busca, pagina, tamanho, ativo)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClienteResponseDTO> buscar(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id) {
        return ResponseEntity.ok(clienteService.buscar(usuarioId, id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClienteResponseDTO> atualizar(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id, @RequestBody @Valid ClienteRequestDTO dto) {
        return ResponseEntity.ok(clienteService.atualizar(usuarioId, id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id) {
        clienteService.deletar(usuarioId, id);
        return ResponseEntity.noContent().build();
    }
}

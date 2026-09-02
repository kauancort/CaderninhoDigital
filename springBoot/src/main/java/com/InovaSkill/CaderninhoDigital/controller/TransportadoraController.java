package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.TransportadoraRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.TransportadoraResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.TransportadoraDetalhesResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.TransportadoraService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/*
 * ADICIONADO (Card 3). Aninhado em /clientes/{clienteId}/transportadora
 * porque a transportadora agora é uma propriedade do cliente, não da
 * venda. GET retorna 204 (corpo vazio) se o cliente ainda não tiver
 * transportadora cadastrada, para o frontend saber se mostra o form
 * de cadastro ou os dados já preenchidos.
 */
@RestController
@RequestMapping("/api/v1/clientes/{clienteId}/transportadora")
@RequiredArgsConstructor
public class TransportadoraController {

    private final TransportadoraService transportadoraService;

    @GetMapping
    public ResponseEntity<TransportadoraResponseDTO> buscar(
            @UsuarioIdAutenticado Long usuarioId,
            @PathVariable Long clienteId
    ) {
        return transportadoraService.buscarPorCliente(usuarioId, clienteId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/detalhes")
    public ResponseEntity<TransportadoraDetalhesResponseDTO> detalhes(
            @UsuarioIdAutenticado Long usuarioId,
            @PathVariable Long clienteId
    ) {
        return ResponseEntity.ok(transportadoraService.buscarDetalhes(usuarioId, clienteId));
    }

    @PutMapping
    public ResponseEntity<TransportadoraResponseDTO> salvar(
            @UsuarioIdAutenticado Long usuarioId,
            @PathVariable Long clienteId,
            @RequestBody @Valid TransportadoraRequestDTO dto
    ) {
        return ResponseEntity.ok(transportadoraService.salvar(usuarioId, clienteId, dto));
    }

    @DeleteMapping
    public ResponseEntity<Void> remover(
            @UsuarioIdAutenticado Long usuarioId,
            @PathVariable Long clienteId
    ) {
        transportadoraService.remover(usuarioId, clienteId);
        return ResponseEntity.noContent().build();
    }
}

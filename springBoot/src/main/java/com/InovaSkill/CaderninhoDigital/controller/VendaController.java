package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.ContatoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.VendaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.PaginaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.CobrancaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoCobrancasResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoHistoricoVendasResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaDetalhesResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaHistoricoItemResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaDuplicacaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.SituacaoCobranca;
import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import com.InovaSkill.CaderninhoDigital.service.VendaService;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/vendas")
@RequiredArgsConstructor
public class VendaController {

    private final VendaService vendaService;

    @PostMapping
    public ResponseEntity<VendaResponseDTO> criar(@UsuarioIdAutenticado Long usuarioId, @RequestBody @Valid VendaRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(vendaService.criar(usuarioId, dto));
    }

    @GetMapping
    public ResponseEntity<List<VendaResponseDTO>> listar(@UsuarioIdAutenticado Long usuarioId) {
        return ResponseEntity.ok(vendaService.listar(usuarioId));
    }

    @GetMapping("/aguardando-estoque")
    public ResponseEntity<List<VendaResponseDTO>> listarAguardandoEstoque(@UsuarioIdAutenticado Long usuarioId) {
        return ResponseEntity.ok(vendaService.listarAguardandoEstoque(usuarioId));
    }

    @GetMapping("/pagina")
    public ResponseEntity<PaginaResponseDTO<VendaResponseDTO>> listarPaginado(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamanho,
            @RequestParam(defaultValue = "dataVenda") String ordenarPor,
            @RequestParam(defaultValue = "DESC") Sort.Direction direcao,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) StatusPagamento status
    ) {
        return ResponseEntity.ok(PaginaResponseDTO.de(vendaService.listarPaginado(
                usuarioId, pagina, tamanho, ordenarPor, direcao, inicio, fim, clienteId, status)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<VendaResponseDTO> buscar(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id) {
        return ResponseEntity.ok(vendaService.buscar(usuarioId, id));
    }

    @GetMapping("/{id}/detalhes")
    public ResponseEntity<VendaDetalhesResponseDTO> buscarDetalhes(
            @UsuarioIdAutenticado Long usuarioId,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(vendaService.buscarDetalhes(usuarioId, id));
    }

    @GetMapping("/historico")
    public ResponseEntity<PaginaResponseDTO<VendaHistoricoItemResponseDTO>> listarHistorico(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamanho,
            @RequestParam(defaultValue = "dataVenda") String ordenarPor,
            @RequestParam(defaultValue = "DESC") Sort.Direction direcao,
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) Long produtoId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @RequestParam(required = false) StatusPagamento status,
            @RequestParam(required = false) FormaPagamento forma,
            @RequestParam(required = false) Boolean parcelada
    ) {
        return ResponseEntity.ok(PaginaResponseDTO.de(vendaService.listarHistorico(
                usuarioId, pagina, tamanho, ordenarPor, direcao, busca, clienteId, produtoId,
                inicio, fim, status, forma, parcelada)));
    }

    @GetMapping("/historico/resumo")
    public ResponseEntity<ResumoHistoricoVendasResponseDTO> resumirHistorico(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) Long produtoId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @RequestParam(required = false) StatusPagamento status,
            @RequestParam(required = false) FormaPagamento forma,
            @RequestParam(required = false) Boolean parcelada
    ) {
        return ResponseEntity.ok(vendaService.resumirHistorico(
                usuarioId, busca, clienteId, produtoId, inicio, fim, status, forma, parcelada));
    }

    @GetMapping("/cobrancas")
    public ResponseEntity<PaginaResponseDTO<CobrancaResponseDTO>> listarCobrancas(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamanho,
            @RequestParam(defaultValue = "maiorAtraso") String ordenarPor,
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) Long produtoId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @RequestParam(required = false) SituacaoCobranca situacao,
            @RequestParam(required = false) FormaPagamento forma,
            @RequestParam(required = false) Boolean parcelada
    ) {
        return ResponseEntity.ok(PaginaResponseDTO.de(vendaService.listarCobrancas(
                usuarioId, pagina, tamanho, ordenarPor, busca, clienteId, produtoId, inicio, fim,
                situacao, forma, parcelada)));
    }

    @GetMapping("/cobrancas/resumo")
    public ResponseEntity<ResumoCobrancasResponseDTO> resumirCobrancas(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) Long produtoId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @RequestParam(required = false) SituacaoCobranca situacao,
            @RequestParam(required = false) FormaPagamento forma,
            @RequestParam(required = false) Boolean parcelada
    ) {
        return ResponseEntity.ok(vendaService.resumirCobrancas(
                usuarioId, busca, clienteId, produtoId, inicio, fim, situacao, forma, parcelada));
    }

    @PostMapping("/{id}/confirmar-pagamento")
    public ResponseEntity<VendaResponseDTO> confirmarPagamento(
            @UsuarioIdAutenticado Long usuarioId,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(vendaService.confirmarPagamento(usuarioId, id));
    }

    @GetMapping("/{id}/duplicacao")
    public ResponseEntity<VendaDuplicacaoResponseDTO> prepararDuplicacao(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id) {
        return ResponseEntity.ok(vendaService.prepararDuplicacao(usuarioId, id));
    }

    @PostMapping("/{id}/contatos")
    public ResponseEntity<VendaResponseDTO> adicionarContato(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id, @RequestBody @Valid ContatoRequestDTO dto) {
        return ResponseEntity.ok(vendaService.adicionarContato(usuarioId, id, dto));
    }
}
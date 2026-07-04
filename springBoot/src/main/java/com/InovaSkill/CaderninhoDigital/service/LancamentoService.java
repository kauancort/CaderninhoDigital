package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.LancamentoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.LancamentoResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Lancamento;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.TipoLancamento;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.LancamentoRepository;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LancamentoService {

    private final LancamentoRepository lancamentoRepository;
    private final UsuarioRepository usuarioRepository;

    public LancamentoResponseDTO criar(Long usuarioId, LancamentoRequestDTO dto) {
        Usuario gestor = buscarGestor(usuarioId);
        validarLancamento(dto);

        Lancamento lancamento = Lancamento.builder()
                .tipo(dto.getTipo())
                .titulo(dto.getTitulo())
                .descricao(dto.getDescricao())
                .valorTotal(dto.getValorTotal())
                .quantidade(dto.getQuantidade())
                .unidadeMedida(dto.getUnidadeMedida())
                .nomeProdutoOuInsumo(dto.getNomeProdutoOuInsumo())
                .clienteOuFornecedor(dto.getClienteOuFornecedor())
                .formaPagamento(dto.getFormaPagamento())
                .statusPagamento(statusOuPadrao(dto.getStatusPagamento()))
                .dataLancamento(dto.getDataLancamento())
                .dataVencimento(dto.getDataVencimento())
                .gestor(gestor)
                .build();

        Lancamento salvo = lancamentoRepository.save(lancamento);
        return toResponse(salvo);
    }

    public List<LancamentoResponseDTO> listar(Long usuarioId, TipoLancamento tipo, LocalDate inicio, LocalDate fim) {
        Usuario gestor = buscarGestor(usuarioId);

        List<Lancamento> lancamentos;
        if (tipo != null && inicio != null && fim != null) {
            lancamentos = lancamentoRepository.findByGestorAndTipoAndDataLancamentoBetweenOrderByDataLancamentoDesc(
                    gestor, tipo, inicio, fim
            );
        } else if (tipo != null) {
            lancamentos = lancamentoRepository.findByGestorAndTipoOrderByDataLancamentoDesc(gestor, tipo);
        } else if (inicio != null && fim != null) {
            lancamentos = lancamentoRepository.findByGestorAndDataLancamentoBetweenOrderByDataLancamentoDesc(
                    gestor, inicio, fim
            );
        } else {
            lancamentos = lancamentoRepository.findByGestorOrderByDataLancamentoDesc(gestor);
        }

        return lancamentos.stream()
                .map(this::toResponse)
                .toList();
    }

    public LancamentoResponseDTO buscarPorId(Long usuarioId, Long id) {
        Usuario gestor = buscarGestor(usuarioId);
        Lancamento lancamento = buscarLancamento(id);
        validarDonoDoLancamento(lancamento, gestor);
        return toResponse(lancamento);
    }

    public LancamentoResponseDTO atualizar(Long usuarioId, Long id, LancamentoRequestDTO dto) {
        Usuario gestor = buscarGestor(usuarioId);
        validarLancamento(dto);

        Lancamento lancamento = buscarLancamento(id);
        validarDonoDoLancamento(lancamento, gestor);

        lancamento.setTipo(dto.getTipo());
        lancamento.setTitulo(dto.getTitulo());
        lancamento.setDescricao(dto.getDescricao());
        lancamento.setValorTotal(dto.getValorTotal());
        lancamento.setQuantidade(dto.getQuantidade());
        lancamento.setUnidadeMedida(dto.getUnidadeMedida());
        lancamento.setNomeProdutoOuInsumo(dto.getNomeProdutoOuInsumo());
        lancamento.setClienteOuFornecedor(dto.getClienteOuFornecedor());
        lancamento.setFormaPagamento(dto.getFormaPagamento());
        lancamento.setStatusPagamento(statusOuPadrao(dto.getStatusPagamento()));
        lancamento.setDataLancamento(dto.getDataLancamento());
        lancamento.setDataVencimento(dto.getDataVencimento());

        Lancamento atualizado = lancamentoRepository.save(lancamento);
        return toResponse(atualizado);
    }

    public void deletar(Long usuarioId, Long id) {
        Usuario gestor = buscarGestor(usuarioId);
        Lancamento lancamento = buscarLancamento(id);
        validarDonoDoLancamento(lancamento, gestor);
        lancamentoRepository.delete(lancamento);
    }

    private Usuario buscarGestor(Long usuarioId) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        if (usuario.getPerfil() != PerfilUsuario.GESTOR) {
            throw new BusinessException("Nesta primeira versão, apenas gestores podem realizar lançamentos");
        }

        return usuario;
    }

    private Lancamento buscarLancamento(Long id) {
        return lancamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento não encontrado"));
    }

    private void validarDonoDoLancamento(Lancamento lancamento, Usuario gestor) {
        if (!lancamento.getGestor().getId().equals(gestor.getId())) {
            throw new BusinessException("Este lançamento não pertence ao usuário informado");
        }
    }

    private void validarLancamento(LancamentoRequestDTO dto) {
        if (dto.getTipo() == TipoLancamento.PRODUCAO && dto.getQuantidade() == null) {
            throw new BusinessException("Para produção, informe a quantidade produzida");
        }

        if (dto.getTipo() == TipoLancamento.VENDA && isBlank(dto.getClienteOuFornecedor())) {
            throw new BusinessException("Para venda, informe o cliente");
        }

        if (dto.getTipo() == TipoLancamento.COMPRA_PRODUTO && isBlank(dto.getNomeProdutoOuInsumo())) {
            throw new BusinessException("Para compra de produto, informe o produto, ingrediente ou insumo comprado");
        }
    }

    private StatusPagamento statusOuPadrao(StatusPagamento statusPagamento) {
        return statusPagamento != null ? statusPagamento : StatusPagamento.NAO_SE_APLICA;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private LancamentoResponseDTO toResponse(Lancamento lancamento) {
        return LancamentoResponseDTO.builder()
                .id(lancamento.getId())
                .tipo(lancamento.getTipo())
                .titulo(lancamento.getTitulo())
                .descricao(lancamento.getDescricao())
                .valorTotal(lancamento.getValorTotal())
                .quantidade(lancamento.getQuantidade())
                .unidadeMedida(lancamento.getUnidadeMedida())
                .nomeProdutoOuInsumo(lancamento.getNomeProdutoOuInsumo())
                .clienteOuFornecedor(lancamento.getClienteOuFornecedor())
                .formaPagamento(lancamento.getFormaPagamento())
                .statusPagamento(lancamento.getStatusPagamento())
                .dataLancamento(lancamento.getDataLancamento())
                .dataVencimento(lancamento.getDataVencimento())
                .gestorId(lancamento.getGestor().getId())
                .gestorNome(lancamento.getGestor().getNome())
                .criadoEm(lancamento.getCriadoEm())
                .atualizadoEm(lancamento.getAtualizadoEm())
                .build();
    }
}

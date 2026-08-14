package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.MateriaPrimaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.MateriaPrimaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoMateriaPrimaEstoqueDTO;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MateriaPrimaService {

    private final MateriaPrimaRepository materiaPrimaRepository;
    private final UsuarioAcessoService usuarioAcessoService;
    private final MovimentacaoEstoqueService movimentacaoEstoqueService;
    private final HistoricoValorService historicoValorService;
    private final AuditoriaService auditoriaService;

    @Transactional
    public MateriaPrimaResponseDTO criar(Long usuarioId, MateriaPrimaRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        MateriaPrima materiaPrima = MateriaPrima.builder()
                .nome(dto.getNome())
                .descricao(dto.getDescricao())
                .unidadeMedida(dto.getUnidadeMedida())
                .estoqueAtual(valorOuZero(dto.getEstoqueAtual()))
                .estoqueMinimo(valorOuZero(dto.getEstoqueMinimo()))
                .custoMedio(valorOuZero(dto.getCustoMedio()))
                .ativo(dto.getAtivo())
                .gestor(gestor)
                .build();
        MateriaPrima salva = materiaPrimaRepository.save(materiaPrima);
        historicoValorService.registrarCusto(
                salva, gestor, null, "Custo inicial da matéria-prima", "CADASTRO_MATERIA_PRIMA");
        movimentacaoEstoqueService.registrarMateriaPrima(
                salva, gestor, BigDecimal.ZERO, salva.getEstoqueAtual(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.CADASTRO,
                null,
                "Saldo inicial no cadastro da matéria-prima");
        return toResponse(salva);
    }

    public List<MateriaPrimaResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        return materiaPrimaRepository.findAllByAtivoTrueOrderByNomeAsc().stream().map(this::toResponse).toList();
    }

    public Page<MateriaPrimaResponseDTO> pesquisar(
            Long usuarioId, String busca, int pagina, int tamanho, Boolean ativo, Boolean emAlerta) {
        usuarioAcessoService.buscarGestor(usuarioId);
        String termo = busca == null ? "" : busca.trim().toLowerCase(Locale.ROOT);
        Specification<MateriaPrima> filtro = (root, query, cb) -> {
            var p = cb.conjunction();
            if (!termo.isBlank()) {
                String like = "%" + termo + "%";
                p = cb.and(p, cb.or(cb.like(cb.lower(root.get("nome")), like), cb.like(cb.lower(root.get("descricao")), like)));
            }
            if (ativo != null) p = cb.and(p, cb.equal(root.get("ativo"), ativo));
            if (Boolean.TRUE.equals(emAlerta)) {
                p = cb.and(p, cb.lessThanOrEqualTo(root.get("estoqueAtual"), root.get("estoqueMinimo")));
            }
            return p;
        };
        return materiaPrimaRepository.findAll(filtro, PageRequest.of(Math.max(0, pagina), Math.min(100, Math.max(1, tamanho)), Sort.by("nome")))
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ResumoMateriaPrimaEstoqueDTO resumirEstoque(Long usuarioId, String busca, Boolean ativo) {
        usuarioAcessoService.buscarGestor(usuarioId);
        String termo = busca == null ? "" : busca.trim().toLowerCase(Locale.ROOT);
        List<Object[]> linhas = materiaPrimaRepository.resumirEstoque("%" + termo + "%", ativo);
        Object[] valores = linhas.isEmpty() ? new Object[] {0L, 0L, BigDecimal.ZERO} : linhas.get(0);
        long totalItens = valores[0] == null ? 0 : ((Number) valores[0]).longValue();
        long itensEmAlerta = valores[1] == null ? 0 : ((Number) valores[1]).longValue();
        BigDecimal valorEstoque = valores[2] == null ? BigDecimal.ZERO : (BigDecimal) valores[2];
        return new ResumoMateriaPrimaEstoqueDTO(totalItens, itensEmAlerta, valorEstoque);
    }

    public MateriaPrimaResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        MateriaPrima materiaPrima = buscarEntidade(id);
        return toResponse(materiaPrima);
    }

    @Transactional
    public MateriaPrimaResponseDTO atualizar(Long usuarioId, Long id, MateriaPrimaRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        MateriaPrima materiaPrima = buscarEntidade(id);
        BigDecimal estoqueAnterior = materiaPrima.getEstoqueAtual();
        BigDecimal custoAnterior = materiaPrima.getCustoMedio();
        materiaPrima.setNome(dto.getNome());
        materiaPrima.setDescricao(dto.getDescricao());
        materiaPrima.setUnidadeMedida(dto.getUnidadeMedida());
        materiaPrima.setEstoqueAtual(dto.getEstoqueAtual() != null ? dto.getEstoqueAtual() : materiaPrima.getEstoqueAtual());
        materiaPrima.setEstoqueMinimo(dto.getEstoqueMinimo() != null ? dto.getEstoqueMinimo() : materiaPrima.getEstoqueMinimo());
        materiaPrima.setCustoMedio(dto.getCustoMedio() != null ? dto.getCustoMedio() : materiaPrima.getCustoMedio());
        materiaPrima.setAtivo(dto.getAtivo() != null ? dto.getAtivo() : materiaPrima.getAtivo());
        MateriaPrima salva = materiaPrimaRepository.save(materiaPrima);
        historicoValorService.registrarCusto(
                salva, gestor, custoAnterior, "Custo alterado na edição da matéria-prima", "CADASTRO_MATERIA_PRIMA");
        if (custoAnterior.compareTo(salva.getCustoMedio()) != 0) auditoriaService.registrar(gestor, "MATERIA_PRIMA", salva.getId(), "ALTERACAO_CUSTO", custoAnterior, salva.getCustoMedio(), "Edição da matéria-prima", "CADASTRO_MATERIA_PRIMA");
        if (salva.getEstoqueAtual().compareTo(estoqueAnterior) != 0) {
            auditoriaService.registrar(gestor, "MATERIA_PRIMA", salva.getId(), "AJUSTE_ESTOQUE", estoqueAnterior, salva.getEstoqueAtual(), "Estoque alterado na edição", "AJUSTE_MANUAL");
            movimentacaoEstoqueService.registrarMateriaPrima(
                    salva, gestor, estoqueAnterior, salva.getEstoqueAtual(),
                    TipoMovimentacaoEstoque.AJUSTE, OrigemMovimentacaoEstoque.AJUSTE_MANUAL,
                    null,
                    "Estoque alterado na edição da matéria-prima");
        }
        return toResponse(salva);
    }

    @Transactional
    public void deletar(Long usuarioId, Long id, String motivo) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        MateriaPrima materiaPrima = buscarEntidade(id);
        if (!Boolean.TRUE.equals(materiaPrima.getAtivo())) {
            throw new BusinessException("A matéria-prima já está removida");
        }
        String motivoNormalizado = motivo == null || motivo.isBlank() ? null : motivo.trim();
        if (motivoNormalizado != null && motivoNormalizado.length() > 500) {
            throw new BusinessException("O motivo deve ter no máximo 500 caracteres");
        }

        BigDecimal saldoAnterior = materiaPrima.getEstoqueAtual();
        materiaPrima.setAtivo(false);
        materiaPrima.setEstoqueAtual(BigDecimal.ZERO);
        materiaPrimaRepository.save(materiaPrima);
        movimentacaoEstoqueService.registrarRemocaoMateriaPrima(
                materiaPrima, gestor, saldoAnterior, motivoNormalizado);
        auditoriaService.registrar(
                gestor, "MATERIA_PRIMA", materiaPrima.getId(), "INATIVACAO",
                saldoAnterior, BigDecimal.ZERO, motivoNormalizado, "REMOCAO_MANUAL");
    }

    public MateriaPrima buscarMateriaPrimaDoGestor(Long materiaPrimaId, Usuario gestor) {
        MateriaPrima materiaPrima = buscarEntidade(materiaPrimaId);
        validarAtiva(materiaPrima);
        return materiaPrima;
    }

    private void validarAtiva(MateriaPrima materiaPrima) {
        if (!Boolean.TRUE.equals(materiaPrima.getAtivo())) {
            throw new BusinessException("A matéria-prima está removida e não pode ser usada em novos lançamentos");
        }
    }

    private MateriaPrima buscarEntidade(Long id) {
        return materiaPrimaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));
    }

    private BigDecimal valorOuZero(BigDecimal valor) {
        return valor != null ? valor : BigDecimal.ZERO;
    }

    private MateriaPrimaResponseDTO toResponse(MateriaPrima materiaPrima) {
        return MateriaPrimaResponseDTO.builder()
                .id(materiaPrima.getId())
                .nome(materiaPrima.getNome())
                .descricao(materiaPrima.getDescricao())
                .unidadeMedida(materiaPrima.getUnidadeMedida())
                .estoqueAtual(materiaPrima.getEstoqueAtual())
                .estoqueMinimo(materiaPrima.getEstoqueMinimo())
                .custoMedio(materiaPrima.getCustoMedio())
                .ativo(materiaPrima.getAtivo())
                .build();
    }
}

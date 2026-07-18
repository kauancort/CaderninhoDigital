package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.response.MovimentacaoEstoqueResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.MovimentacaoUsuarioFiltroResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.MovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoItemEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.repository.MovimentacaoEstoqueRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MovimentacaoEstoqueService {

    private final MovimentacaoEstoqueRepository repository;
    private final UsuarioAcessoService usuarioAcessoService;

    @Transactional
    public void registrarProduto(
            Produto produto,
            Usuario usuario,
            BigDecimal saldoAnterior,
            BigDecimal saldoPosterior,
            TipoMovimentacaoEstoque tipo,
            OrigemMovimentacaoEstoque origem,
            String observacao
    ) {
        registrar(produto, null, usuario, saldoAnterior, saldoPosterior, tipo, origem, observacao);
    }

    @Transactional
    public void registrarMateriaPrima(
            MateriaPrima materiaPrima,
            Usuario usuario,
            BigDecimal saldoAnterior,
            BigDecimal saldoPosterior,
            TipoMovimentacaoEstoque tipo,
            OrigemMovimentacaoEstoque origem,
            String observacao
    ) {
        registrar(null, materiaPrima, usuario, saldoAnterior, saldoPosterior, tipo, origem, observacao);
    }

    private void registrar(
            Produto produto,
            MateriaPrima materiaPrima,
            Usuario usuario,
            BigDecimal saldoAnterior,
            BigDecimal saldoPosterior,
            TipoMovimentacaoEstoque tipo,
            OrigemMovimentacaoEstoque origem,
            String observacao
    ) {
        BigDecimal quantidade = saldoPosterior.subtract(saldoAnterior).abs();
        if (quantidade.compareTo(BigDecimal.ZERO) == 0) {
            return;
        }
        boolean isProduto = produto != null;
        repository.save(MovimentacaoEstoque.builder()
                .tipoItem(isProduto ? TipoItemEstoque.PRODUTO : TipoItemEstoque.MATERIA_PRIMA)
                .produto(produto)
                .materiaPrima(materiaPrima)
                .itemNome(isProduto ? produto.getNome() : materiaPrima.getNome())
                .unidadeMedida(isProduto ? produto.getUnidadeMedida() : materiaPrima.getUnidadeMedida())
                .tipoMovimentacao(tipo)
                .origem(origem)
                .quantidade(quantidade)
                .saldoAnterior(saldoAnterior)
                .saldoPosterior(saldoPosterior)
                .usuario(usuario)
                .observacao(observacao)
                .build());
    }

    @Transactional(readOnly = true)
    public List<MovimentacaoUsuarioFiltroResponseDTO> listarUsuarios(Long usuarioSolicitanteId) {
        usuarioAcessoService.buscarGestor(usuarioSolicitanteId);
        return repository.listarUsuarios().stream()
                .map(usuario -> new MovimentacaoUsuarioFiltroResponseDTO(usuario.getId(), usuario.getNome()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<MovimentacaoEstoqueResponseDTO> listar(
            Long usuarioSolicitanteId,
            LocalDate inicio,
            LocalDate fim,
            Long usuarioId,
            TipoMovimentacaoEstoque tipo,
            TipoItemEstoque tipoItem,
            Long itemId,
            int pagina,
            int tamanho,
            Sort.Direction direcao
    ) {
        usuarioAcessoService.buscarGestor(usuarioSolicitanteId);
        int tamanhoSeguro = Math.min(Math.max(tamanho, 1), 100);
        LocalDateTime inicioDataHora = inicio != null ? inicio.atStartOfDay() : null;
        LocalDateTime fimExclusivo = fim != null ? fim.plusDays(1).atStartOfDay() : null;
        Specification<MovimentacaoEstoque> filtros = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (inicioDataHora != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("ocorridoEm"), inicioDataHora));
            }
            if (fimExclusivo != null) {
                predicates.add(builder.lessThan(root.get("ocorridoEm"), fimExclusivo));
            }
            if (usuarioId != null) {
                predicates.add(builder.equal(root.get("usuario").get("id"), usuarioId));
            }
            if (tipo != null) {
                predicates.add(builder.equal(root.get("tipoMovimentacao"), tipo));
            }
            if (tipoItem != null) {
                predicates.add(builder.equal(root.get("tipoItem"), tipoItem));
            }
            if (itemId != null && tipoItem == TipoItemEstoque.PRODUTO) {
                predicates.add(builder.equal(root.get("produto").get("id"), itemId));
            }
            if (itemId != null && tipoItem == TipoItemEstoque.MATERIA_PRIMA) {
                predicates.add(builder.equal(root.get("materiaPrima").get("id"), itemId));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        return repository.findAll(
                        filtros,
                        PageRequest.of(Math.max(pagina, 0), tamanhoSeguro, Sort.by(direcao, "ocorridoEm")))
                .map(this::toResponse);
    }

    private MovimentacaoEstoqueResponseDTO toResponse(MovimentacaoEstoque movimento) {
        boolean produto = movimento.getTipoItem() == TipoItemEstoque.PRODUTO;
        return MovimentacaoEstoqueResponseDTO.builder()
                .id(movimento.getId())
                .tipoItem(movimento.getTipoItem())
                .itemId(produto ? movimento.getProduto().getId() : movimento.getMateriaPrima().getId())
                .itemNome(movimento.getItemNome())
                .unidadeMedida(movimento.getUnidadeMedida())
                .tipoMovimentacao(movimento.getTipoMovimentacao())
                .origem(movimento.getOrigem())
                .quantidade(movimento.getQuantidade())
                .saldoAnterior(movimento.getSaldoAnterior())
                .saldoPosterior(movimento.getSaldoPosterior())
                .usuarioId(movimento.getUsuario().getId())
                .usuarioNome(movimento.getUsuario().getNome())
                .observacao(movimento.getObservacao())
                .ocorridoEm(movimento.getOcorridoEm())
                .build();
    }
}

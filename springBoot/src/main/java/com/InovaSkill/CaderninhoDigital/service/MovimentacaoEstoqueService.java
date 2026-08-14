package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.response.MovimentacaoEstoqueResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.MovimentacaoUsuarioFiltroResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoMovimentacaoEstoqueDTO;
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
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
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
    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void registrarProduto(
            Produto produto,
            Usuario usuario,
            BigDecimal saldoAnterior,
            BigDecimal saldoPosterior,
            TipoMovimentacaoEstoque tipo,
            OrigemMovimentacaoEstoque origem,
            Long origemId,
            String observacao
    ) {
        registrar(produto, null, usuario, saldoAnterior, saldoPosterior, tipo, origem, origemId, observacao, false);
    }

    @Transactional
    public void registrarMateriaPrima(
            MateriaPrima materiaPrima,
            Usuario usuario,
            BigDecimal saldoAnterior,
            BigDecimal saldoPosterior,
            TipoMovimentacaoEstoque tipo,
            OrigemMovimentacaoEstoque origem,
            Long origemId,
            String observacao
    ) {
        registrar(null, materiaPrima, usuario, saldoAnterior, saldoPosterior, tipo, origem, origemId, observacao, false);
    }

    @Transactional
    public void registrarRemocaoMateriaPrima(
            MateriaPrima materiaPrima,
            Usuario usuario,
            BigDecimal saldoAnterior,
            String motivo
    ) {
        registrar(
                null, materiaPrima, usuario, saldoAnterior, BigDecimal.ZERO,
                TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.REMOCAO_MANUAL,
                null, motivo, true);
    }

    @Transactional
    public void registrarRemocaoProduto(
            Produto produto,
            Usuario usuario,
            BigDecimal saldoAnterior,
            String motivo
    ) {
        registrar(
                produto, null, usuario, saldoAnterior, BigDecimal.ZERO,
                TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.REMOCAO_MANUAL,
                null, motivo, true);
    }

    private void registrar(
            Produto produto,
            MateriaPrima materiaPrima,
            Usuario usuario,
            BigDecimal saldoAnterior,
            BigDecimal saldoPosterior,
            TipoMovimentacaoEstoque tipo,
            OrigemMovimentacaoEstoque origem,
            Long origemId,
            String observacao,
            boolean registrarSaldoSemQuantidade
    ) {
        BigDecimal quantidade = saldoPosterior.subtract(saldoAnterior).abs();
        if (!registrarSaldoSemQuantidade && quantidade.compareTo(BigDecimal.ZERO) == 0) {
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
                .origemId(origemId)
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
            OrigemMovimentacaoEstoque origem,
            TipoItemEstoque tipoItem,
            Long itemId,
            int pagina,
            int tamanho,
            Sort.Direction direcao
    ) {
        usuarioAcessoService.buscarGestor(usuarioSolicitanteId);
        int tamanhoSeguro = Math.min(Math.max(tamanho, 1), 100);
        Specification<MovimentacaoEstoque> filtros = (root, query, builder) -> {
            List<Predicate> predicates = criarPredicados(
                    root, builder, inicio, fim, usuarioId, tipo, origem, tipoItem, itemId);
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        return repository.findAll(
                        filtros,
                        PageRequest.of(Math.max(pagina, 0), tamanhoSeguro, Sort.by(direcao, "ocorridoEm")))
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ResumoMovimentacaoEstoqueDTO resumir(Long solicitante, LocalDate inicio, LocalDate fim, Long usuarioId,
            TipoMovimentacaoEstoque tipo, OrigemMovimentacaoEstoque origem, TipoItemEstoque tipoItem, Long itemId) {
        usuarioAcessoService.buscarGestor(solicitante);
        var cb = entityManager.getCriteriaBuilder();
        var cq = cb.createTupleQuery();
        var root = cq.from(MovimentacaoEstoque.class);
        List<Predicate> predicados = criarPredicados(
                root, cb, inicio, fim, usuarioId, tipo, origem, tipoItem, itemId);
        cq.multiselect(root.get("tipoMovimentacao"), cb.count(root))
                .where(predicados.toArray(Predicate[]::new))
                .groupBy(root.get("tipoMovimentacao"));
        List<Tuple> linhas = entityManager.createQuery(cq).getResultList();
        long entradas = 0;
        long saidas = 0;
        long ajustes = 0;
        for (Tuple linha : linhas) {
            TipoMovimentacaoEstoque tipoMovimentacao = linha.get(0, TipoMovimentacaoEstoque.class);
            long contagem = linha.get(1, Long.class);
            if (tipoMovimentacao == TipoMovimentacaoEstoque.ENTRADA) entradas += contagem;
            else if (tipoMovimentacao == TipoMovimentacaoEstoque.SAIDA) saidas += contagem;
            else ajustes += contagem;
        }
        return new ResumoMovimentacaoEstoqueDTO(
                entradas + saidas + ajustes, entradas, saidas, ajustes);
    }

    private List<Predicate> criarPredicados(
            Root<MovimentacaoEstoque> root,
            CriteriaBuilder builder,
            LocalDate inicio,
            LocalDate fim,
            Long usuarioId,
            TipoMovimentacaoEstoque tipo,
            OrigemMovimentacaoEstoque origem,
            TipoItemEstoque tipoItem,
            Long itemId
    ) {
        List<Predicate> predicados = new ArrayList<>();
        LocalDateTime inicioDataHora = inicio != null ? inicio.atStartOfDay() : null;
        LocalDateTime fimExclusivo = fim != null ? fim.plusDays(1).atStartOfDay() : null;
        if (inicioDataHora != null) predicados.add(builder.greaterThanOrEqualTo(root.get("ocorridoEm"), inicioDataHora));
        if (fimExclusivo != null) predicados.add(builder.lessThan(root.get("ocorridoEm"), fimExclusivo));
        if (usuarioId != null) predicados.add(builder.equal(root.get("usuario").get("id"), usuarioId));
        if (tipo != null) predicados.add(builder.equal(root.get("tipoMovimentacao"), tipo));
        if (origem != null) predicados.add(builder.equal(root.get("origem"), origem));
        if (tipoItem != null) predicados.add(builder.equal(root.get("tipoItem"), tipoItem));
        if (itemId != null && tipoItem == TipoItemEstoque.PRODUTO) {
            predicados.add(builder.equal(root.get("produto").get("id"), itemId));
        }
        if (itemId != null && tipoItem == TipoItemEstoque.MATERIA_PRIMA) {
            predicados.add(builder.equal(root.get("materiaPrima").get("id"), itemId));
        }
        return predicados;
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
                .origemId(movimento.getOrigemId())
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

package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.InsumoProducaoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ProducaoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.InsumoProducaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ProducaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.ItemProducaoMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Producao;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.ProdutoGabaritoItem;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

@Service
@RequiredArgsConstructor
public class ProducaoService {

    private final ProducaoRepository producaoRepository;
    private final ProdutoRepository produtoRepository;
    private final MateriaPrimaRepository materiaPrimaRepository;
    private final UsuarioAcessoService usuarioAcessoService;
    private final MovimentacaoEstoqueService movimentacaoEstoqueService;

    @Transactional
    public ProducaoResponseDTO criar(Long usuarioId, ProducaoRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Produto produto = buscarProdutoDoGestor(dto.getProdutoId(), gestor);
        Producao producao = Producao.builder()
                .produto(produto)
                .gestor(gestor)
                .dataProducao(dto.getDataProducao())
                .quantidadeProduzida(dto.getQuantidadeProduzida())
                .observacao(dto.getObservacao())
                .custoEstimado(BigDecimal.ZERO)
                .insumos(new ArrayList<>())
                .build();

        BigDecimal custoEstimado = possuiInsumosManuais(dto)
                ? adicionarInsumosManuais(producao, dto.getInsumos(), gestor)
                : adicionarInsumosDoGabarito(producao, produto);

        BigDecimal estoqueProdutoAnterior = produto.getEstoqueAtual();
        produto.setEstoqueAtual(estoqueProdutoAnterior.add(dto.getQuantidadeProduzida()));
        movimentacaoEstoqueService.registrarProduto(
                produto, gestor, estoqueProdutoAnterior, produto.getEstoqueAtual(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.PRODUCAO,
                dto.getObservacao());
        producao.setCustoEstimado(custoEstimado);
        return toResponse(producaoRepository.save(producao));
    }

    public List<ProducaoResponseDTO> listar(Long usuarioId, Long produtoId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        if (produtoId != null) {
            Produto produto = buscarProdutoDoGestor(produtoId, gestor);
            return producaoRepository.findByProdutoOrderByDataProducaoDesc(produto)
                    .stream()
                    .map(this::toResponse)
                    .toList();
        }
        return producaoRepository.findAllByOrderByDataProducaoDesc().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public Page<ProducaoResponseDTO> listarPaginado(
            Long usuarioId,
            int pagina,
            int tamanho,
            String ordenarPor,
            Sort.Direction direcao,
            LocalDate inicio,
            LocalDate fim,
            Long produtoId
    ) {
        usuarioAcessoService.buscarGestor(usuarioId);
        int tamanhoSeguro = Math.min(Math.max(tamanho, 1), 100);
        String campoOrdenacao = "criadoEm".equals(ordenarPor) ? "criadoEm" : "dataProducao";
        Specification<Producao> filtros = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (inicio != null) predicates.add(builder.greaterThanOrEqualTo(root.get("dataProducao"), inicio));
            if (fim != null) predicates.add(builder.lessThanOrEqualTo(root.get("dataProducao"), fim));
            if (produtoId != null) predicates.add(builder.equal(root.get("produto").get("id"), produtoId));
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        PageRequest pageable = PageRequest.of(
                Math.max(pagina, 0), tamanhoSeguro, Sort.by(direcao, campoOrdenacao).and(Sort.by(direcao, "id")));
        Page<Producao> paginaEntidades = producaoRepository.findAll(filtros, pageable);
        if (paginaEntidades.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, paginaEntidades.getTotalElements());
        }
        List<Long> ids = paginaEntidades.getContent().stream().map(Producao::getId).toList();
        Map<Long, Producao> detalhes = producaoRepository.buscarDetalhesPorIds(ids).stream()
                .collect(Collectors.toMap(Producao::getId, Function.identity()));
        List<ProducaoResponseDTO> registros = ids.stream().map(detalhes::get).map(this::toResponse).toList();
        return new PageImpl<>(registros, pageable, paginaEntidades.getTotalElements());
    }

    public ProducaoResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Producao producao = producaoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produção não encontrada"));
        return toResponse(producao);
    }

    private Produto buscarProdutoDoGestor(Long produtoId, Usuario gestor) {
        Produto produto = produtoRepository.findById(produtoId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));
        return produto;
    }

    private MateriaPrima buscarMateriaPrimaDoGestor(Long materiaPrimaId, Usuario gestor) {
        MateriaPrima materiaPrima = materiaPrimaRepository.findById(materiaPrimaId)
                .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));
        return materiaPrima;
    }

    private void baixarEstoque(MateriaPrima materiaPrima, BigDecimal quantidade) {
        if (materiaPrima.getEstoqueAtual().compareTo(quantidade) < 0) {
            throw new BusinessException("Estoque insuficiente para a matéria-prima " + materiaPrima.getNome());
        }
        materiaPrima.setEstoqueAtual(materiaPrima.getEstoqueAtual().subtract(quantidade));
    }

    private boolean possuiInsumosManuais(ProducaoRequestDTO dto) {
        return dto.getInsumos() != null && !dto.getInsumos().isEmpty();
    }

    private BigDecimal adicionarInsumosManuais(
            Producao producao,
            List<InsumoProducaoRequestDTO> insumos,
            Usuario gestor
    ) {
        BigDecimal custoEstimado = BigDecimal.ZERO;
        for (InsumoProducaoRequestDTO insumoDto : insumos) {
            MateriaPrima materiaPrima = buscarMateriaPrimaDoGestor(insumoDto.getMateriaPrimaId(), gestor);
            custoEstimado = custoEstimado.add(adicionarInsumo(producao, materiaPrima, insumoDto.getQuantidadeUtilizada()));
        }
        return custoEstimado;
    }

    private BigDecimal adicionarInsumosDoGabarito(Producao producao, Produto produto) {
        if (produto.getGabarito() == null || produto.getGabarito().getItens().isEmpty()) {
            throw new BusinessException("Produto sem gabarito de produção cadastrado");
        }

        BigDecimal fatorProducao = producao.getQuantidadeProduzida()
                .divide(produto.getGabarito().getQuantidadeBase(), 6, RoundingMode.HALF_UP);
        BigDecimal custoEstimado = BigDecimal.ZERO;

        for (ProdutoGabaritoItem itemGabarito : produto.getGabarito().getItens()) {
            BigDecimal quantidadeUtilizada = itemGabarito.getQuantidadeNecessaria().multiply(fatorProducao);
            custoEstimado = custoEstimado.add(adicionarInsumo(
                    producao,
                    itemGabarito.getMateriaPrima(),
                    quantidadeUtilizada
            ));
        }

        return custoEstimado;
    }

    private BigDecimal adicionarInsumo(Producao producao, MateriaPrima materiaPrima, BigDecimal quantidadeUtilizada) {
        BigDecimal estoqueAnterior = materiaPrima.getEstoqueAtual();
        baixarEstoque(materiaPrima, quantidadeUtilizada);
        movimentacaoEstoqueService.registrarMateriaPrima(
                materiaPrima, producao.getGestor(), estoqueAnterior, materiaPrima.getEstoqueAtual(),
                TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.PRODUCAO,
                producao.getObservacao());
        BigDecimal custoTotal = materiaPrima.getCustoMedio().multiply(quantidadeUtilizada);
        ItemProducaoMateriaPrima item = ItemProducaoMateriaPrima.builder()
                .producao(producao)
                .materiaPrima(materiaPrima)
                .quantidadeUtilizada(quantidadeUtilizada)
                .custoUnitario(materiaPrima.getCustoMedio())
                .custoTotal(custoTotal)
                .build();
        producao.getInsumos().add(item);
        return custoTotal;
    }

    private ProducaoResponseDTO toResponse(Producao producao) {
        return ProducaoResponseDTO.builder()
                .id(producao.getId())
                .produtoId(producao.getProduto().getId())
                .produtoNome(producao.getProduto().getNome())
                .dataProducao(producao.getDataProducao())
                .quantidadeProduzida(producao.getQuantidadeProduzida())
                .custoEstimado(producao.getCustoEstimado())
                .observacao(producao.getObservacao())
                .criadoEm(producao.getCriadoEm())
                .insumos(producao.getInsumos().stream().map(this::toInsumoResponse).toList())
                .build();
    }

    private InsumoProducaoResponseDTO toInsumoResponse(ItemProducaoMateriaPrima item) {
        return InsumoProducaoResponseDTO.builder()
                .id(item.getId())
                .materiaPrimaId(item.getMateriaPrima().getId())
                .materiaPrimaNome(item.getMateriaPrima().getNome())
                .quantidadeUtilizada(item.getQuantidadeUtilizada())
                .custoUnitario(item.getCustoUnitario())
                .custoTotal(item.getCustoTotal())
                .build();
    }
}

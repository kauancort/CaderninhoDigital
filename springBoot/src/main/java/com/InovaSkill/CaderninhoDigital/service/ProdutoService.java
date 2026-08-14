package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.GabaritoProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ItemGabaritoProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.GabaritoProdutoResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ItemGabaritoProdutoResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ProdutoResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ProdutoResumoResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.CategoriaProduto;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.ProdutoGabarito;
import com.InovaSkill.CaderninhoDigital.entity.ProdutoGabaritoItem;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.CategoriaProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
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
public class ProdutoService {

    private final ProdutoRepository produtoRepository;
    private final MateriaPrimaRepository materiaPrimaRepository;
    private final CategoriaProdutoRepository categoriaProdutoRepository;
    private final UsuarioAcessoService usuarioAcessoService;
    private final MovimentacaoEstoqueService movimentacaoEstoqueService;
    private final HistoricoValorService historicoValorService;
    private final AuditoriaService auditoriaService;

    @Transactional
    public ProdutoResponseDTO criar(Long usuarioId, ProdutoRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        validarSku(dto.getSku(), null);
        Produto produto = Produto.builder()
                .nome(dto.getNome())
                .descricao(dto.getDescricao())
                .sku(normalizarSku(dto.getSku()))
                .categoria(buscarCategoria(dto.getCategoriaId()))
                .unidadeMedida(dto.getUnidadeMedida())
                .precoVenda(dto.getPrecoVenda())
                .custoAtual(dto.getCustoAtual())
                .estoqueAtual(valorOuZero(dto.getEstoqueAtual()))
                .ativo(dto.getAtivo())
                .gestor(gestor)
                .build();
        if (dto.getGabarito() != null) {
            atualizarGabarito(produto, dto.getGabarito(), gestor);
        }
        Produto salvo = produtoRepository.save(produto);
        historicoValorService.registrarPreco(salvo, gestor, null, "Preço inicial do produto");
        historicoValorService.registrarCustoProduto(salvo, gestor, null, "Custo inicial informado", "CADASTRO_PRODUTO");
        movimentacaoEstoqueService.registrarProduto(
                salvo, gestor, BigDecimal.ZERO, salvo.getEstoqueAtual(),
                TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.CADASTRO,
                null,
                "Saldo inicial no cadastro do produto");
        return toResponse(salvo);
    }

    @Transactional(readOnly = true)
    public List<ProdutoResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        return produtoRepository.findAllByAtivoTrueOrderByNomeAsc().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public Page<ProdutoResumoResponseDTO> pesquisar(Long usuarioId, String busca, int pagina, int tamanho, Boolean ativo) {
        usuarioAcessoService.buscarGestor(usuarioId);
        String termo = busca == null ? "" : busca.trim().toLowerCase(Locale.ROOT);
        Specification<Produto> filtro = (root, query, cb) -> {
            var p = cb.conjunction();
            if (!termo.isBlank()) {
                String like = "%" + termo + "%";
                p = cb.and(p, cb.or(cb.like(cb.lower(root.get("nome")), like), cb.like(cb.lower(root.get("descricao")), like), cb.like(cb.lower(root.get("sku")), like)));
            }
            if (ativo != null) p = cb.and(p, cb.equal(root.get("ativo"), ativo));
            return p;
        };
        return produtoRepository.findAll(filtro, PageRequest.of(Math.max(0, pagina), Math.min(100, Math.max(1, tamanho)), Sort.by("nome")))
                .map(this::toResumo);
    }

    private ProdutoResumoResponseDTO toResumo(Produto produto) {
        return ProdutoResumoResponseDTO.builder().id(produto.getId()).nome(produto.getNome()).sku(produto.getSku())
                .categoria(produto.getCategoria() == null ? null : produto.getCategoria().getNome())
                .unidadeMedida(produto.getUnidadeMedida()).precoVenda(produto.getPrecoVenda())
                .custoAtual(produto.getCustoAtual())
                .estoqueAtual(produto.getEstoqueAtual()).ativo(produto.getAtivo()).tipo("PRODUTO_FINAL").build();
    }

    @Transactional(readOnly = true)
    public ProdutoResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Produto produto = buscarEntidade(id);
        return toResponse(produto);
    }

    @Transactional
    public ProdutoResponseDTO atualizar(Long usuarioId, Long id, ProdutoRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Produto produto = buscarEntidade(id);
        validarSku(dto.getSku(), id);
        BigDecimal estoqueAnterior = produto.getEstoqueAtual();
        BigDecimal precoAnterior = produto.getPrecoVenda();
        BigDecimal custoAnterior = produto.getCustoAtual();
        produto.setNome(dto.getNome());
        produto.setDescricao(dto.getDescricao());
        produto.setSku(normalizarSku(dto.getSku()));
        produto.setCategoria(buscarCategoria(dto.getCategoriaId()));
        produto.setUnidadeMedida(dto.getUnidadeMedida());
        produto.setPrecoVenda(dto.getPrecoVenda());
        if (dto.getCustoAtual() != null) produto.setCustoAtual(dto.getCustoAtual());
        produto.setEstoqueAtual(dto.getEstoqueAtual() != null ? dto.getEstoqueAtual() : produto.getEstoqueAtual());
        produto.setAtivo(dto.getAtivo() != null ? dto.getAtivo() : produto.getAtivo());
        if (dto.getGabarito() != null) {
            atualizarGabarito(produto, dto.getGabarito(), gestor);
        }
        Produto salvo = produtoRepository.save(produto);
        historicoValorService.registrarPreco(salvo, gestor, precoAnterior, "Preço alterado na edição do produto");
        historicoValorService.registrarCustoProduto(salvo, gestor, custoAnterior, "Custo alterado na edição do produto", "CADASTRO_PRODUTO");
        if (precoAnterior.compareTo(salvo.getPrecoVenda()) != 0) auditoriaService.registrar(gestor, "PRODUTO", salvo.getId(), "ALTERACAO_PRECO", precoAnterior, salvo.getPrecoVenda(), "Edição do produto", "CADASTRO_PRODUTO");
        if (valoresDiferentes(custoAnterior, salvo.getCustoAtual())) auditoriaService.registrar(gestor, "PRODUTO", salvo.getId(), "ALTERACAO_CUSTO", custoAnterior, salvo.getCustoAtual(), "Edição do produto", "CADASTRO_PRODUTO");
        if (salvo.getEstoqueAtual().compareTo(estoqueAnterior) != 0) {
            auditoriaService.registrar(gestor, "PRODUTO", salvo.getId(), "AJUSTE_ESTOQUE", estoqueAnterior, salvo.getEstoqueAtual(), "Estoque alterado na edição", "AJUSTE_MANUAL");
            movimentacaoEstoqueService.registrarProduto(
                    salvo, gestor, estoqueAnterior, salvo.getEstoqueAtual(),
                    TipoMovimentacaoEstoque.AJUSTE, OrigemMovimentacaoEstoque.AJUSTE_MANUAL,
                    null,
                    "Estoque alterado na edição do produto");
        }
        return toResponse(salvo);
    }

    @Transactional
    public void deletar(Long usuarioId, Long id, String motivo) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Produto produto = buscarEntidade(id);
        if (!Boolean.TRUE.equals(produto.getAtivo())) {
            throw new BusinessException("O produto já está removido");
        }
        String motivoNormalizado = motivo == null || motivo.isBlank() ? null : motivo.trim();
        if (motivoNormalizado != null && motivoNormalizado.length() > 500) {
            throw new BusinessException("O motivo deve ter no máximo 500 caracteres");
        }

        BigDecimal saldoAnterior = produto.getEstoqueAtual();
        produto.setAtivo(false);
        produto.setEstoqueAtual(BigDecimal.ZERO);
        produtoRepository.save(produto);
        movimentacaoEstoqueService.registrarRemocaoProduto(
                produto, gestor, saldoAnterior, motivoNormalizado);
        auditoriaService.registrar(
                gestor, "PRODUTO", produto.getId(), "INATIVACAO",
                saldoAnterior, BigDecimal.ZERO, motivoNormalizado, "REMOCAO_MANUAL");
    }

    public Produto buscarProdutoDoGestor(Long produtoId, Usuario gestor) {
        Produto produto = buscarEntidade(produtoId);
        validarAtivo(produto);
        return produto;
    }

    private void validarAtivo(Produto produto) {
        if (!Boolean.TRUE.equals(produto.getAtivo())) {
            throw new BusinessException("O produto está removido e não pode ser usado em novos lançamentos");
        }
    }

    private Produto buscarEntidade(Long id) {
        return produtoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));
    }

    private BigDecimal valorOuZero(BigDecimal valor) {
        return valor != null ? valor : BigDecimal.ZERO;
    }

    private boolean valoresDiferentes(BigDecimal anterior, BigDecimal atual) {
        if (anterior == null || atual == null) return anterior != atual;
        return anterior.compareTo(atual) != 0;
    }

    private void atualizarGabarito(Produto produto, GabaritoProdutoRequestDTO gabarito, Usuario gestor) {
        ProdutoGabarito produtoGabarito = produto.getGabarito();
        if (produtoGabarito == null) {
            produtoGabarito = ProdutoGabarito.builder()
                    .produto(produto)
                    .build();
            produto.setGabarito(produtoGabarito);
        }

        produtoGabarito.setQuantidadeBase(gabarito.getQuantidadeBase());
        produtoGabarito.setObservacao(gabarito.getObservacao());
        produtoGabarito.getItens().clear();

        for (ItemGabaritoProdutoRequestDTO itemDto : gabarito.getItens()) {
            MateriaPrima materiaPrima = materiaPrimaRepository.findById(itemDto.getMateriaPrimaId())
                    .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));
            if (!Boolean.TRUE.equals(materiaPrima.getAtivo())) {
                throw new BusinessException(
                        "A matéria-prima " + materiaPrima.getNome() + " está removida e não pode entrar em um novo gabarito");
            }

            ProdutoGabaritoItem item = ProdutoGabaritoItem.builder()
                    .gabarito(produtoGabarito)
                    .materiaPrima(materiaPrima)
                    .quantidadeNecessaria(itemDto.getQuantidadeNecessaria())
                    .build();
            produtoGabarito.getItens().add(item);
        }
    }

    private ProdutoResponseDTO toResponse(Produto produto) {
        return ProdutoResponseDTO.builder()
                .id(produto.getId())
                .nome(produto.getNome())
                .descricao(produto.getDescricao())
                .sku(produto.getSku())
                .categoriaId(produto.getCategoria() == null ? null : produto.getCategoria().getId())
                .categoriaNome(produto.getCategoria() == null ? null : produto.getCategoria().getNome())
                .unidadeMedida(produto.getUnidadeMedida())
                .precoVenda(produto.getPrecoVenda())
                .custoAtual(produto.getCustoAtual())
                .estoqueAtual(produto.getEstoqueAtual())
                .ativo(produto.getAtivo())
                .gabarito(toGabaritoResponse(produto))
                .build();
    }

    private CategoriaProduto buscarCategoria(Long id) {
        if (id == null) return null;
        return categoriaProdutoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada"));
    }

    private void validarSku(String sku, Long id) {
        String valor = normalizarSku(sku);
        if (valor == null) return;
        boolean existe = id == null ? produtoRepository.existsBySkuIgnoreCase(valor)
                : produtoRepository.existsBySkuIgnoreCaseAndIdNot(valor, id);
        if (existe) throw new BusinessException("Já existe um produto com este SKU");
    }

    private String normalizarSku(String sku) {
        return sku == null || sku.isBlank() ? null : sku.trim().toUpperCase(Locale.ROOT);
    }

    private GabaritoProdutoResponseDTO toGabaritoResponse(Produto produto) {
        if (produto.getGabarito() == null) {
            return null;
        }

        return GabaritoProdutoResponseDTO.builder()
                .id(produto.getGabarito().getId())
                .quantidadeBase(produto.getGabarito().getQuantidadeBase())
                .observacao(produto.getGabarito().getObservacao())
                .itens(produto.getGabarito().getItens().stream()
                        .map(this::toGabaritoItemResponse)
                        .toList())
                .build();
    }

    private ItemGabaritoProdutoResponseDTO toGabaritoItemResponse(ProdutoGabaritoItem item) {
        return ItemGabaritoProdutoResponseDTO.builder()
                .id(item.getId())
                .materiaPrimaId(item.getMateriaPrima().getId())
                .materiaPrimaNome(item.getMateriaPrima().getNome())
                .unidadeMedida(item.getMateriaPrima().getUnidadeMedida())
                .quantidadeNecessaria(item.getQuantidadeNecessaria())
                .build();
    }
}

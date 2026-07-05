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
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProducaoService {

    private final ProducaoRepository producaoRepository;
    private final ProdutoRepository produtoRepository;
    private final MateriaPrimaRepository materiaPrimaRepository;
    private final UsuarioAcessoService usuarioAcessoService;

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

        produto.setEstoqueAtual(produto.getEstoqueAtual().add(dto.getQuantidadeProduzida()));
        producao.setCustoEstimado(custoEstimado);
        return toResponse(producaoRepository.save(producao));
    }

    public List<ProducaoResponseDTO> listar(Long usuarioId, Long produtoId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        if (produtoId != null) {
            Produto produto = buscarProdutoDoGestor(produtoId, gestor);
            return producaoRepository.findByGestorAndProdutoOrderByDataProducaoDesc(gestor, produto)
                    .stream()
                    .map(this::toResponse)
                    .toList();
        }
        return producaoRepository.findByGestorOrderByDataProducaoDesc(gestor).stream().map(this::toResponse).toList();
    }

    public ProducaoResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Producao producao = producaoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produção não encontrada"));
        if (!producao.getGestor().getId().equals(gestor.getId())) {
            throw new BusinessException("Esta produção não pertence ao usuário informado");
        }
        return toResponse(producao);
    }

    private Produto buscarProdutoDoGestor(Long produtoId, Usuario gestor) {
        Produto produto = produtoRepository.findById(produtoId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));
        if (!produto.getGestor().getId().equals(gestor.getId())) {
            throw new BusinessException("Este produto não pertence ao usuário informado");
        }
        return produto;
    }

    private MateriaPrima buscarMateriaPrimaDoGestor(Long materiaPrimaId, Usuario gestor) {
        MateriaPrima materiaPrima = materiaPrimaRepository.findById(materiaPrimaId)
                .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));
        if (!materiaPrima.getGestor().getId().equals(gestor.getId())) {
            throw new BusinessException("Esta matéria-prima não pertence ao usuário informado");
        }
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
        baixarEstoque(materiaPrima, quantidadeUtilizada);
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

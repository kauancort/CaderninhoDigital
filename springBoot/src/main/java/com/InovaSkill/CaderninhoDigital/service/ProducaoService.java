package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.InsumoProducaoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ProducaoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.InsumoProducaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ProducaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.ItemProducaoMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Producao;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.math.BigDecimal;
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

        BigDecimal custoEstimado = BigDecimal.ZERO;
        for (InsumoProducaoRequestDTO insumoDto : dto.getInsumos()) {
            MateriaPrima materiaPrima = buscarMateriaPrimaDoGestor(insumoDto.getMateriaPrimaId(), gestor);
            baixarEstoque(materiaPrima, insumoDto.getQuantidadeUtilizada());
            BigDecimal custoTotal = materiaPrima.getCustoMedio().multiply(insumoDto.getQuantidadeUtilizada());
            ItemProducaoMateriaPrima item = ItemProducaoMateriaPrima.builder()
                    .producao(producao)
                    .materiaPrima(materiaPrima)
                    .quantidadeUtilizada(insumoDto.getQuantidadeUtilizada())
                    .custoUnitario(materiaPrima.getCustoMedio())
                    .custoTotal(custoTotal)
                    .build();
            producao.getInsumos().add(item);
            custoEstimado = custoEstimado.add(custoTotal);
        }

        produto.setEstoqueAtual(produto.getEstoqueAtual().add(dto.getQuantidadeProduzida()));
        producao.setCustoEstimado(custoEstimado);
        return toResponse(producaoRepository.save(producao));
    }

    public List<ProducaoResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
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

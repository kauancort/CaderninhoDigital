package com.InovaSkill.CaderninhoDigital.ai.cost;

import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnaliseMargemProdutoService {
    private static final List<String> CUSTOS_NAO_MODELADOS = List.of(
            "energia", "gás", "mão de obra", "impostos", "perdas", "transporte");
    private final ProdutoRepository produtos;
    private final ProducaoRepository producoes;
    private final VendaRepository vendas;

    public AnaliseMargemProdutoService(ProdutoRepository produtos, ProducaoRepository producoes,
            VendaRepository vendas) {
        this.produtos = produtos; this.producoes = producoes; this.vendas = vendas;
    }

    @Transactional(readOnly = true)
    public Resultado analisar(Long empresaId, Long produtoId, LocalDate inicio, LocalDate fim) {
        var produto = produtos.buscarComGabaritoParaEmpresa(produtoId, empresaId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));
        var producoesPeriodo = producoes.listarParaAnaliseMargem(empresaId, produtoId, inicio, fim);
        BigDecimal quantidadeProduzida = BigDecimal.ZERO;
        BigDecimal custoProducao = BigDecimal.ZERO;
        LinkedHashMap<String, BigDecimal> custosComponentes = new LinkedHashMap<>();
        for (var producao : producoesPeriodo) {
            quantidadeProduzida = quantidadeProduzida.add(zero(producao.getQuantidadeProduzida()));
            for (var insumo : producao.getInsumos()) {
                BigDecimal custo = zero(insumo.getCustoTotal());
                custoProducao = custoProducao.add(custo);
                String nome = insumo.getMateriaPrima().getNome();
                custosComponentes.merge(nome, custo, BigDecimal::add);
            }
        }
        BigDecimal custoUnitario = quantidadeProduzida.signum() > 0
                ? custoProducao.divide(quantidadeProduzida, 4, RoundingMode.HALF_UP) : produto.getCustoAtual();
        var resumoVendas = vendas.resumirMargemProduto(empresaId, produtoId, inicio, fim);
        BigDecimal quantidadeVendida = zero(resumoVendas.getQuantidadeVendida());
        BigDecimal receita = zero(resumoVendas.getReceita());
        BigDecimal precoMedioVenda = quantidadeVendida.signum() > 0
                ? receita.divide(quantidadeVendida, 4, RoundingMode.HALF_UP) : null;
        BigDecimal margemUnitaria = precoMedioVenda == null || custoUnitario == null ? null
                : precoMedioVenda.subtract(custoUnitario).setScale(4, RoundingMode.HALF_UP);
        BigDecimal margemTotal = margemUnitaria == null ? null
                : margemUnitaria.multiply(quantidadeVendida).setScale(2, RoundingMode.HALF_UP);
        List<Componente> componentes = new ArrayList<>();
        for (var item : custosComponentes.entrySet()) {
            BigDecimal participacao = custoProducao.signum() == 0 ? null
                    : item.getValue().divide(custoProducao, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
            componentes.add(new Componente(item.getKey(), item.getValue(), participacao));
        }
        componentes.sort((a, b) -> b.custoConhecido().compareTo(a.custoConhecido()));
        List<String> avisos = new ArrayList<>();
        avisos.add("A margem é bruta e considera somente os custos cadastrados.");
        avisos.add("Não estão modelados: " + String.join(", ", CUSTOS_NAO_MODELADOS) + ".");
        if (producoesPeriodo.isEmpty()) avisos.add("Sem produção no período; foi usado o custo atual conhecido do produto.");
        if (resumoVendas.getItensSemCusto() != null && resumoVendas.getItensSemCusto() > 0)
            avisos.add("Há vendas sem custo histórico registrado.");
        String situacao = margemUnitaria == null ? "INSUFICIENTE"
                : margemUnitaria.signum() < 0 ? "MARGEM_CONHECIDA_NEGATIVA"
                : margemUnitaria.signum() > 0 ? "MARGEM_CONHECIDA_POSITIVA" : "MARGEM_CONHECIDA_ZERO";
        return new Resultado(produtoId, produto.getNome(), inicio, fim, quantidadeProduzida, custoProducao,
                custoUnitario, quantidadeVendida, receita, precoMedioVenda, margemUnitaria, margemTotal,
                situacao, List.copyOf(componentes), CUSTOS_NAO_MODELADOS, List.copyOf(avisos));
    }

    private BigDecimal zero(BigDecimal valor) { return valor == null ? BigDecimal.ZERO : valor; }

    public record Componente(String nome, BigDecimal custoConhecido, BigDecimal participacaoPercentual) {}
    public record Resultado(Long produtoId, String produto, LocalDate inicio, LocalDate fim,
            BigDecimal quantidadeProduzida, BigDecimal custoProducaoConhecido, BigDecimal custoUnitarioConhecido,
            BigDecimal quantidadeVendida, BigDecimal receitaVendas, BigDecimal precoMedioVenda,
            BigDecimal margemBrutaConhecidaUnitaria, BigDecimal margemBrutaConhecidaTotal, String situacao,
            List<Componente> componentes, List<String> custosNaoModelados, List<String> avisos) {}
}

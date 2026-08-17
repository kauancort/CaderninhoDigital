package com.InovaSkill.CaderninhoDigital.ai.cost;

import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.HistoricoCustoProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnaliseCustoProdutoService {
    private final ProdutoRepository produtos;
    private final HistoricoCustoProdutoRepository historico;
    public AnaliseCustoProdutoService(ProdutoRepository produtos,
            HistoricoCustoProdutoRepository historico) {
        this.produtos = produtos; this.historico = historico;
    }

    @Transactional(readOnly = true)
    public Resultado analisar(Long empresaId, Long produtoId, Instant solicitadoEm, ZoneId timezone) {
        var produto = produtos.buscarComGabaritoParaEmpresa(produtoId, empresaId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));
        var avisos = new ArrayList<String>();
        BigDecimal custoCalculado = null;
        int componentes = 0; int semCusto = 0;
        if (produto.getGabarito() == null || produto.getGabarito().getItens().isEmpty()) {
            avisos.add("Produto sem ficha técnica cadastrada; somente o custo atual conhecido foi retornado.");
        } else if (produto.getGabarito().getQuantidadeBase() == null
                || produto.getGabarito().getQuantidadeBase().compareTo(BigDecimal.ZERO) <= 0) {
            avisos.add("Rendimento ausente ou inválido; o custo pela ficha técnica está indisponível.");
        } else {
            BigDecimal total = BigDecimal.ZERO;
            for (var item : produto.getGabarito().getItens()) {
                componentes++;
                BigDecimal custo = item.getMateriaPrima().getCustoMedio();
                if (custo == null || custo.compareTo(BigDecimal.ZERO) <= 0) { semCusto++; continue; }
                total = total.add(item.getQuantidadeNecessaria().multiply(custo));
            }
            custoCalculado = total.divide(produto.getGabarito().getQuantidadeBase(), 2, RoundingMode.HALF_UP);
            if (semCusto > 0) avisos.add("Há componentes sem custo conhecido; o cálculo da ficha técnica é parcial.");
        }
        avisos.add("Embalagem, perdas, mão de obra e custos indiretos não estão modelados e não foram estimados.");
        Instant dataBase = historico.findFirstByProdutoIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(produtoId)
                .map(h -> h.getAlteradoEm().atZone(timezone).toInstant()).orElse(null);
        boolean componentesCompletos = custoCalculado != null && semCusto == 0;
        return new Resultado(produtoId, produto.getCustoAtual(), custoCalculado,
                produto.getGabarito() == null ? null : produto.getGabarito().getQuantidadeBase(),
                componentes, semCusto, dataBase, solicitadoEm, List.copyOf(avisos), componentesCompletos);
    }

    public record Resultado(Long produtoId, BigDecimal custoAtualConhecido, BigDecimal custoUnitarioFicha,
            BigDecimal rendimentoBase, int componentes, int componentesSemCusto, Instant dataBaseCusto,
            Instant consultadoEm, List<String> avisos, boolean componentesCompletos) {}
}

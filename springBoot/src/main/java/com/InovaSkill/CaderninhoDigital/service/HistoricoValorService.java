package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.entity.HistoricoCustoMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.HistoricoCustoProduto;
import com.InovaSkill.CaderninhoDigital.entity.HistoricoPrecoProduto;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.repository.HistoricoCustoMateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.HistoricoCustoProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.HistoricoPrecoProdutoRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class HistoricoValorService {

    private final HistoricoPrecoProdutoRepository precos;
    private final HistoricoCustoMateriaPrimaRepository custos;
    private final HistoricoCustoProdutoRepository custosProduto;

    public void registrarPreco(Produto produto, Usuario usuario, BigDecimal anterior, String motivo) {
        if (anterior != null && anterior.compareTo(produto.getPrecoVenda()) == 0) return;
        LocalDateTime agora = LocalDateTime.now();
        precos.findFirstByProdutoIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(produto.getId())
                .ifPresent(historico -> {
                    historico.setFimVigencia(agora);
                    precos.save(historico);
                });
        precos.save(HistoricoPrecoProduto.builder()
                .produto(produto)
                .usuario(usuario)
                .preco(produto.getPrecoVenda())
                .inicioVigencia(agora)
                .alteradoEm(agora)
                .origem("CADASTRO_PRODUTO")
                .motivo(motivo)
                .build());
    }

    public void registrarCusto(
            MateriaPrima materia,
            Usuario usuario,
            BigDecimal anterior,
            String motivo,
            String origem
    ) {
        if (anterior != null && anterior.compareTo(materia.getCustoMedio()) == 0) return;
        LocalDateTime agora = LocalDateTime.now();
        custos.findFirstByMateriaPrimaIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(materia.getId())
                .ifPresent(historico -> {
                    historico.setFimVigencia(agora);
                    custos.save(historico);
                });
        custos.save(HistoricoCustoMateriaPrima.builder()
                .materiaPrima(materia)
                .usuario(usuario)
                .custo(materia.getCustoMedio())
                .inicioVigencia(agora)
                .alteradoEm(agora)
                .origem(origem)
                .motivo(motivo)
                .build());
    }

    public void registrarCustoProduto(
            Produto produto,
            Usuario usuario,
            BigDecimal anterior,
            String motivo,
            String origem
    ) {
        if (produto.getCustoAtual() == null
                || (anterior != null && anterior.compareTo(produto.getCustoAtual()) == 0)) return;
        LocalDateTime agora = LocalDateTime.now();
        custosProduto.findFirstByProdutoIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(produto.getId())
                .ifPresent(historico -> {
                    historico.setFimVigencia(agora);
                    custosProduto.save(historico);
                });
        custosProduto.save(HistoricoCustoProduto.builder()
                .produto(produto)
                .usuario(usuario)
                .custo(produto.getCustoAtual())
                .inicioVigencia(agora)
                .alteradoEm(agora)
                .origem(origem)
                .motivo(motivo)
                .build());
    }
}

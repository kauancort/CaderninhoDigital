package com.InovaSkill.CaderninhoDigital.ai.cost;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.tool.*;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import java.time.Duration;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Component;

@Component
public class AnalisarCustoProdutoFerramenta implements FerramentaLeitura<ArgumentosProduto> {
    private final AnaliseCustoProdutoService service;
    public AnalisarCustoProdutoFerramenta(AnaliseCustoProdutoService service) { this.service = service; }
    public FerramentaPermitida identificador() { return FerramentaPermitida.ANALISE_CUSTO_PRODUTO; }
    public String descricao() { return "Analisa o custo interno de um produto por identificador controlado"; }
    public TipoArgumentosFerramenta tipoArgumentos() { return TipoArgumentosFerramenta.PRODUTO; }
    public Class<ArgumentosProduto> classeArgumentos() { return ArgumentosProduto.class; }
    public PerfilUsuario permissaoNecessaria() { return PerfilUsuario.GESTOR; }
    public Duration timeout() { return Duration.ofSeconds(3); }
    public ResultadoFerramenta executar(ArgumentosProduto a, ContextoExecucaoFerramenta c) {
        var r = service.analisar(c.identidade().usuarioId(), a.produtoId(), c.solicitadoEm(), c.timezone());
        var dados = new LinkedHashMap<String,Object>();
        dados.put("produtoId", r.produtoId()); dados.put("custoAtualConhecido", r.custoAtualConhecido());
        dados.put("custoUnitarioFicha", r.custoUnitarioFicha()); dados.put("rendimentoBase", r.rendimentoBase());
        dados.put("componentes", r.componentes()); dados.put("componentesSemCusto", r.componentesSemCusto());
        dados.put("dataBaseCusto", r.dataBaseCusto());
        dados.put("formula", "soma(quantidadeNecessaria × custoMedio) ÷ quantidadeBase");
        return new ResultadoFerramenta(identificador(), StatusResultado.SUCESSO, dados, null, null,
                r.consultadoEm(), r.avisos(), QualidadeResultado.PARCIAL);
    }
}

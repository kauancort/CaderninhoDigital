package com.InovaSkill.CaderninhoDigital.ai.cost;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.tool.*;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import java.time.Duration;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Component;

@Component
public class AnalisarMargemProdutoFerramenta implements FerramentaLeitura<ArgumentosProdutoPeriodo> {
    private final AnaliseMargemProdutoService service;
    public AnalisarMargemProdutoFerramenta(AnaliseMargemProdutoService service) { this.service = service; }
    public FerramentaPermitida identificador() { return FerramentaPermitida.ANALISE_MARGEM_PRODUTO; }
    public String descricao() { return "Calcula custo e margem bruta conhecida de um produto sem estimar custos ausentes"; }
    public TipoArgumentosFerramenta tipoArgumentos() { return TipoArgumentosFerramenta.PRODUTO_PERIODO; }
    public Class<ArgumentosProdutoPeriodo> classeArgumentos() { return ArgumentosProdutoPeriodo.class; }
    public PerfilUsuario permissaoNecessaria() { return PerfilUsuario.GESTOR; }
    public Duration timeout() { return Duration.ofSeconds(5); }
    public ResultadoFerramenta executar(ArgumentosProdutoPeriodo a, ContextoExecucaoFerramenta c) {
        var r = service.analisar(c.identidade().empresaId(), a.produtoId(), a.inicio(), a.fim());
        var dados = new LinkedHashMap<String, Object>();
        dados.put("produtoId", r.produtoId()); dados.put("produto", r.produto());
        dados.put("quantidadeProduzida", r.quantidadeProduzida());
        dados.put("custoProducaoConhecido", r.custoProducaoConhecido());
        dados.put("custoUnitarioConhecido", r.custoUnitarioConhecido());
        dados.put("quantidadeVendida", r.quantidadeVendida()); dados.put("receitaVendas", r.receitaVendas());
        dados.put("precoMedioVenda", r.precoMedioVenda());
        dados.put("margemBrutaConhecidaUnitaria", r.margemBrutaConhecidaUnitaria());
        dados.put("margemBrutaConhecidaTotal", r.margemBrutaConhecidaTotal());
        dados.put("situacao", r.situacao()); dados.put("componentes", r.componentes());
        dados.put("custosNaoModelados", r.custosNaoModelados());
        return new ResultadoFerramenta(identificador(), StatusResultado.SUCESSO, dados, a.inicio(), a.fim(),
                c.solicitadoEm(), r.avisos(), QualidadeResultado.PARCIAL);
    }
}

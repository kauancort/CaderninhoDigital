package com.InovaSkill.CaderninhoDigital.ai.search;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.tool.*;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import java.time.Duration;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Component;

@Component
public class CompararPrecoMercadoFerramenta implements FerramentaLeitura<ArgumentosComparacaoMercado> {
    private final ComparacaoMercadoService service;
    public CompararPrecoMercadoFerramenta(ComparacaoMercadoService service) { this.service = service; }
    public FerramentaPermitida identificador() { return FerramentaPermitida.COMPARAR_PRECO_MERCADO; }
    public String descricao() { return "Compara custo interno de matéria-prima com preços públicos locais"; }
    public TipoArgumentosFerramenta tipoArgumentos() { return TipoArgumentosFerramenta.COMPARACAO_MERCADO; }
    public Class<ArgumentosComparacaoMercado> classeArgumentos() { return ArgumentosComparacaoMercado.class; }
    public PerfilUsuario permissaoNecessaria() { return PerfilUsuario.GESTOR; }
    public Duration timeout() { return Duration.ofSeconds(100); }
    public ResultadoFerramenta executar(ArgumentosComparacaoMercado a, ContextoExecucaoFerramenta c) {
        var r=service.comparar(c.identidade().usuarioId(),a.materiaPrimaId(),a.inicio(),a.fim(),
                a.unidade(),a.quantidadeAlvo(),a.cidade(),a.uf());
        var dados=new LinkedHashMap<String,Object>();
        dados.put("materiaPrimaId",r.materiaPrimaId()); dados.put("unidade",r.unidade());
        dados.put("quantidadeAlvo",r.quantidadeAlvo()); dados.put("precoInternoUnitario",r.precoInternoUnitario());
        dados.put("custoInternoComparavel",r.custoInternoComparavel());
        dados.put("menorCustoExterno",r.menorCustoExterno()); dados.put("economiaEstimada",r.economiaEstimada());
        dados.put("diferencaExternaMenosInterna",r.diferencaExternaMenosInterna());
        dados.put("percentualDiferenca",r.percentualDiferenca()); dados.put("situacao",r.situacao());
        dados.put("pesquisadoEm",r.pesquisadoEm()); dados.put("ofertas",r.ofertas());
        return new ResultadoFerramenta(identificador(),StatusResultado.SUCESSO,dados,a.inicio(),a.fim(),
                c.solicitadoEm(),r.avisos(),r.qualidade());
    }
}

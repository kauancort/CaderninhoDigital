package com.InovaSkill.CaderninhoDigital.ai.profit;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.tool.*;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import java.time.Duration;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Component;

@Component
public class AnalisarRentabilidadeProdutoFerramenta
        implements FerramentaLeitura<ArgumentosRentabilidadeProduto> {
    private final AnaliseRentabilidadeProdutoService service;
    public AnalisarRentabilidadeProdutoFerramenta(AnaliseRentabilidadeProdutoService service) {
        this.service = service;
    }
    public FerramentaPermitida identificador() { return FerramentaPermitida.ANALISAR_RENTABILIDADE_PRODUTO; }
    public String descricao() { return "Analisa deterministicamente custo, vendas, modalidades, margem conhecida e mercado"; }
    public TipoArgumentosFerramenta tipoArgumentos() { return TipoArgumentosFerramenta.RENTABILIDADE_PRODUTO; }
    public Class<ArgumentosRentabilidadeProduto> classeArgumentos() { return ArgumentosRentabilidadeProduto.class; }
    public PerfilUsuario permissaoNecessaria() { return PerfilUsuario.GESTOR; }
    public Duration timeout() { return Duration.ofSeconds(90); }
    public ResultadoFerramenta executar(ArgumentosRentabilidadeProduto a, ContextoExecucaoFerramenta c) {
        var r = service.analisar(c.identidade().empresaId(), a.produtoId(), a.inicio(), a.fim(),
                a.modalidade(), a.precoConsultado());
        var dados = new LinkedHashMap<String, Object>();
        dados.put("produtoId", r.produtoId());
        dados.put("produto", r.produto());
        dados.put("periodoInicio", r.inicio());
        dados.put("periodoFim", r.fim());
        dados.put("custo", r.custo());
        dados.put("vendas", r.vendas());
        dados.put("modalidades", r.modalidades());
        dados.put("principalComponenteCusto", r.principalComponenteCusto());
        dados.put("mercado", r.mercado());
        dados.put("estimativaCustosIndiretos", r.estimativaCustosIndiretos());
        dados.put("situacao", r.situacao());
        dados.put("informacaoNecessaria", r.informacaoNecessaria());
        return new ResultadoFerramenta(identificador(), StatusResultado.SUCESSO, dados,
                a.inicio(), a.fim(), c.solicitadoEm(), r.avisos(), r.qualidade());
    }
}

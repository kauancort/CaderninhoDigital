package com.InovaSkill.CaderninhoDigital.ai.finance;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.tool.*;
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoCobrancasResponseDTO;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.enums.SituacaoCobranca;
import com.InovaSkill.CaderninhoDigital.service.VendaService;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class ConsultarResumoRecebiveisFerramenta implements FerramentaLeitura<ArgumentosPeriodo> {
    private final VendaService service;
    public ConsultarResumoRecebiveisFerramenta(VendaService service) { this.service = service; }
    public FerramentaPermitida identificador() { return FerramentaPermitida.RESUMO_RECEBIVEIS; }
    public String descricao() { return "Resume vendas pendentes por situação de vencimento, sem identificar clientes"; }
    public TipoArgumentosFerramenta tipoArgumentos() { return TipoArgumentosFerramenta.PERIODO; }
    public Class<ArgumentosPeriodo> classeArgumentos() { return ArgumentosPeriodo.class; }
    public PerfilUsuario permissaoNecessaria() { return PerfilUsuario.GESTOR; }
    public Duration timeout() { return Duration.ofSeconds(3); }
    public ResultadoFerramenta executar(ArgumentosPeriodo a, ContextoExecucaoFerramenta c) {
        long id = c.identidade().usuarioId();
        var total = resumo(id, a, null);
        var dados = new LinkedHashMap<String,Object>();
        dados.put("totalEmAberto", total.totalReceber());
        dados.put("totalVencido", total.totalVencido());
        dados.put("totalAVencer", total.totalEmDia());
        dados.put("quantidadeCobrancas", total.quantidadeCobrancas());
        dados.put("atraso1a7Dias", faixa(resumo(id, a, SituacaoCobranca.ATRASO_RECENTE)));
        dados.put("atraso8a30Dias", faixa(resumo(id, a, SituacaoCobranca.ATRASO_MEDIO)));
        dados.put("atrasoAcima30Dias", faixa(resumo(id, a, SituacaoCobranca.MUITO_ATRASADO)));
        return new ResultadoFerramenta(identificador(), StatusResultado.SUCESSO, dados,
                a.inicio(), a.fim(), c.solicitadoEm(),
                List.of("Cada venda pendente é uma cobrança integral; pagamentos parciais não são modelados."),
                QualidadeResultado.PARCIAL);
    }
    private ResumoCobrancasResponseDTO resumo(long id, ArgumentosPeriodo a, SituacaoCobranca situacao) {
        return service.resumirRecebiveisIa(id, a.inicio(), a.fim(), situacao);
    }
    private Map<String,Object> faixa(ResumoCobrancasResponseDTO r) {
        return Map.of("valor", r.totalReceber(), "quantidade", r.quantidadeCobrancas());
    }
}

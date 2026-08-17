package com.InovaSkill.CaderninhoDigital.ai.finance;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.tool.*;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.service.VendaService;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class ConsultarResumoVendasFerramenta implements FerramentaLeitura<ArgumentosPeriodo> {
    private final VendaService service;
    public ConsultarResumoVendasFerramenta(VendaService service) { this.service = service; }
    public FerramentaPermitida identificador() { return FerramentaPermitida.RESUMO_VENDAS; }
    public String descricao() { return "Resume valores finais e quantidade de vendas em um período"; }
    public TipoArgumentosFerramenta tipoArgumentos() { return TipoArgumentosFerramenta.PERIODO; }
    public Class<ArgumentosPeriodo> classeArgumentos() { return ArgumentosPeriodo.class; }
    public PerfilUsuario permissaoNecessaria() { return PerfilUsuario.GESTOR; }
    public Duration timeout() { return Duration.ofSeconds(3); }
    public ResultadoFerramenta executar(ArgumentosPeriodo a, ContextoExecucaoFerramenta c) {
        var r = service.resumirVendasEmpresaIa(c.identidade().empresaId(), a.inicio(), a.fim());
        var dados = new LinkedHashMap<String,Object>();
        dados.put("valorTotalValido", r.faturamento());
        dados.put("quantidadeVendas", r.quantidadeVendas());
        dados.put("ticketMedio", r.ticketMedio());
        dados.put("quantidadeItens", r.quantidadeItens());
        return new ResultadoFerramenta(identificador(), StatusResultado.SUCESSO, dados,
                a.inicio(), a.fim(), c.solicitadoEm(), List.of(), QualidadeResultado.COMPLETO);
    }
}

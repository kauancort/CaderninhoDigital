package com.InovaSkill.CaderninhoDigital.ai.finance;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.tool.*;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.repository.LancamentoRepository;
import com.InovaSkill.CaderninhoDigital.service.UsuarioAcessoService;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class ConsultarResumoGastosFerramenta implements FerramentaLeitura<ArgumentosPeriodo> {
    private final LancamentoRepository repository;
    private final UsuarioAcessoService acesso;
    public ConsultarResumoGastosFerramenta(LancamentoRepository repository, UsuarioAcessoService acesso) {
        this.repository = repository; this.acesso = acesso;
    }
    public FerramentaPermitida identificador() { return FerramentaPermitida.RESUMO_GASTOS; }
    public String descricao() { return "Resume lançamentos do tipo gasto geral em um período"; }
    public TipoArgumentosFerramenta tipoArgumentos() { return TipoArgumentosFerramenta.PERIODO; }
    public Class<ArgumentosPeriodo> classeArgumentos() { return ArgumentosPeriodo.class; }
    public PerfilUsuario permissaoNecessaria() { return PerfilUsuario.GESTOR; }
    public Duration timeout() { return Duration.ofSeconds(3); }
    public ResultadoFerramenta executar(ArgumentosPeriodo a, ContextoExecucaoFerramenta c) {
        acesso.buscarGestor(c.identidade().usuarioId());
        var r = repository.resumirGastos(a.inicio(), a.fim());
        var dados = new LinkedHashMap<String,Object>();
        dados.put("totalGastos", r.getTotal() == null ? BigDecimal.ZERO : r.getTotal());
        dados.put("quantidadeLancamentos", r.getQuantidade() == null ? 0L : r.getQuantidade());
        return new ResultadoFerramenta(identificador(), StatusResultado.SUCESSO, dados,
                a.inicio(), a.fim(), c.solicitadoEm(),
                List.of("Categorias não estão estruturadas; o agrupamento foi omitido."), QualidadeResultado.PARCIAL);
    }
}

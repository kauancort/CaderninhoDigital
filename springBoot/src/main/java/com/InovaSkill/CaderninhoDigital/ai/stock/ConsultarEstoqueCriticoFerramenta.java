package com.InovaSkill.CaderninhoDigital.ai.stock;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.tool.*;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import java.time.Duration;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Component;

@Component
public class ConsultarEstoqueCriticoFerramenta implements FerramentaLeitura<ArgumentosSemFiltro> {
    private final ConsultaEstoqueCriticoService service;
    public ConsultarEstoqueCriticoFerramenta(ConsultaEstoqueCriticoService service) { this.service = service; }
    public FerramentaPermitida identificador() { return FerramentaPermitida.RESUMO_ESTOQUE; }
    public String descricao() { return "Consulta insumos ativos com quantidade atual menor ou igual ao estoque mínimo"; }
    public TipoArgumentosFerramenta tipoArgumentos() { return TipoArgumentosFerramenta.SEM_FILTRO; }
    public Class<ArgumentosSemFiltro> classeArgumentos() { return ArgumentosSemFiltro.class; }
    public PerfilUsuario permissaoNecessaria() { return PerfilUsuario.GESTOR; }
    public Duration timeout() { return Duration.ofSeconds(3); }
    public ResultadoFerramenta executar(ArgumentosSemFiltro argumentos, ContextoExecucaoFerramenta contexto) {
        var resultado = service.consultar(contexto.identidade().empresaId());
        var dados = new LinkedHashMap<String, Object>();
        dados.put("criterio", resultado.criterio());
        dados.put("itensAvaliados", resultado.itensAvaliados());
        dados.put("itensCriticos", resultado.itensCriticos());
        dados.put("itens", resultado.itens());
        dados.put("dadosInsuficientes", resultado.dadosInsuficientes());
        return new ResultadoFerramenta(identificador(), StatusResultado.SUCESSO, dados, null, null,
                resultado.atualizadoEm(), resultado.avisos(),
                resultado.dadosInsuficientes() == 0 ? QualidadeResultado.COMPLETO : QualidadeResultado.PARCIAL);
    }
}

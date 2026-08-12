package com.InovaSkill.CaderninhoDigital.ai.cost;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.tool.*;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import java.time.Duration;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Component;

@Component
public class AnalisarComprasInsumoFerramenta implements FerramentaLeitura<ArgumentosCompraInsumo> {
    private final AnaliseComprasInsumoService service;
    public AnalisarComprasInsumoFerramenta(AnaliseComprasInsumoService service) { this.service = service; }
    public FerramentaPermitida identificador() { return FerramentaPermitida.ANALISE_COMPRAS_INSUMO; }
    public String descricao() { return "Analisa o histórico interno de compras de uma matéria-prima"; }
    public TipoArgumentosFerramenta tipoArgumentos() { return TipoArgumentosFerramenta.COMPRA_INSUMO; }
    public Class<ArgumentosCompraInsumo> classeArgumentos() { return ArgumentosCompraInsumo.class; }
    public PerfilUsuario permissaoNecessaria() { return PerfilUsuario.GESTOR; }
    public Duration timeout() { return Duration.ofSeconds(3); }
    public ResultadoFerramenta executar(ArgumentosCompraInsumo a, ContextoExecucaoFerramenta c) {
        var r = service.analisar(c.identidade().usuarioId(), a.materiaPrimaId(), a.inicio(), a.fim());
        var dados = new LinkedHashMap<String,Object>();
        dados.put("materiaPrimaId", r.materiaPrimaId());
        dados.put("valorTotal", r.valorTotal());
        dados.put("insumosAnalisados", r.insumosAnalisados());
        dados.put("itens", r.itens());
        dados.put("simulacaoMensal", r.simulacaoMensal());
        return new ResultadoFerramenta(identificador(), StatusResultado.SUCESSO, dados, a.inicio(), a.fim(),
                c.solicitadoEm(), r.avisos(), r.qualidade());
    }
}

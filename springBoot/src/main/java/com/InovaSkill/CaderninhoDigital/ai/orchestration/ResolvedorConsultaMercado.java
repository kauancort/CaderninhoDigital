package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosComparacaoMercado;
import com.InovaSkill.CaderninhoDigital.ai.contract.ChamadaFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class ResolvedorConsultaMercado {
    private static final Pattern QUANTIDADE = Pattern.compile("(?i)(\\d+(?:[.,]\\d+)?)\\s*(kg|quilo(?:s)?|l|litro(?:s)?|unidade(?:s)?)\\b");
    private static final Pattern DATA = Pattern.compile("(?<!\\d)(\\d{2}/\\d{2}/\\d{4})(?!\\d)");
    private static final Pattern LOCAL = Pattern.compile("(?iu)\\bem\\s+([\\p{L} .'-]{2,100})\\s*/\\s*([A-Z]{2})\\b");
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/uuuu");
    private final MateriaPrimaRepository materias;
    private final AiOrchestratorProperties properties;
    private final Clock clock;

    public ResolvedorConsultaMercado(MateriaPrimaRepository materias, AiOrchestratorProperties properties, Clock clock) {
        this.materias=materias; this.properties=properties; this.clock=clock;
    }

    public ChamadaFerramenta resolver(String mensagem) {
        if (!properties.getFeatures().isSearch() || mensagem==null) return null;
        String texto=normalizar(mensagem);
        if (!texto.matches("(?s).*(preco|precos|mercado|oferta|ofertas|economia|economizar|pagando caro|compare).*") ) return null;
        var quantidade=QUANTIDADE.matcher(mensagem); if(!quantidade.find()) return null;
        List<MateriaPrima> correspondencias=materias.findAllByOrderByNomeAsc().stream()
                .filter(m -> Boolean.TRUE.equals(m.getAtivo()) && texto.contains(normalizar(m.getNome()))).toList();
        if(correspondencias.size()!=1) return null;
        MateriaPrima materia=correspondencias.getFirst();
        LocalDate hoje=LocalDate.now(clock), inicio=hoje.minusMonths(6).plusDays(1), fim=hoje;
        var datas=DATA.matcher(mensagem); if(datas.find()) { inicio=LocalDate.parse(datas.group(1),DATA_BR);
            if(datas.find()) fim=LocalDate.parse(datas.group(1),DATA_BR); else return null; }
        String cidade=properties.getSearch().getDefaultCity(), uf=properties.getSearch().getDefaultState();
        var local=LOCAL.matcher(mensagem); if(local.find()){cidade=local.group(1).trim();uf=local.group(2).toUpperCase(Locale.ROOT);}
        String unidade=normalizarUnidade(quantidade.group(2));
        return new ChamadaFerramenta(FerramentaPermitida.COMPARAR_PRECO_MERCADO,
                new ArgumentosComparacaoMercado(materia.getId(),inicio,fim,unidade,
                        new BigDecimal(quantidade.group(1).replace(',','.')),cidade,uf));
    }

    private String normalizarUnidade(String unidade){return switch(normalizar(unidade)){
        case "quilo","quilos"->"kg"; case "litro","litros"->"L"; case "unidades"->"unidade"; default->unidade;};}
    private String normalizar(String valor){return Normalizer.normalize(valor,Normalizer.Form.NFD)
            .replaceAll("\\p{M}+","").toLowerCase(Locale.ROOT);}
}

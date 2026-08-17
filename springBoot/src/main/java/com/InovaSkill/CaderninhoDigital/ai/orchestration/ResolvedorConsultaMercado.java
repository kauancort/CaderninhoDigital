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
import java.util.Set;
import java.util.HashSet;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class ResolvedorConsultaMercado {
    private static final Pattern QUANTIDADE = Pattern.compile("(?i)(\\d+(?:[.,]\\d+)?)\\s*(kg|quilo(?:s)?|l|litro(?:s)?|unidade(?:s)?)\\b");
    private static final Pattern DATA = Pattern.compile("(?<!\\d)(\\d{2}/\\d{2}/\\d{4})(?!\\d)");
    private static final Pattern LOCAL = Pattern.compile("(?iu)\\bem\\s+([\\p{L} .'-]{2,100})\\s*/\\s*([A-Z]{2})\\b");
    private static final Set<String> FORMAS_DISTINTAS = Set.of("condensado", "evaporado", "po", "liquido",
            "granulado", "triturado", "farinha", "extrato", "concentrado", "xarope", "molho", "creme");
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/uuuu");
    private final MateriaPrimaRepository materias;
    private final AiOrchestratorProperties properties;
    private final Clock clock;

    public ResolvedorConsultaMercado(MateriaPrimaRepository materias, AiOrchestratorProperties properties, Clock clock) {
        this.materias=materias; this.properties=properties; this.clock=clock;
    }

    public ChamadaFerramenta resolver(String mensagem, Long empresaId) {
        if (!properties.getFeatures().isSearch() || mensagem==null) return null;
        String texto=normalizar(mensagem);
        if (!texto.matches("(?s).*(preco|precos|mercado|oferta|ofertas|economia|economizar|pagando caro|compare).*") ) return null;
        var quantidade=QUANTIDADE.matcher(mensagem); boolean possuiQuantidade = quantidade.find();
        MateriaPrima materia = identificarMateriaPrima(texto, materias.listarAcessiveisParaAnalise(empresaId));
        if (materia == null) return null;
        LocalDate hoje=LocalDate.now(clock), inicio=hoje.minusDays(89), fim=hoje;
        var datas=DATA.matcher(mensagem); if(datas.find()) { inicio=LocalDate.parse(datas.group(1),DATA_BR);
            if(datas.find()) fim=LocalDate.parse(datas.group(1),DATA_BR); else return null; }
        String cidade=properties.getSearch().getDefaultCity(), uf=properties.getSearch().getDefaultState();
        var local=LOCAL.matcher(mensagem); if(local.find()){cidade=local.group(1).trim();uf=local.group(2).toUpperCase(Locale.ROOT);}
        String unidade=possuiQuantidade ? normalizarUnidade(quantidade.group(2)) : materia.getUnidadeMedida();
        return new ChamadaFerramenta(FerramentaPermitida.COMPARAR_PRECO_MERCADO,
                new ArgumentosComparacaoMercado(materia.getId(),inicio,fim,unidade,
                        possuiQuantidade ? new BigDecimal(quantidade.group(1).replace(',','.')) : null,cidade,uf));
    }

    public ChamadaFerramenta resolver(String mensagem) { return resolver(mensagem, -1L); }

    private MateriaPrima identificarMateriaPrima(String texto, List<MateriaPrima> cadastradas) {
        List<MateriaPrima> ativas = cadastradas.stream()
                .filter(m -> Boolean.TRUE.equals(m.getAtivo()) && m.getNome() != null).toList();
        List<MateriaPrima> nomeCompleto = ativas.stream()
                .filter(m -> texto.contains(normalizar(m.getNome()))).toList();
        if (nomeCompleto.size() == 1) return nomeCompleto.getFirst();
        // Se nomes completos se sobrepõem (por exemplo, "açúcar" e
        // "açúcar demerara"), não escolhemos silenciosamente.
        if (nomeCompleto.size() > 1) return null;

        Set<String> tokensPergunta = new HashSet<>(tokens(texto));
        List<Candidata> candidatas = ativas.stream().map(m -> {
            List<String> tokensNome = tokens(m.getNome());
            long presentes = tokensNome.stream().filter(tokensPergunta::contains).count();
            long formasAusentes = tokensNome.stream()
                    .filter(token -> !tokensPergunta.contains(token) && FORMAS_DISTINTAS.contains(token)).count();
            return new Candidata(m, presentes, formasAusentes, tokensNome.size() - presentes);
        }).filter(c -> c.tokensPresentes() > 0)
                .sorted(java.util.Comparator.comparingLong(Candidata::tokensPresentes).reversed()
                        .thenComparingLong(Candidata::formasAusentes)
                        .thenComparingLong(Candidata::tokensAusentes))
                .toList();
        if (candidatas.isEmpty()) return null;
        Candidata melhor = candidatas.getFirst();
        if (candidatas.size() > 1) {
            Candidata segunda = candidatas.get(1);
            if (melhor.tokensPresentes() == segunda.tokensPresentes()
                    && melhor.formasAusentes() == segunda.formasAusentes()
                    && melhor.tokensAusentes() == segunda.tokensAusentes()) return null;
        }
        return melhor.materia();
    }

    private List<String> tokens(String valor) {
        return java.util.Arrays.stream(normalizar(valor).split("[^a-z0-9]+"))
                .filter(token -> token.length() > 2 || "po".equals(token)).toList();
    }

    private record Candidata(MateriaPrima materia, long tokensPresentes, long formasAusentes,
            long tokensAusentes) {}

    private String normalizarUnidade(String unidade){return switch(normalizar(unidade)){
        case "quilo","quilos"->"kg"; case "litro","litros"->"L"; case "unidades"->"unidade"; default->unidade;};}
    private String normalizar(String valor){return Normalizer.normalize(valor,Normalizer.Form.NFD)
            .replaceAll("\\p{M}+","").toLowerCase(Locale.ROOT);}
}

package com.InovaSkill.CaderninhoDigital.ai.profit;

import com.InovaSkill.CaderninhoDigital.ai.search.FontePesquisaPreco;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Converte benchmarks externos em um cenário separado dos custos cadastrados.
 * Somente percentuais explicitamente associados a receita/faturamento e
 * confirmados por dois domínios independentes entram no cálculo. A mediana é
 * usada para reduzir a influência de valores extremos.
 */
@Service
public class EstimadorCustosIndiretosService {
    private static final Pattern PERCENTUAL = Pattern.compile("(?<!\\d)(\\d{1,2}(?:[.,]\\d{1,2})?)\\s*%");
    private static final Pattern BASE_RECEITA = Pattern.compile(
            "(?i)\\b(receita|faturamento|pre[cç]o de venda|valor da venda|vendas)\\b");
    private static final Map<String, List<String>> ALIASES = Map.of(
            "energia", List.of("energia", "eletricidade", "conta de luz"),
            "gás", List.of("gas", "glp"),
            "mão de obra", List.of("mao de obra", "pessoal", "salarios", "folha de pagamento"),
            "transporte", List.of("transporte", "frete", "logistica"),
            "perdas", List.of("perdas", "desperdicio", "quebra"));
    private static final Map<String, BigDecimal> LIMITES = Map.of(
            "energia", new BigDecimal("30"), "gás", new BigDecimal("30"),
            "mão de obra", new BigDecimal("60"), "transporte", new BigDecimal("30"),
            "perdas", new BigDecimal("30"));
    private static final List<String> ALIASES_AGREGADOS = List.of(
            "gastos operacionais", "custos operacionais", "despesas operacionais", "custos fixos", "custo fixo",
            "despesas fixas", "despesa fixa");

    public AnaliseRentabilidadeProdutoService.EstimativaCustosIndiretos estimar(
            List<String> custosAusentes, List<FontePesquisaPreco> fontes, BigDecimal precoBase) {
        List<String> naoEstimados = new ArrayList<>();
        if (custosAusentes.stream().map(this::normalizar).anyMatch("impostos"::equals))
            naoEstimados.add("impostos: depende do regime tributário e da faixa de faturamento da empresa");

        List<Amostra> agregadas = porDominio(extrairAliases(fontes, ALIASES_AGREGADOS,
                new BigDecimal("60"), false, true));
        if (agregadas.size() >= 2) {
            var componente = componente("custos operacionais agregados", agregadas, precoBase, true);
            naoEstimados.add("energia, gás, mão de obra, transporte e perdas: referência disponível apenas de forma agregada");
            return new AnaliseRentabilidadeProdutoService.EstimativaCustosIndiretos("PARCIAL",
                    "MEDIANA_REFERENCIAS_EXTERNAS", precoBase, componente.valorEstimadoUnidade(),
                    null, null, null, List.of(componente), List.copyOf(naoEstimados),
                    "Cenário externo indicativo; não substitui custos cadastrados nem apuração contábil.");
        }

        Map<String, List<Amostra>> amostras = new LinkedHashMap<>();
        for (String custo : custosAusentes) {
            if ("impostos".equals(normalizar(custo))) {
                continue;
            }
            amostras.put(custo, extrair(custo, fontes));
        }

        List<AnaliseRentabilidadeProdutoService.EstimativaComponenteIndireto> componentes = new ArrayList<>();
        BigDecimal totalEstimado = BigDecimal.ZERO;
        for (var entrada : amostras.entrySet()) {
            List<Amostra> validas = porDominio(entrada.getValue());
            if (validas.size() < 2) {
                naoEstimados.add(entrada.getKey() + ": menos de 2 referências independentes com percentual aplicável");
                continue;
            }
            var componente = componente(entrada.getKey(), validas, precoBase, false);
            BigDecimal valor = componente.valorEstimadoUnidade();
            if (valor != null) totalEstimado = totalEstimado.add(valor);
            componentes.add(componente);
        }

        String status;
        if (componentes.isEmpty()) status = "DADOS_INSUFICIENTES";
        else if (naoEstimados.isEmpty()) status = "CALCULADA";
        else status = "PARCIAL";
        return new AnaliseRentabilidadeProdutoService.EstimativaCustosIndiretos(status,
                "MEDIANA_REFERENCIAS_EXTERNAS", precoBase,
                componentes.isEmpty() || precoBase == null ? null : totalEstimado.setScale(4, RoundingMode.HALF_UP),
                null, null, null, List.copyOf(componentes), List.copyOf(naoEstimados),
                "Cenário externo indicativo; não substitui custos cadastrados nem apuração contábil.");
    }

    private List<Amostra> extrair(String custo, List<FontePesquisaPreco> fontes) {
        List<String> aliases = ALIASES.getOrDefault(normalizar(custo), List.of(normalizar(custo)));
        return extrairAliases(fontes, aliases, LIMITES.getOrDefault(normalizar(custo), new BigDecimal("30")),
                true, false);
    }

    private List<Amostra> extrairAliases(List<FontePesquisaPreco> fontes, List<String> aliases,
            BigDecimal limite, boolean exigirCategoriaUnica, boolean aliasDevePreceder) {
        List<Amostra> resultado = new ArrayList<>();
        for (FontePesquisaPreco fonte : fontes == null ? List.<FontePesquisaPreco>of() : fontes) {
            Matcher percentual = PERCENTUAL.matcher(fonte.trecho());
            Amostra melhor = null;
            int menorDistancia = Integer.MAX_VALUE;
            while (percentual.find()) {
                int inicio = Math.max(0, percentual.start() - 140);
                int fim = Math.min(fonte.trecho().length(), percentual.end() + 140);
                String trecho = fonte.trecho().substring(inicio, fim);
                String normalizado = normalizar(trecho);
                int distancia = distanciaAliasMaisProximo(normalizado, aliases,
                        percentual.start() - inicio, aliasDevePreceder);
                if (distancia == Integer.MAX_VALUE || !BASE_RECEITA.matcher(trecho).find()) continue;
                long categoriasMencionadas = ALIASES.values().stream()
                        .filter(lista -> lista.stream().anyMatch(alias -> contemAlias(normalizado, alias))).count();
                // Evita atribuir o mesmo percentual a duas categorias citadas juntas.
                if (exigirCategoriaUnica && categoriasMencionadas != 1) continue;
                BigDecimal valor = new BigDecimal(percentual.group(1).replace(',', '.'));
                if (valor.signum() > 0 && valor.compareTo(limite) <= 0 && distancia < menorDistancia) {
                    melhor = new Amostra(fonte, valor, limitar(trecho.trim(), 240));
                    menorDistancia = distancia;
                }
            }
            if (melhor != null) resultado.add(melhor);
        }
        return resultado;
    }

    private int distanciaAliasMaisProximo(String texto, List<String> aliases, int posicaoPercentual,
            boolean devePreceder) {
        int menor = Integer.MAX_VALUE;
        for (String alias : aliases) {
            Matcher matcher = Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(alias)
                    + "(?![\\p{L}\\p{N}])").matcher(texto);
            while (matcher.find()) {
                if (devePreceder && matcher.end() > posicaoPercentual) continue;
                int distancia = Math.abs(matcher.start() - posicaoPercentual);
                if (!devePreceder || distancia <= 120) menor = Math.min(menor, distancia);
            }
        }
        return menor;
    }

    private AnaliseRentabilidadeProdutoService.EstimativaComponenteIndireto componente(String nome,
            List<Amostra> validas, BigDecimal precoBase, boolean agregado) {
        List<BigDecimal> percentuais = validas.stream().map(Amostra::percentual).sorted().toList();
        BigDecimal mediana = mediana(percentuais);
        BigDecimal valor = precoBase == null ? null
                : precoBase.multiply(mediana).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        List<AnaliseRentabilidadeProdutoService.ReferenciaCustoIndireto> referencias = validas.stream()
                .map(a -> new AnaliseRentabilidadeProdutoService.ReferenciaCustoIndireto(
                        a.fonte().titulo(), a.fonte().url().toString(), a.percentual(), a.evidencia()))
                .toList();
        return new AnaliseRentabilidadeProdutoService.EstimativaComponenteIndireto(nome,
                percentuais.getFirst(), mediana, percentuais.getLast(), "RECEITA", valor,
                validas.size(), !agregado && validas.size() >= 3 ? "ALTA" : "MEDIA", referencias);
    }

    private List<Amostra> porDominio(List<Amostra> amostras) {
        Set<String> dominios = new LinkedHashSet<>();
        return amostras.stream().filter(a -> dominios.add(a.fonte().dominio()))
                .sorted(Comparator.comparing(Amostra::percentual)).toList();
    }

    private BigDecimal mediana(List<BigDecimal> valores) {
        int meio = valores.size() / 2;
        return valores.size() % 2 == 1 ? valores.get(meio)
                : valores.get(meio - 1).add(valores.get(meio)).divide(BigDecimal.valueOf(2), 4,
                        RoundingMode.HALF_UP);
    }

    private String normalizar(String valor) {
        return Normalizer.normalize(valor == null ? "" : valor, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
    }

    private boolean contemAlias(String textoNormalizado, String alias) {
        return Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(alias)
                + "(?![\\p{L}\\p{N}])").matcher(textoNormalizado).find();
    }

    private String limitar(String valor, int limite) {
        return valor.length() <= limite ? valor : valor.substring(0, limite);
    }

    private record Amostra(FontePesquisaPreco fonte, BigDecimal percentual, String evidencia) {}
}

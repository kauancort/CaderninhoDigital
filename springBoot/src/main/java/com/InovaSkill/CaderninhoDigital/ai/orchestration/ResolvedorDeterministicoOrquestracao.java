package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.dto.request.AcaoRapidaAssistente;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import java.text.Normalizer;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import java.math.BigDecimal;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class ResolvedorDeterministicoOrquestracao {
    private static final Pattern DATA_BR = Pattern.compile("(?<!\\d)(\\d{2}/\\d{2}/\\d{4})(?!\\d)");
    private static final Pattern ID_MATERIA = Pattern.compile("(?i)mat[eé]ria[- ]prima\\s*(?:id\\s*)?(\\d+)");
    private static final Pattern QUANTIDADE_UNIDADE = Pattern.compile("(?i)(\\d+(?:[.,]\\d+)?)\\s*(kg|quilo(?:s)?|l|litro(?:s)?|unidade(?:s)?)\\b");
    private static final Pattern LOCALIDADE = Pattern.compile("(?iu)\\bem\\s+([\\p{L} .'-]{2,100})\\s*/\\s*([A-Z]{2})\\b");
    private static final DateTimeFormatter FORMATO_DATA_BR = DateTimeFormatter.ofPattern("dd/MM/uuuu")
            .withResolverStyle(ResolverStyle.STRICT);
    private final AiOrchestratorProperties properties;
    private final Clock clock;

    public ResolvedorDeterministicoOrquestracao(AiOrchestratorProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    public ChamadaFerramenta acaoRapida(AcaoRapidaAssistente acao) {
        if (acao == null) return null;
        if (acao == AcaoRapidaAssistente.RESUMIR_NEGOCIO) {
            throw new OrquestradorException(CodigoErroOrquestrador.PLANO_INVALIDO,
                    HttpStatus.BAD_REQUEST, "Ação rápida não disponível");
        }
        ArgumentosPeriodo mesAtual = periodoMesAtual();
        return switch (acao) {
            case VERIFICAR_ESTOQUE -> new ChamadaFerramenta(FerramentaPermitida.RESUMO_ESTOQUE,
                    new ArgumentosSemFiltro());
            case RESUMIR_VENDAS -> new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS, mesAtual);
            case RESUMIR_GASTOS -> new ChamadaFerramenta(FerramentaPermitida.RESUMO_GASTOS, mesAtual);
            case VERIFICAR_RECEBIVEIS -> new ChamadaFerramenta(FerramentaPermitida.RESUMO_RECEBIVEIS, mesAtual);
            case RESUMIR_NEGOCIO -> throw new IllegalStateException("Ação validada anteriormente");
        };
    }

    public ChamadaFerramenta consultaDireta(String mensagem) {
        if (mensagem == null || mensagem.isBlank()) return null;
        String texto = normalizar(mensagem);
        boolean vendas = contem(texto, "venda|vendas|vendemos|vendeu|faturamento");
        boolean gastos = contem(texto, "gasto|gastos|despesa|despesas");
        boolean recebiveis = contem(texto, "receber|recebiveis|recebimento|cobranca|cobrancas");
        boolean estoque = contem(texto, "estoque");
        boolean comprasInsumos = contem(texto, "materia prima|materias primas|materia-prima|materias-primas|insumo|insumos")
                && contem(texto, "compra|compras|comprando|gasto|gastando|desnecessaria|desnecessario");
        ChamadaFerramenta mercado = comparacaoMercado(mensagem, texto);
        if (mercado != null) return mercado;
        if (comprasInsumos) {
            LocalDate hoje = LocalDate.now(clock);
            return new ChamadaFerramenta(FerramentaPermitida.ANALISE_COMPRAS_INSUMO,
                    new ArgumentosCompraInsumo(null, hoje.minusMonths(6).plusDays(1), hoje));
        }
        if ((vendas ? 1 : 0) + (gastos ? 1 : 0) + (recebiveis ? 1 : 0) + (estoque ? 1 : 0) != 1) return null;
        if (estoque) return new ChamadaFerramenta(FerramentaPermitida.RESUMO_ESTOQUE,
                new ArgumentosSemFiltro());
        FerramentaPermitida ferramenta = vendas ? FerramentaPermitida.RESUMO_VENDAS
                : gastos ? FerramentaPermitida.RESUMO_GASTOS : FerramentaPermitida.RESUMO_RECEBIVEIS;
        return new ChamadaFerramenta(ferramenta, periodo(mensagem, texto));
    }

    private ChamadaFerramenta comparacaoMercado(String original, String normalizado) {
        if (!properties.getFeatures().isSearch()
                || !contem(normalizado, "preco|precos|mercado|oferta|ofertas|economia|economizar")) return null;
        var id = ID_MATERIA.matcher(original); var quantidade = QUANTIDADE_UNIDADE.matcher(original);
        if (!id.find() || !quantidade.find()) return null;
        String unidade = switch (normalizar(quantidade.group(2))) {
            case "quilo", "quilos" -> "kg";
            case "litro", "litros" -> "L";
            case "unidades" -> "unidade";
            default -> quantidade.group(2);
        };
        String cidade = properties.getSearch().getDefaultCity();
        String uf = properties.getSearch().getDefaultState();
        var local = LOCALIDADE.matcher(original);
        if (local.find()) { cidade = local.group(1).trim(); uf = local.group(2).toUpperCase(Locale.ROOT); }
        ArgumentosPeriodo periodo = periodo(original, normalizado);
        return new ChamadaFerramenta(FerramentaPermitida.COMPARAR_PRECO_MERCADO,
                new ArgumentosComparacaoMercado(Long.parseLong(id.group(1)), periodo.inicio(), periodo.fim(),
                        unidade, new BigDecimal(quantidade.group(1).replace(',', '.')), cidade, uf));
    }

    public PlanoOrquestracao comparacaoDireta(String mensagem) {
        if (mensagem == null || mensagem.isBlank()) return null;
        String texto = normalizar(mensagem);
        boolean vendas = contem(texto, "venda|vendas|vendemos|vendeu|faturamento");
        boolean gastos = contem(texto, "gasto|gastos|despesa|despesas");
        boolean comparaMeses = vendas && (texto.contains("mes passado") || texto.contains("mes anterior"))
                && (texto.contains("esse mes") || texto.contains("este mes") || texto.contains("mes atual"));
        if (comparaMeses) {
            LocalDate hoje = LocalDate.now(clock);
            LocalDate anterior = hoje.minusMonths(1);
            int ultimoDiaComparavel = Math.min(hoje.getDayOfMonth(), anterior.lengthOfMonth());
            return new PlanoOrquestracao(properties.getSchemaVersion(), IntencaoOrquestrador.COMPARAR_VENDAS_PERIODOS,
                    List.of(
                            new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS,
                                    new ArgumentosPeriodo(anterior.withDayOfMonth(1),
                                            anterior.withDayOfMonth(ultimoDiaComparavel))),
                            new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS,
                                    new ArgumentosPeriodo(hoje.withDayOfMonth(1), hoje))),
                    ModoResposta.ANALITICA);
        }
        if (!vendas || !gastos) return null;
        ArgumentosPeriodo periodo = periodo(mensagem, texto);
        return new PlanoOrquestracao(properties.getSchemaVersion(), IntencaoOrquestrador.COMPARAR_VENDAS_GASTOS,
                List.of(new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS, periodo),
                        new ChamadaFerramenta(FerramentaPermitida.RESUMO_GASTOS, periodo)),
                ModoResposta.ANALITICA);
    }

    private ArgumentosPeriodo periodo(String original, String normalizado) {
        var matcher = DATA_BR.matcher(original);
        LocalDate inicio = null;
        LocalDate fim = null;
        try {
            if (matcher.find()) inicio = LocalDate.parse(matcher.group(1), FORMATO_DATA_BR);
            if (matcher.find()) fim = LocalDate.parse(matcher.group(1), FORMATO_DATA_BR);
        } catch (DateTimeParseException exception) {
            throw argumentosInvalidos("A data informada é inválida");
        }
        if (inicio != null && fim != null) return new ArgumentosPeriodo(inicio, fim);
        if (inicio != null) throw argumentosInvalidos("Informe as datas inicial e final do período");
        LocalDate hoje = LocalDate.now(clock);
        if (normalizado.matches("(?s).*\\bhoje\\b.*")) return new ArgumentosPeriodo(hoje, hoje);
        if (normalizado.contains("esta semana") || normalizado.contains("essa semana")
                || normalizado.contains("semana atual")) {
            LocalDate inicioSemana = hoje.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            return new ArgumentosPeriodo(inicioSemana, hoje);
        }
        if (normalizado.contains("mes passado") || normalizado.contains("mes anterior")) {
            LocalDate anterior = hoje.minusMonths(1);
            return new ArgumentosPeriodo(anterior.withDayOfMonth(1), anterior.withDayOfMonth(anterior.lengthOfMonth()));
        }
        return periodoMesAtual();
    }

    private ArgumentosPeriodo periodoMesAtual() {
        LocalDate hoje = LocalDate.now(clock);
        return new ArgumentosPeriodo(hoje.withDayOfMonth(1), hoje);
    }

    private String normalizar(String texto) {
        return Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT);
    }

    private boolean contem(String texto, String alternativas) {
        return texto.matches("(?s).*\\b(" + alternativas + ")\\b.*");
    }

    private OrquestradorException argumentosInvalidos(String mensagem) {
        return new OrquestradorException(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS,
                HttpStatus.BAD_REQUEST, mensagem);
    }
}

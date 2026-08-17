package com.InovaSkill.CaderninhoDigital.ai.search;

import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class TavilyPesquisaPrecosGateway implements PesquisaPrecosGateway, PesquisaCustosIndiretosGateway {
    private static final int MAX_RESPONSE_CHARACTERS = 500_000;
    private static final Pattern PRECO = Pattern.compile("(?i)R\\$\\s*\\d");
    private static final Pattern PERCENTUAL = Pattern.compile("(?i)\\b\\d{1,2}(?:[.,]\\d{1,2})?\\s*%");
    private static final Pattern SINAL_CUSTO_INDIRETO = Pattern.compile(
            "(?i)\\b(energia|eletricidade|g[aá]s|glp|m[aã]o de obra|pessoal|sal[aá]rios|folha|"
                    + "impostos?|tributos?|transporte|frete|log[ií]stica|perdas?|desperd[ií]cio|"
                    + "gastos? operacionais?|custos? operacionais?|despesas? operacionais?|"
                    + "custos? fixos?|despesas? fixas?)\\b");
    private static final Pattern BASE_PERCENTUAL = Pattern.compile(
            "(?i)\\b(receita|faturamento|vendas?|pre[cç]o de venda|custos? de produ[cç][aã]o)\\b");
    private static final Pattern SINAL_CUSTO_AGREGADO = Pattern.compile(
            "(?i)\\b(gastos? operacionais?|custos? operacionais?|despesas? operacionais?|"
                    + "custos? fixos?|despesas? fixas?)\\b");
    private static final Pattern SINAL_COMERCIAL_FORTE = Pattern.compile(
            "(?i)\\b(loja|comprar|compra|venda|oferta|atacado|distribuidor|fornecedor|catalogo|pacote|saco|"
                    + "embalagem|marketplace|e[ -]?commerce|mercado livre|online|shop|store)\\b");
    private static final Pattern QUANTIDADE_COMERCIAL = Pattern.compile(
            "(?i)\\b\\d+(?:[.,]\\d+)?\\s*(kg|quilo(?:s)?|g|grama(?:s)?|l|litro(?:s)?|ml|mililitro(?:s)?|unidade(?:s)?)\\b");
    private static final Pattern INJECAO = Pattern.compile("(?i)(ignore.{0,30}instru|system prompt|mensagem de sistema|execute.{0,20}tool|<script)");
    private final AiOrchestratorProperties properties;
    private final ObjectMapper mapper;
    private final Validator validator;
    private final TavilyTransport transport;
    private final Clock clock;
    private final MeterRegistry metrics;
    private final ConcurrentMap<ChaveCache, EntradaCache> cache = new ConcurrentHashMap<>();
    private final ConcurrentMap<ChaveCacheCustos, EntradaCacheCustos> cacheCustos = new ConcurrentHashMap<>();

    TavilyPesquisaPrecosGateway(AiOrchestratorProperties properties, ObjectMapper mapper,
            Validator validator, TavilyTransport transport, Clock clock, MeterRegistry metrics) {
        this.properties=properties; this.mapper=mapper; this.validator=validator;
        this.transport=transport; this.clock=clock; this.metrics=metrics;
    }

    public ResultadoPesquisaPrecos pesquisar(SolicitacaoPesquisaPrecos solicitacao) {
        long inicio = System.nanoTime();
        try { return pesquisarComCache(solicitacao); }
        finally { metrics.timer("ai.etapa.latencia", "etapa", "pesquisa_externa")
                .record(Duration.ofNanos(Math.max(0, System.nanoTime()-inicio))); }
    }

    @Override
    public ResultadoPesquisaCustosIndiretos pesquisarCustosIndiretos(
            SolicitacaoPesquisaCustosIndiretos solicitacao) {
        long inicio = System.nanoTime();
        try { return pesquisarCustosComCache(solicitacao); }
        finally { metrics.timer("ai.etapa.latencia", "etapa", "pesquisa_custos_indiretos")
                .record(Duration.ofNanos(Math.max(0, System.nanoTime()-inicio))); }
    }

    private ResultadoPesquisaCustosIndiretos pesquisarCustosComCache(
            SolicitacaoPesquisaCustosIndiretos solicitacao) {
        validarSolicitacaoCustos(solicitacao);
        int minutos = properties.getSearch().getCacheMinutes();
        ChaveCacheCustos chave = new ChaveCacheCustos(semAcentos(solicitacao.produto()).trim(),
                semAcentos(solicitacao.categoria()).trim(), semAcentos(solicitacao.cidade()).trim(),
                solicitacao.uf().toUpperCase(Locale.ROOT), solicitacao.custosAusentes().stream()
                        .map(this::semAcentos).sorted().toList());
        Instant agora = Instant.now(clock);
        EntradaCacheCustos existente = cacheCustos.get(chave);
        if (minutos > 0 && existente != null
                && Duration.between(existente.armazenadoEm(), agora).toMinutes() < minutos) {
            metrics.counter("ai.pesquisa.cache", "resultado", "hit_custos_indiretos").increment();
            return existente.resultado();
        }
        ResultadoPesquisaCustosIndiretos resultado = pesquisarCustosInterno(solicitacao);
        if (minutos > 0) cacheCustos.put(chave, new EntradaCacheCustos(agora, resultado));
        log.info("evento=PESQUISA_EXTERNA_EXECUTADA tipo=CUSTOS_INDIRETOS status=SUCESSO fontes={}",
                resultado.fontes().size());
        return resultado;
    }

    private ResultadoPesquisaCustosIndiretos pesquisarCustosInterno(
            SolicitacaoPesquisaCustosIndiretos solicitacao) {
        var config = properties.getSearch();
        String consultaAgregada = montarConsultaCustosAgregados(solicitacao, config.getMaxQueryCharacters());
        ResultadoPesquisaCustosIndiretos agregados = pesquisarCustosConsulta(solicitacao, consultaAgregada, config);
        if (agregados.fontes().stream().filter(f -> SINAL_CUSTO_AGREGADO.matcher(f.trecho()).find()
                && PERCENTUAL.matcher(f.trecho()).find() && BASE_PERCENTUAL.matcher(f.trecho()).find()).count() >= 2)
            return agregados;
        String consulta = montarConsultaCustos(solicitacao, config.getMaxQueryCharacters());
        ResultadoPesquisaCustosIndiretos individuais = pesquisarCustosConsulta(solicitacao, consulta, config);
        List<FontePesquisaPreco> fontes = new ArrayList<>();
        Set<String> dominios = new HashSet<>();
        for (FontePesquisaPreco fonte : java.util.stream.Stream
                .concat(agregados.fontes().stream(), individuais.fontes().stream()).toList()) {
            if (fontes.size() >= config.getMaxResults()) break;
            if (dominios.add(fonte.dominio())) fontes.add(fonte);
        }
        List<String> avisos = fontes.isEmpty()
                ? List.of("Nenhuma referência com percentual e base de cálculo explícitos foi encontrada.") : List.of();
        return new ResultadoPesquisaCustosIndiretos(consultaAgregada + " | " + consulta,
                Instant.now(clock), List.copyOf(fontes), avisos);
    }

    private ResultadoPesquisaCustosIndiretos pesquisarCustosConsulta(
            SolicitacaoPesquisaCustosIndiretos solicitacao, String consulta,
            AiOrchestratorProperties.Search config) {
        String body = prepararBody(consulta, config.getCandidateResults());
        TavilyTransport.Resposta resposta = enviar(URI.create(config.getUrl()), body);
        classificar(resposta.status());
        return interpretarCustos(solicitacao, consulta, resposta.body());
    }

    private void validarSolicitacaoCustos(SolicitacaoPesquisaCustosIndiretos solicitacao) {
        if (!properties.getFeatures().isSearch()) throw erro(CodigoErroOrquestrador.NAO_AUTORIZADO,
                HttpStatus.FORBIDDEN, "Pesquisa externa não está habilitada");
        if (solicitacao == null || !validator.validate(solicitacao).isEmpty()
                || !rotuloSeguro(solicitacao.produto()) || !rotuloSeguro(solicitacao.cidade())
                || (solicitacao.categoria() != null && !solicitacao.categoria().isBlank()
                        && !rotuloSeguro(solicitacao.categoria()))
                || solicitacao.custosAusentes() == null
                || solicitacao.custosAusentes().stream().anyMatch(c -> !rotuloSeguro(c))) {
            throw erro(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS, HttpStatus.BAD_REQUEST,
                    "Parâmetros da pesquisa são inválidos");
        }
        if (properties.getSearch().getKey() == null || properties.getSearch().getKey().isBlank())
            throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE,
                    "Pesquisa externa não configurada");
    }

    private ResultadoPesquisaPrecos pesquisarComCache(SolicitacaoPesquisaPrecos solicitacao) {
        if (solicitacao == null || !validator.validate(solicitacao).isEmpty()) return pesquisarInterno(solicitacao);
        int minutos = properties.getSearch().getCacheMinutes();
        ChaveCache chave = chave(solicitacao);
        Instant agora = Instant.now(clock);
        EntradaCache existente = cache.get(chave);
        if (minutos > 0 && existente != null
                && Duration.between(existente.armazenadoEm(), agora).toMinutes() < minutos) {
            metrics.counter("ai.pesquisa.cache", "resultado", "hit").increment();
            log.info("evento=PESQUISA_EXTERNA_EXECUTADA status=CACHE_HIT fontes={}",
                    existente.resultado().fontes().size());
            return existente.resultado();
        }
        metrics.counter("ai.pesquisa.cache", "resultado", "miss").increment();
        ResultadoPesquisaPrecos resultado = pesquisarInterno(solicitacao);
        if (minutos > 0) {
            cache.entrySet().removeIf(item -> Duration.between(item.getValue().armazenadoEm(), agora)
                    .toMinutes() >= minutos);
            cache.put(chave, new EntradaCache(agora, resultado));
        }
        log.info("evento=PESQUISA_EXTERNA_EXECUTADA status=SUCESSO fontes={}", resultado.fontes().size());
        return resultado;
    }

    private ResultadoPesquisaPrecos pesquisarInterno(SolicitacaoPesquisaPrecos solicitacao) {
        if (!properties.getFeatures().isSearch()) throw erro(CodigoErroOrquestrador.NAO_AUTORIZADO,
                HttpStatus.FORBIDDEN, "Pesquisa externa não está habilitada");
        if (solicitacao == null || !validator.validate(solicitacao).isEmpty()
                || !rotuloSeguro(solicitacao.insumo()) || !rotuloSeguro(solicitacao.cidade())
                || (solicitacao.qualificadores() != null && !qualificadoresSeguros(solicitacao.qualificadores()))) {
            throw erro(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS, HttpStatus.BAD_REQUEST,
                    "Parâmetros da pesquisa são inválidos");
        }
        var config=properties.getSearch();
        if (config.getKey()==null || config.getKey().isBlank()) throw erro(
                CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE,
                "Pesquisa externa não configurada");
        String consulta = montarConsulta(solicitacao, config.getMaxQueryCharacters());
        if (consulta.length()>config.getMaxQueryCharacters()) throw erro(CodigoErroOrquestrador.LIMITE_EXCEDIDO,
                HttpStatus.PAYLOAD_TOO_LARGE, "Consulta excede o limite permitido");
        String body = prepararBody(consulta, config.getCandidateResults());
        TavilyTransport.Resposta resposta=enviar(URI.create(config.getUrl()), body);
        classificar(resposta.status());
        return interpretar(solicitacao.insumo(),consulta,resposta.body());
    }

    private String prepararBody(String consulta, int maximoResultados) {
        try {
            var json=mapper.createObjectNode(); json.put("query",consulta); json.put("search_depth","advanced");
            // Busca mais candidatos para que o filtro local possa preservar diversidade e evidência aplicável.
            json.put("max_results", maximoResultados); json.put("include_answer",false);
            json.put("include_raw_content","text"); return mapper.writeValueAsString(json);
        } catch (Exception e) { throw erro(CodigoErroOrquestrador.ERRO_INTERNO,
                HttpStatus.INTERNAL_SERVER_ERROR,"Não foi possível preparar a pesquisa"); }
    }

    private TavilyTransport.Resposta enviar(URI uri,String body) {
        var future=transport.enviar(uri,Map.of("Authorization","Bearer "+properties.getSearch().getKey(),
                "Content-Type","application/json"),body,Duration.ofMillis(properties.getSearch().getTimeoutMs()));
        try { return future.get(properties.getSearch().getTimeoutMs(),TimeUnit.MILLISECONDS); }
        catch (TimeoutException|CancellationException e) { future.cancel(true); throw timeout(); }
        catch (InterruptedException e) { future.cancel(true); Thread.currentThread().interrupt(); throw timeout(); }
        catch (ExecutionException e) {
            if (e.getCause() instanceof HttpTimeoutException) throw timeout();
            throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL,HttpStatus.SERVICE_UNAVAILABLE,"Pesquisa externa indisponível");
        }
    }

    private ResultadoPesquisaPrecos interpretar(String insumo,String consulta,String body) {
        try {
            if (body == null || body.length() > MAX_RESPONSE_CHARACTERS) throw new IllegalArgumentException("body");
            JsonNode root=mapper.readTree(body); List<FontePesquisaPreco> fontes=new ArrayList<>();
            Set<String> dominios = new HashSet<>();
            for (JsonNode item:root.path("results")) {
                if (fontes.size()>=properties.getSearch().getMaxResults()) break;
                String titulo=limitar(item.path("title").asText("Fonte sem título"),120);
                String trecho=trechoUtil(item);
                URI url=urlSegura(item.path("url").asText(null));
                if (url==null || trecho.isBlank() || INJECAO.matcher(trecho).find()
                        || !sinalComercial(titulo, url, item) || dominios.contains(url.getHost().toLowerCase(Locale.ROOT))) continue;
                dominios.add(url.getHost().toLowerCase(Locale.ROOT));
                fontes.add(new FontePesquisaPreco(titulo,url,url.getHost().toLowerCase(Locale.ROOT),trecho));
            }
            List<String> avisos=fontes.isEmpty()
                    ? List.of("Nenhuma fonte comercial ou catálogo de produto utilizável foi encontrado.") : List.of();
            return new ResultadoPesquisaPrecos(consulta,Instant.now(clock),List.copyOf(fontes),avisos);
        } catch (Exception e) { throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL,
                HttpStatus.BAD_GATEWAY,"Resposta inválida da pesquisa externa"); }
    }

    private ResultadoPesquisaCustosIndiretos interpretarCustos(SolicitacaoPesquisaCustosIndiretos solicitacao,
            String consulta, String body) {
        try {
            if (body == null || body.length() > MAX_RESPONSE_CHARACTERS) throw new IllegalArgumentException("body");
            JsonNode root = mapper.readTree(body); List<FontePesquisaPreco> fontes = new ArrayList<>();
            Set<String> dominios = new HashSet<>();
            for (JsonNode item : root.path("results")) {
                if (fontes.size() >= properties.getSearch().getMaxResults()) break;
                String titulo = limitar(item.path("title").asText("Fonte sem título"), 120);
                String trecho = trechoCustos(item);
                URI url = urlSegura(item.path("url").asText(null));
                if (url == null || trecho.isBlank() || INJECAO.matcher(trecho).find()
                        || !sinalCustoAplicavel(trecho) || !contextoCustosComparavel(solicitacao, titulo + " " + trecho)
                        || dominios.contains(url.getHost().toLowerCase(Locale.ROOT)))
                    continue;
                dominios.add(url.getHost().toLowerCase(Locale.ROOT));
                fontes.add(new FontePesquisaPreco(titulo, url, url.getHost().toLowerCase(Locale.ROOT), trecho));
            }
            List<String> avisos = fontes.isEmpty()
                    ? List.of("Nenhuma referência com percentual e base de cálculo explícitos foi encontrada.") : List.of();
            return new ResultadoPesquisaCustosIndiretos(consulta, Instant.now(clock), List.copyOf(fontes), avisos);
        } catch (Exception e) { throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL,
                HttpStatus.BAD_GATEWAY, "Resposta inválida da pesquisa externa"); }
    }

    private String trechoUtil(JsonNode item) {
        String resumo=item.path("content").asText("");
        String bruto=item.path("raw_content").asText("");
        String preferido = !bruto.isBlank() && PRECO.matcher(bruto).find() ? bruto : resumo;
        return limitar(preferido.replaceAll("\\s+"," ").trim(),properties.getSearch().getMaxSnippetCharacters());
    }

    private String trechoCustos(JsonNode item) {
        String resumo = item.path("content").asText("");
        String bruto = item.path("raw_content").asText("");
        String preferido = !bruto.isBlank() && PERCENTUAL.matcher(bruto).find() ? bruto : resumo;
        String limpo = preferido.replaceAll("\\s+", " ").trim();
        int maximo = properties.getSearch().getMaxSnippetCharacters();
        StringBuilder evidencias = new StringBuilder();
        Matcher percentuais = PERCENTUAL.matcher(limpo);
        while (percentuais.find() && evidencias.length() < maximo) {
            int inicio = Math.max(0, percentuais.start() - 260);
            int fim = Math.min(limpo.length(), percentuais.end() + 260);
            String janela = limpo.substring(inicio, fim).trim();
            if (!SINAL_CUSTO_INDIRETO.matcher(janela).find() || !BASE_PERCENTUAL.matcher(janela).find()) continue;
            int restante = maximo - evidencias.length();
            if (evidencias.length() > 0 && restante > 5) {
                evidencias.append(" ... ");
                restante -= 5;
            }
            if (restante > 0) evidencias.append(limitar(janela, restante));
        }
        if (!evidencias.isEmpty()) return evidencias.toString();
        return limitar(resumo.replaceAll("\\s+", " ").trim(), maximo);
    }

    private boolean sinalCustoAplicavel(String trecho) {
        return PERCENTUAL.matcher(trecho).find() && SINAL_CUSTO_INDIRETO.matcher(trecho).find()
                && BASE_PERCENTUAL.matcher(trecho).find();
    }

    private boolean contextoCustosComparavel(SolicitacaoPesquisaCustosIndiretos solicitacao, String texto) {
        String fonte = semAcentos(texto);
        String alvo = semAcentos(solicitacao.produto() + " "
                + (solicitacao.categoria() == null ? "" : solicitacao.categoria()));
        boolean termoAlvo = List.of(alvo.split("\\s+")).stream().filter(t -> t.length() >= 4)
                .anyMatch(fonte::contains);
        boolean setorAlimentos = fonte.matches("(?s).*\\b(confeitaria|doces?|alimentos?|panifica[cç][aã]o|"
                + "cozinha|produ[cç][aã]o artesanal|restaurante)\\b.*");
        return termoAlvo || setorAlimentos;
    }

    private boolean sinalComercial(String titulo, URI url, JsonNode item) {
        String identificador = semAcentos(titulo + " " + url);
        if (SINAL_COMERCIAL_FORTE.matcher(identificador).find()) return true;
        String conteudo = item.path("content").asText("") + " " + item.path("raw_content").asText("");
        String combinado = identificador + " " + semAcentos(conteudo);
        return PRECO.matcher(conteudo).find()
                && (SINAL_COMERCIAL_FORTE.matcher(combinado).find()
                        || QUANTIDADE_COMERCIAL.matcher(combinado).find());
    }

    private String montarConsulta(SolicitacaoPesquisaPrecos solicitacao, int maximo) {
        String intencao = solicitacao.produtoFinal()
                ? "%s %s preço varejo %s %s".formatted(solicitacao.insumo(),
                        solicitacao.qualificadores() == null ? "" : solicitacao.qualificadores(),
                        solicitacao.cidade(), solicitacao.uf()).replaceAll("\\s+", " ").trim()
                : "%s fornecedor atacado %s %s preço comprar".formatted(
                        solicitacao.insumo(), solicitacao.quantidade(), solicitacao.unidade());
        if (intencao.length() > maximo) {
            throw erro(CodigoErroOrquestrador.LIMITE_EXCEDIDO, HttpStatus.PAYLOAD_TOO_LARGE,
                    "Consulta excede o limite permitido");
        }
        if (solicitacao.produtoFinal()) return intencao;
        String local = " %s %s".formatted(solicitacao.cidade(), solicitacao.uf());
        if (intencao.length() + local.length() <= maximo) return intencao + local;
        String estado = " " + solicitacao.uf();
        return intencao.length() + estado.length() <= maximo ? intencao + estado : intencao;
    }

    private String montarConsultaCustos(SolicitacaoPesquisaCustosIndiretos solicitacao, int maximo) {
        String segmento = solicitacao.categoria() == null || solicitacao.categoria().isBlank()
                ? solicitacao.produto() : solicitacao.categoria();
        String custos = String.join(" ", solicitacao.custosAusentes());
        String consulta = ("percentual faturamento custos produção " + segmento
                + " confeitaria alimentos " + custos + " Brasil")
                .replaceAll("\\s+", " ").trim();
        if (consulta.length() > maximo) {
            consulta = ("percentual faturamento custos produção " + segmento + " energia mão de obra perdas Brasil")
                    .replaceAll("\\s+", " ").trim();
        }
        if (consulta.length() > maximo) throw erro(CodigoErroOrquestrador.LIMITE_EXCEDIDO,
                HttpStatus.PAYLOAD_TOO_LARGE, "Consulta excede o limite permitido");
        return consulta;
    }

    private String montarConsultaCustosAgregados(SolicitacaoPesquisaCustosIndiretos solicitacao, int maximo) {
        String segmento = solicitacao.categoria() == null || solicitacao.categoria().isBlank()
                ? solicitacao.produto() : solicitacao.categoria();
        String consulta = (segmento + " confeitaria padaria gastos operacionais custos fixos percentual faturamento receita")
                .replaceAll("\\s+", " ").trim();
        if (consulta.length() > maximo) throw erro(CodigoErroOrquestrador.LIMITE_EXCEDIDO,
                HttpStatus.PAYLOAD_TOO_LARGE, "Consulta excede o limite permitido");
        return consulta;
    }

    private String semAcentos(String valor) {
        return Normalizer.normalize(valor == null ? "" : valor, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
    }

    private ChaveCache chave(SolicitacaoPesquisaPrecos s) {
        return new ChaveCache(semAcentos(s.insumo()).trim(), semAcentos(s.unidade()).trim(),
                s.quantidade().setScale(0, java.math.RoundingMode.CEILING).toPlainString(),
                semAcentos(s.cidade()).trim(), s.uf().toUpperCase(Locale.ROOT), s.produtoFinal(),
                semAcentos(s.qualificadores()).trim());
    }

    private URI urlSegura(String valor) {
        try { URI uri=URI.create(valor); String host=uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host==null || host.equalsIgnoreCase("localhost")
                    || host.endsWith(".local") || host.contains(":") || enderecoIpv4Privado(host)) return null;
            return uri;
        } catch (RuntimeException e) { return null; }
    }
    private boolean enderecoIpv4Privado(String host) {
        if (!host.matches("\\d{1,3}(?:\\.\\d{1,3}){3}")) return false;
        String[] partes=host.split("\\."); int primeiro=Integer.parseInt(partes[0]); int segundo=Integer.parseInt(partes[1]);
        return primeiro==0 || primeiro==10 || primeiro==127 || primeiro>=224
                || primeiro==169&&segundo==254 || primeiro==172&&segundo>=16&&segundo<=31
                || primeiro==192&&segundo==168;
    }
    private boolean rotuloSeguro(String v){ return v!=null && v.matches("[\\p{L}0-9 .,'-]{1,100}") && !INJECAO.matcher(v).find(); }
    private boolean qualificadoresSeguros(String v){ return v.matches("[\\p{L}0-9 .,'-]{0,160}") && !INJECAO.matcher(v).find(); }
    private String limitar(String v,int max){ return v.length()<=max?v:v.substring(0,max); }
    private void classificar(int s){ if(s>=200&&s<300)return; if(s==400)throw erro(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS,HttpStatus.BAD_GATEWAY,"O provedor rejeitou a pesquisa"); if(s==401||s==403)throw erro(CodigoErroOrquestrador.NAO_AUTORIZADO,HttpStatus.SERVICE_UNAVAILABLE,"Pesquisa externa não autorizada"); if(s==429)throw erro(CodigoErroOrquestrador.LIMITE_EXCEDIDO,HttpStatus.TOO_MANY_REQUESTS,"Limite da pesquisa externa atingido"); throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL,HttpStatus.SERVICE_UNAVAILABLE,"Pesquisa externa indisponível"); }
    private OrquestradorException timeout(){return erro(CodigoErroOrquestrador.TIMEOUT,HttpStatus.GATEWAY_TIMEOUT,"Pesquisa externa excedeu o tempo limite");}
    private OrquestradorException erro(CodigoErroOrquestrador c,HttpStatus s,String m){return new OrquestradorException(c,s,m);}
    private record ChaveCache(String produto, String unidade, String quantidadeAproximada,
            String cidade, String uf, boolean produtoFinal, String qualificadores) {}
    private record EntradaCache(Instant armazenadoEm, ResultadoPesquisaPrecos resultado) {}
    private record ChaveCacheCustos(String produto, String categoria, String cidade, String uf,
            List<String> custosAusentes) {}
    private record EntradaCacheCustos(Instant armazenadoEm, ResultadoPesquisaCustosIndiretos resultado) {}
}

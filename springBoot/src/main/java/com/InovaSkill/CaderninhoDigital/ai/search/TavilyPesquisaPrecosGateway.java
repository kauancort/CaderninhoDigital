package com.InovaSkill.CaderninhoDigital.ai.search;

import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import io.micrometer.core.instrument.MeterRegistry;

@Component
public class TavilyPesquisaPrecosGateway implements PesquisaPrecosGateway {
    private static final int MAX_RESPONSE_CHARACTERS = 500_000;
    private static final Pattern PRECO = Pattern.compile("(?i)R\\$\\s*\\d");
    private static final Pattern INJECAO = Pattern.compile("(?i)(ignore.{0,30}instru|system prompt|mensagem de sistema|execute.{0,20}tool|<script)");
    private final AiOrchestratorProperties properties;
    private final ObjectMapper mapper;
    private final Validator validator;
    private final TavilyTransport transport;
    private final Clock clock;
    private final MeterRegistry metrics;

    TavilyPesquisaPrecosGateway(AiOrchestratorProperties properties, ObjectMapper mapper,
            Validator validator, TavilyTransport transport, Clock clock, MeterRegistry metrics) {
        this.properties=properties; this.mapper=mapper; this.validator=validator;
        this.transport=transport; this.clock=clock; this.metrics=metrics;
    }

    public ResultadoPesquisaPrecos pesquisar(SolicitacaoPesquisaPrecos solicitacao) {
        long inicio = System.nanoTime();
        try { return pesquisarInterno(solicitacao); }
        finally { metrics.timer("ai.etapa.latencia", "etapa", "pesquisa_externa")
                .record(Duration.ofNanos(Math.max(0, System.nanoTime()-inicio))); }
    }

    private ResultadoPesquisaPrecos pesquisarInterno(SolicitacaoPesquisaPrecos solicitacao) {
        if (!properties.getFeatures().isSearch()) throw erro(CodigoErroOrquestrador.NAO_AUTORIZADO,
                HttpStatus.FORBIDDEN, "Pesquisa externa não está habilitada");
        if (solicitacao == null || !validator.validate(solicitacao).isEmpty()
                || !rotuloSeguro(solicitacao.insumo()) || !rotuloSeguro(solicitacao.cidade())) {
            throw erro(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS, HttpStatus.BAD_REQUEST,
                    "Parâmetros da pesquisa são inválidos");
        }
        var config=properties.getSearch();
        if (config.getKey()==null || config.getKey().isBlank()) throw erro(
                CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE,
                "Pesquisa externa não configurada");
        String consulta = "%s preço %s %s %s %s".formatted(solicitacao.insumo(), solicitacao.quantidade(),
                solicitacao.unidade(), solicitacao.cidade(), solicitacao.uf());
        if (consulta.length()>config.getMaxQueryCharacters()) throw erro(CodigoErroOrquestrador.LIMITE_EXCEDIDO,
                HttpStatus.PAYLOAD_TOO_LARGE, "Consulta excede o limite permitido");
        String body;
        try {
            var json=mapper.createObjectNode(); json.put("query",consulta); json.put("search_depth","basic");
            json.put("max_results",config.getMaxResults()); json.put("include_answer",false);
            json.put("include_raw_content","text"); body=mapper.writeValueAsString(json);
        } catch (Exception e) { throw erro(CodigoErroOrquestrador.ERRO_INTERNO,
                HttpStatus.INTERNAL_SERVER_ERROR,"Não foi possível preparar a pesquisa"); }
        TavilyTransport.Resposta resposta=enviar(URI.create(config.getUrl()), body);
        classificar(resposta.status());
        return interpretar(consulta,resposta.body());
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

    private ResultadoPesquisaPrecos interpretar(String consulta,String body) {
        try {
            if (body == null || body.length() > MAX_RESPONSE_CHARACTERS) throw new IllegalArgumentException("body");
            JsonNode root=mapper.readTree(body); List<FontePesquisaPreco> fontes=new ArrayList<>();
            for (JsonNode item:root.path("results")) {
                if (fontes.size()>=properties.getSearch().getMaxResults()) break;
                String titulo=limitar(item.path("title").asText("Fonte sem título"),120);
                String trecho=trechoUtil(item);
                URI url=urlSegura(item.path("url").asText(null));
                if (url==null || trecho.isBlank() || INJECAO.matcher(trecho).find()) continue;
                fontes.add(new FontePesquisaPreco(titulo,url,url.getHost().toLowerCase(Locale.ROOT),trecho));
            }
            List<String> avisos=fontes.isEmpty()?List.of("Nenhuma fonte segura e utilizável foi encontrada."):List.of();
            return new ResultadoPesquisaPrecos(consulta,Instant.now(clock),List.copyOf(fontes),avisos);
        } catch (Exception e) { throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL,
                HttpStatus.BAD_GATEWAY,"Resposta inválida da pesquisa externa"); }
    }

    private String trechoUtil(JsonNode item) {
        String resumo=item.path("content").asText("");
        String bruto=item.path("raw_content").asText("");
        String preferido = !bruto.isBlank() && PRECO.matcher(bruto).find() ? bruto : resumo;
        return limitar(preferido.replaceAll("\\s+"," ").trim(),properties.getSearch().getMaxSnippetCharacters());
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
    private String limitar(String v,int max){ return v.length()<=max?v:v.substring(0,max); }
    private void classificar(int s){ if(s>=200&&s<300)return; if(s==400)throw erro(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS,HttpStatus.BAD_GATEWAY,"O provedor rejeitou a pesquisa"); if(s==401||s==403)throw erro(CodigoErroOrquestrador.NAO_AUTORIZADO,HttpStatus.SERVICE_UNAVAILABLE,"Pesquisa externa não autorizada"); if(s==429)throw erro(CodigoErroOrquestrador.LIMITE_EXCEDIDO,HttpStatus.TOO_MANY_REQUESTS,"Limite da pesquisa externa atingido"); throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL,HttpStatus.SERVICE_UNAVAILABLE,"Pesquisa externa indisponível"); }
    private OrquestradorException timeout(){return erro(CodigoErroOrquestrador.TIMEOUT,HttpStatus.GATEWAY_TIMEOUT,"Pesquisa externa excedeu o tempo limite");}
    private OrquestradorException erro(CodigoErroOrquestrador c,HttpStatus s,String m){return new OrquestradorException(c,s,m);}
}

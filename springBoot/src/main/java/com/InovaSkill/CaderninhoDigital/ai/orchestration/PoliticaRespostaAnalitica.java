package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PoliticaRespostaAnalitica {
    private static final Pattern NUMERO = Pattern.compile("(?<![\\p{L}])[-+]?\\d[\\d.,]*(?![\\p{L}])");
    private static final Pattern URL = Pattern.compile("https?://[^\\s)]+", Pattern.CASE_INSENSITIVE);

    public String validar(String texto, JsonNode dados, boolean possuiAvisos) {
        if (texto == null || texto.isBlank()) throw invalida();
        Set<BigDecimal> permitidos = new HashSet<>(); Set<String> urls = new HashSet<>();
        coletar(dados, permitidos, urls);
        var numeros = NUMERO.matcher(URL.matcher(texto).replaceAll(""));
        while (numeros.find()) {
            BigDecimal numero = decimal(numeros.group());
            if (numero != null && permitidos.stream().noneMatch(p -> p.compareTo(numero) == 0)) throw invalida();
        }
        var links = URL.matcher(texto);
        while (links.find()) if (!urls.contains(links.group())) throw invalida();
        String normalizado = texto.toLowerCase(Locale.ROOT);
        if (possuiAvisos && !(normalizado.contains("aviso") || normalizado.contains("limita")
                || normalizado.contains("parcial") || normalizado.contains("não foi")
                || normalizado.contains("não é possível"))) throw invalida();
        return texto;
    }

    private void coletar(JsonNode node, Set<BigDecimal> numeros, Set<String> urls) {
        if (node == null) return;
        if (node.isNumber()) numeros.add(node.decimalValue().stripTrailingZeros());
        else if (node.isTextual() && node.textValue().startsWith("https://")) urls.add(node.textValue());
        else node.elements().forEachRemaining(item -> coletar(item, numeros, urls));
    }

    private BigDecimal decimal(String valor) {
        try {
            String limpo = valor.replace("+", "");
            if (limpo.contains(",")) limpo = limpo.replace(".", "").replace(',', '.');
            return new BigDecimal(limpo).stripTrailingZeros();
        } catch (NumberFormatException e) { return null; }
    }

    private OrquestradorException invalida() {
        return new OrquestradorException(CodigoErroOrquestrador.PLANO_INVALIDO,
                HttpStatus.BAD_GATEWAY, "A redação do modelo não preservou os dados validados");
    }
}

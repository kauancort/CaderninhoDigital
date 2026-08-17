package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class PoliticaRespostaAnalitica {
    private static final Pattern NUMERO = Pattern.compile("(?<![\\p{L}])[-+]?\\d[\\d.,]*(?![\\p{L}])");
    private static final Pattern URL = Pattern.compile("https?://[^\\s)]+", Pattern.CASE_INSENSITIVE);

    public String validar(String texto, JsonNode dados, boolean possuiAvisos) {
        if (texto == null || texto.isBlank()) throw invalida("TEXTO_VAZIO");
        Set<BigDecimal> permitidos = new HashSet<>(); Set<String> urls = new HashSet<>();
        coletar(dados, permitidos, urls);
        var numeros = NUMERO.matcher(URL.matcher(texto).replaceAll(""));
        while (numeros.find()) {
            BigDecimal numero = decimal(numeros.group());
            if (numero != null && permitidos.stream().noneMatch(p -> p.compareTo(numero) == 0))
                throw invalida("NUMERO_NAO_VALIDADO");
        }
        var links = URL.matcher(texto);
        while (links.find()) if (!urls.contains(links.group())) throw invalida("URL_NAO_VALIDADA");
        String normalizado = texto.toLowerCase(Locale.ROOT);
        if (possuiAvisos && !(normalizado.contains("aviso") || normalizado.contains("limita")
                || normalizado.contains("parcial") || normalizado.contains("não foi")
                || normalizado.contains("não informado") || normalizado.contains("confirme")
                || normalizado.contains("não é possível") || normalizado.contains("não representa")
                || normalizado.contains("não estão") || normalizado.contains("não inclui")
                || normalizado.contains("custos não"))) throw invalida("AVISO_OMITIDO");
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

    private OrquestradorException invalida(String motivo) {
        log.warn("evento=RESPOSTA_ANALITICA_REJEITADA motivo={}", motivo);
        return new OrquestradorException(CodigoErroOrquestrador.PLANO_INVALIDO,
                HttpStatus.BAD_GATEWAY, "A redação do modelo não preservou os dados validados");
    }
}

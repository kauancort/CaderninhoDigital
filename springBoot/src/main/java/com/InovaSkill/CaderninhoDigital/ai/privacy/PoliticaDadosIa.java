package com.InovaSkill.CaderninhoDigital.ai.privacy;

import com.InovaSkill.CaderninhoDigital.ai.gateway.MensagemModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.PapelMensagemModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.SolicitacaoModelo;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PoliticaDadosIa {
    public static final String RESPOSTA_BLOQUEADA =
            "Não posso atender a essa solicitação porque ela envolve dados ou instruções não permitidos.";

    private static final List<Pattern> DADOS_RESTRITOS = List.of(
            Pattern.compile("(?<!\\d)\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}(?!\\d)"),
            Pattern.compile("(?<!\\d)\\d{2}\\.?\\d{3}\\.?\\d{3}/?\\d{4}-?\\d{2}(?!\\d)"),
            Pattern.compile("(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b"),
            Pattern.compile("(?<!\\d)(?:\\+?55\\s*)?(?:\\(?\\d{2}\\)?\\s*)?9?\\d{4}[-\\s]?\\d{4}(?!\\d)"),
            Pattern.compile("(?i)\\b(?:rua|avenida|av\\.|travessa|alameda|rodovia)\\s+[\\p{L}0-9 .,'-]{2,}"),
            Pattern.compile("\\b(?:cliente|comprador|fornecedor|usuário|usuario)\\s*[:=-]?\\s+[A-ZÀ-Ý][\\p{L}'-]{1,}(?:\\s+[A-ZÀ-Ý][\\p{L}'-]{1,})*"),
            Pattern.compile("\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b"),
            Pattern.compile("(?i)\\b(?:sk|api)[-_]?(?:key|token)[=: ]+[A-Za-z0-9._-]{8,}"),
            Pattern.compile("(?i)\\b(?:senha|password|secret|token)\\s*[=:]\\s*\\S+"),
            Pattern.compile("(?i)\\b(?:jdbc:|postgres(?:ql)?://|mysql://)\\S+")
    );

    private static final List<Pattern> EXFILTRACAO = List.of(
            Pattern.compile("(?i)ignore (?:todas? )?(?:as )?instruções? (?:anteriores|acima)"),
            Pattern.compile("(?i)(?:revele|mostre|retorne|imprima).{0,40}(?:mensagem|prompt) (?:de )?sistema"),
            Pattern.compile("(?i)(?:revele|mostre|retorne|liste|obtenha|extraia).{0,50}"
                    + "(?:credenciais?|senhas?|tokens?|chaves? de api|dados pessoais|cpf|cnpj)"),
            Pattern.compile("(?i)\\b(?:select|insert|update|delete|drop|alter)\\b.{0,80}\\b(?:from|into|table|database|schema)\\b"),
            Pattern.compile("(?i)(?:acesse|chame|execute|use).{0,30}https?://"),
            Pattern.compile("(?i)(?:ferramenta|tool)\\s+(?:desconhecida|arbitrária|arbitraria|não permitida)"),
            Pattern.compile("(?i)(?:aumente|ignore|remova|contorne).{0,40}(?:limite|permissão|permissao|política|politica)")
    );

    private final AiOrchestratorProperties properties;

    public PoliticaDadosIa(AiOrchestratorProperties properties) {
        this.properties = properties;
    }

    public void validarEntradaChat(String texto) {
        validarTamanho(texto);
        if (contemDadoRestrito(texto) || contemExfiltracao(texto)) throw solicitacaoBloqueada();
    }

    public String sanitizarTranscricaoOperacional(String texto) {
        validarTamanho(texto);
        if (contemExfiltracao(texto)) throw solicitacaoBloqueada();
        String resultado = texto;
        for (Pattern pattern : DADOS_RESTRITOS) {
            resultado = pattern.matcher(resultado).replaceAll("[DADO_RESTRITO_REMOVIDO]");
        }
        return resultado;
    }

    public boolean rotuloOperacionalPermitido(String texto) {
        return texto != null && !texto.isBlank()
                && texto.length() <= properties.getLimits().getContextStringCharacters()
                && !contemDadoRestrito(texto) && !contemExfiltracao(texto);
    }

    public String delimitarEntradaNaoConfiavel(String texto) {
        return "<entrada_nao_confiavel>\n" + texto + "\n</entrada_nao_confiavel>";
    }

    public void validarSolicitacaoModelo(SolicitacaoModelo solicitacao) {
        if (solicitacao.mensagens().size() > properties.getLimits().getProviderMessages()) {
            throw limite("Payload excede o limite de mensagens do provedor");
        }
        long caracteres = 0;
        for (MensagemModelo mensagem : solicitacao.mensagens()) {
            caracteres += mensagem.conteudo().length();
            if (contemDadoRestrito(mensagem.conteudo())) throw solicitacaoBloqueada();
            if (mensagem.papel() != PapelMensagemModelo.SYSTEM && contemExfiltracao(mensagem.conteudo())) {
                throw solicitacaoBloqueada();
            }
        }
        if (caracteres > properties.getLimits().getProviderPayloadCharacters()) {
            throw limite("Payload excede o limite de contexto do provedor");
        }
    }

    public String protegerRespostaTexto(String texto) {
        if (texto == null || texto.isBlank()) return RESPOSTA_BLOQUEADA;
        return contemDadoRestrito(texto) || contemExfiltracao(texto) ? RESPOSTA_BLOQUEADA : texto.trim();
    }

    public void validarSaidaEstruturada(String json) {
        if (json == null || contemDadoRestrito(json) || contemExfiltracao(json)) {
            throw new OrquestradorException(CodigoErroOrquestrador.PLANO_INVALIDO,
                    HttpStatus.BAD_GATEWAY, "A resposta do modelo violou a política de dados");
        }
    }

    private void validarTamanho(String texto) {
        if (texto == null || texto.isBlank()) {
            throw new OrquestradorException(CodigoErroOrquestrador.ENTRADA_INVALIDA,
                    HttpStatus.BAD_REQUEST, "Texto obrigatório");
        }
        if (texto.length() > properties.getLimits().getContextStringCharacters()) {
            throw limite("Texto excede o limite permitido para IA");
        }
    }

    private boolean contemDadoRestrito(String texto) {
        return texto != null && DADOS_RESTRITOS.stream().anyMatch(pattern -> pattern.matcher(texto).find());
    }

    private boolean contemExfiltracao(String texto) {
        return texto != null && EXFILTRACAO.stream().anyMatch(pattern -> pattern.matcher(texto).find());
    }

    private OrquestradorException solicitacaoBloqueada() {
        return new OrquestradorException(CodigoErroOrquestrador.NAO_AUTORIZADO,
                HttpStatus.FORBIDDEN, RESPOSTA_BLOQUEADA);
    }

    private OrquestradorException limite(String mensagem) {
        return new OrquestradorException(CodigoErroOrquestrador.LIMITE_EXCEDIDO,
                HttpStatus.PAYLOAD_TOO_LARGE, mensagem);
    }
}

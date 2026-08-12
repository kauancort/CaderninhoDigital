package com.InovaSkill.CaderninhoDigital.ai.search;

import com.InovaSkill.CaderninhoDigital.ai.contract.QualidadeResultado;
import com.InovaSkill.CaderninhoDigital.ai.cost.AnaliseComprasInsumoService;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class ComparacaoMercadoService {
    private static final Pattern PRECO = Pattern.compile("(?i)R\\$\\s*(\\d{1,6}(?:[.,]\\d{1,2})?)");
    private static final Pattern VALIDADE = Pattern.compile("(?i)v[aá]lid[oa]\\s+at[eé]\\s+(\\d{2})/(\\d{2})/(\\d{4})");
    private static final Pattern FRETE = Pattern.compile("(?i)frete\\s*(?:de|:)?\\s*R\\$\\s*(\\d{1,6}(?:[.,]\\d{1,2})?)");
    private static final Pattern MINIMO = Pattern.compile("(?i)(?:pedido|compra)\\s+m[ií]nim[oa]\\s*(?:de|:)?\\s*(\\d{1,6}(?:[.,]\\d{1,3})?)\\s*([\\p{L}]+)");
    private static final Pattern EMBALAGEM = Pattern.compile("(?i)(\\d+(?:[.,]\\d{1,3})?)\\s*(kg|g|l|ml|unidade(?:s)?)\\b");
    private final AnaliseComprasInsumoService analiseInterna;
    private final MateriaPrimaRepository materias;
    private final PesquisaPrecosGateway pesquisa;
    private final Clock clock;

    public ComparacaoMercadoService(AnaliseComprasInsumoService analiseInterna,
            MateriaPrimaRepository materias, PesquisaPrecosGateway pesquisa, Clock clock) {
        this.analiseInterna = analiseInterna; this.materias = materias; this.pesquisa = pesquisa; this.clock = clock;
    }

    public Resultado comparar(Long usuarioId, Long materiaPrimaId, LocalDate inicio, LocalDate fim,
            String unidade, BigDecimal quantidade, String cidade, String uf) {
        var materia = materias.findById(materiaPrimaId)
                .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));
        if (!materia.getUnidadeMedida().equalsIgnoreCase(unidade)) {
            throw new IllegalArgumentException("Unidade não corresponde ao cadastro da matéria-prima");
        }
        var interna = analiseInterna.analisar(usuarioId, materiaPrimaId, inicio, fim);
        BigDecimal precoInterno = interna.itens().isEmpty() ? null : interna.itens().getFirst().precoMedioPonderado();
        ResultadoPesquisaPrecos externa;
        try {
            externa = pesquisa.pesquisar(new SolicitacaoPesquisaPrecos(
                    materia.getNome(), unidade, quantidade, cidade, uf));
        } catch (OrquestradorException e) {
            return new Resultado(materiaPrimaId, unidade, quantidade, precoInterno,
                    precoInterno == null ? null : precoInterno.multiply(quantidade).setScale(2, RoundingMode.HALF_UP),
                    null, null, null, null, "INSUFICIENTE", java.time.Instant.now(clock), List.of(),
                    List.of("Pesquisa externa indisponível; a análise interna foi preservada."),
                    precoInterno == null ? QualidadeResultado.INSUFICIENTE : QualidadeResultado.PARCIAL);
        }
        List<Oferta> ofertas = new ArrayList<>(); List<String> descartes = new ArrayList<>();
        for (var fonte : externa.fontes()) {
            var oferta = extrair(fonte, unidade, quantidade);
            if (oferta == null) descartes.add(fonte.dominio() + ": preço/unidade ausente, incompatível ou promoção vencida.");
            else ofertas.add(oferta);
        }
        ofertas.sort(java.util.Comparator.comparing(Oferta::custoTotal));
        BigDecimal melhor = ofertas.stream().map(Oferta::custoTotal).findFirst().orElse(null);
        BigDecimal custoAtual = precoInterno == null ? null : precoInterno.multiply(quantidade).setScale(2, RoundingMode.HALF_UP);
        BigDecimal economia = custoAtual == null || melhor == null ? null
                : custoAtual.subtract(melhor).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal diferenca = custoAtual == null || melhor == null ? null
                : melhor.subtract(custoAtual).setScale(2,RoundingMode.HALF_UP);
        BigDecimal percentual = diferenca == null || custoAtual.signum()==0 ? null
                : diferenca.abs().divide(custoAtual,4,RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                        .setScale(2,RoundingMode.HALF_UP);
        String situacao = diferenca==null ? "INSUFICIENTE" : diferenca.signum()>0 ? "CUSTO_INTERNO_MENOR"
                : diferenca.signum()<0 ? "OFERTA_EXTERNA_MENOR" : "EQUIVALENTE";
        List<String> avisos = new ArrayList<>(externa.avisos()); avisos.addAll(descartes);
        avisos.add("Frete e pedido mínimo entram no cálculo somente quando aparecem explicitamente na fonte; valores ausentes não foram estimados.");
        QualidadeResultado qualidade = precoInterno != null && !ofertas.isEmpty()
                ? QualidadeResultado.PARCIAL : QualidadeResultado.INSUFICIENTE;
        return new Resultado(materiaPrimaId, unidade, quantidade, precoInterno, custoAtual, melhor, economia,
                diferenca, percentual, situacao,
                externa.pesquisadoEm(), List.copyOf(ofertas), List.copyOf(avisos), qualidade);
    }

    private Oferta extrair(FontePesquisaPreco fonte, String unidade, BigDecimal quantidade) {
        String texto = fonte.titulo()+" "+fonte.trecho();
        var validade = VALIDADE.matcher(texto);
        if (validade.find() && LocalDate.of(Integer.parseInt(validade.group(3)),
                Integer.parseInt(validade.group(2)), Integer.parseInt(validade.group(1)))
                .isBefore(LocalDate.now(clock))) return null;
        var preco = PRECO.matcher(texto); if (!preco.find()) return null;
        BigDecimal valorAnunciado = moeda(preco.group(1));
        BigDecimal tamanhoEmUnidade = tamanhoComparavel(texto, unidade);
        if (tamanhoEmUnidade == null || tamanhoEmUnidade.signum() <= 0) return null;
        BigDecimal unitario = valorAnunciado.divide(tamanhoEmUnidade, 4, RoundingMode.HALF_UP);
        BigDecimal quantidadeCalculada = quantidade;
        var minimo = MINIMO.matcher(texto);
        if (minimo.find()) {
            if (!minimo.group(2).equalsIgnoreCase(unidade)) return null;
            quantidadeCalculada = quantidade.max(new BigDecimal(minimo.group(1).replace(',', '.')));
        }
        BigDecimal freteValor = BigDecimal.ZERO; var frete = FRETE.matcher(texto);
        boolean freteConhecido = frete.find();
        if (freteConhecido) freteValor = new BigDecimal(frete.group(1).replace(',', '.'));
        return new Oferta(fonte.titulo(), fonte.url().toString(), fonte.dominio(), unitario,
                quantidadeCalculada, unitario.multiply(quantidadeCalculada).add(freteValor)
                        .setScale(2, RoundingMode.HALF_UP), freteConhecido);
    }

    private BigDecimal tamanhoComparavel(String texto,String unidadeAlvo){
        String normalizada=unidadeAlvo.toLowerCase(Locale.ROOT);
        if(texto.toLowerCase(Locale.ROOT).matches(".*(?:/|por\\s+)"+Pattern.quote(normalizada)+"(?:\\b|\\.).*")) return BigDecimal.ONE;
        var embalagem=EMBALAGEM.matcher(texto);
        while(embalagem.find()){
            BigDecimal quantidade=new BigDecimal(embalagem.group(1).replace(',','.'));
            String unidade=embalagem.group(2).toLowerCase(Locale.ROOT);
            if(normalizada.equals("kg")&&unidade.equals("g")) return quantidade.divide(BigDecimal.valueOf(1000));
            if(normalizada.equals("kg")&&unidade.equals("kg")) return quantidade;
            if(normalizada.equals("l")&&unidade.equals("ml")) return quantidade.divide(BigDecimal.valueOf(1000));
            if(normalizada.equals("l")&&unidade.equals("l")) return quantidade;
            if(normalizada.equals("unidade")&&unidade.startsWith("unidade")) return quantidade;
        }
        return null;
    }
    private BigDecimal moeda(String valor){
        String normalizado=valor.contains(",")?valor.replace(".","").replace(',','.'):valor;
        return new BigDecimal(normalizado).setScale(2,RoundingMode.HALF_UP);
    }

    public record Oferta(String titulo, String url, String dominio, BigDecimal precoUnitario,
            BigDecimal quantidadeCalculada, BigDecimal custoTotal, boolean freteIncluido) {}
    public record Resultado(Long materiaPrimaId, String unidade, BigDecimal quantidadeAlvo,
            BigDecimal precoInternoUnitario, BigDecimal custoInternoComparavel, BigDecimal menorCustoExterno,
            BigDecimal economiaEstimada, BigDecimal diferencaExternaMenosInterna,
            BigDecimal percentualDiferenca, String situacao,
            java.time.Instant pesquisadoEm, List<Oferta> ofertas, List<String> avisos,
            QualidadeResultado qualidade) {}
}

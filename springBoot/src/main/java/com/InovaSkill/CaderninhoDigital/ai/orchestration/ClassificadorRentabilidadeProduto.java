package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosRentabilidadeProduto;
import com.InovaSkill.CaderninhoDigital.ai.contract.ChamadaFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.enums.ModalidadeVenda;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ClassificadorRentabilidadeProduto {
    private static final Pattern INTENCAO = Pattern.compile(
            "(?s).*\\b(prejuizo|lucro|margem|rentabilidade|barat[oa]|car[oa] para vender|vale vender|"
                    + "preco de venda|da dinheiro|compensa|compensando|aumentar o preco|rentavel)\\b.*");
    private static final Pattern PRECO = Pattern.compile(
            "(?i)(?:R\\$\\s*)?([0-9]{1,4}(?:[.,][0-9]{1,2})?)(?=\\s|$|por|esta|tá|ta)");
    private final ProdutoRepository produtos;
    private final Clock clock;

    public ClassificadorRentabilidadeProduto(ProdutoRepository produtos, Clock clock) {
        this.produtos = produtos;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ChamadaFerramenta classificar(String mensagem, Long empresaId) {
        if (mensagem == null || mensagem.isBlank()) return null;
        String texto = normalizar(mensagem);
        if (!INTENCAO.matcher(texto).matches()) return null;
        List<Produto> correspondencias = produtos.listarAtivosParaEmpresa(empresaId).stream()
                .filter(p -> contemProduto(texto, normalizar(p.getNome())))
                .sorted(Comparator.comparingInt((Produto p) -> normalizar(p.getNome()).length()).reversed())
                .toList();
        if (correspondencias.isEmpty()) return null;
        Produto produto = correspondencias.getFirst();
        if (correspondencias.size() > 1
                && normalizar(correspondencias.get(1).getNome()).length() == normalizar(produto.getNome()).length())
            return null;
        LocalDate fim = LocalDate.now(clock);
        LocalDate inicio = fim.minusDays(29);
        ModalidadeVenda modalidade = modalidade(texto);
        BigDecimal preco = preco(mensagem);
        return new ChamadaFerramenta(FerramentaPermitida.ANALISAR_RENTABILIDADE_PRODUTO,
                new ArgumentosRentabilidadeProduto(produto.getId(), inicio, fim, modalidade, preco));
    }

    private boolean contemProduto(String texto, String produto) {
        if (produto.isBlank()) return false;
        return Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(produto)
                + "(?![\\p{L}\\p{N}])").matcher(texto).find();
    }

    private ModalidadeVenda modalidade(String texto) {
        if (texto.matches("(?s).*\\bcaixa(s)?\\b.*")) return ModalidadeVenda.CAIXA;
        if (texto.matches("(?s).*\\bpacote(s)?\\b.*")) return ModalidadeVenda.PACOTE;
        if (texto.matches("(?s).*\\bduzia(s)?\\b.*")) return ModalidadeVenda.DUZIA;
        if (texto.matches("(?s).*\\bpote(s)?\\b.*")) return ModalidadeVenda.POTE;
        if (texto.matches("(?s).*\\b(kg|quilo|peso)\\b.*")) return ModalidadeVenda.PESO;
        return null;
    }

    private BigDecimal preco(String original) {
        var matcher = PRECO.matcher(original);
        if (!matcher.find()) return null;
        try { return new BigDecimal(matcher.group(1).replace(',', '.')); }
        catch (NumberFormatException ignored) { return null; }
    }

    private String normalizar(String valor) {
        return Normalizer.normalize(valor == null ? "" : valor, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
    }
}

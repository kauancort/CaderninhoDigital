package com.InovaSkill.CaderninhoDigital.ai.search;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

/** Contrato fechado produzido pelo modelo; nenhum valor deste contrato é usado sem validação posterior. */
public record ExtracaoOfertasMercado(
        @NotNull @Valid @Size(max = 5) List<Fonte> fontes
) {
    public ExtracaoOfertasMercado {
        fontes = normalizar(fontes);
    }

    /** Compatibilidade com integrações antigas que forneciam uma coleção plana de ofertas. */
    public ExtracaoOfertasMercado(Collection<?> entradas) {
        this(normalizar(entradas));
    }

    public List<Oferta> ofertas() {
        return fontes.stream().flatMap(fonte -> fonte.ofertas().stream()).toList();
    }

    private static List<Fonte> normalizar(List<?> entradas) {
        if (entradas == null || entradas.isEmpty()) return List.of();
        if (entradas.stream().allMatch(Fonte.class::isInstance)) {
            return entradas.stream().map(Fonte.class::cast).toList();
        }
        if (entradas.stream().allMatch(Oferta.class::isInstance)) {
            List<Oferta> ofertas = entradas.stream().map(Oferta.class::cast).toList();
            return List.of(new Fonte("fonte-1", Status.ACEITA, null, ofertas));
        }
        throw new IllegalArgumentException("A extração deve conter fontes ou ofertas, não uma mistura dos dois");
    }

    private static List<Fonte> normalizar(Collection<?> entradas) {
        if (entradas instanceof List<?> lista) return normalizar(lista);
        return normalizar(entradas == null ? List.of() : List.copyOf(entradas));
    }

    public record Fonte(
            @NotBlank @Size(max = 40) String fonteId,
            @NotNull Status status,
            @Size(max = 240) String motivo,
            @NotNull @Valid @Size(max = 15) List<Oferta> ofertas
    ) {}

    public enum Status { ACEITA, REJEITADA, NAO_CONCLUIDA }

    public record Oferta(
            @NotBlank @Size(max = 40) String fonteId,
            @NotBlank @Size(max = 120) String produto,
            @NotNull @Positive BigDecimal precoAnunciado,
            @NotNull TipoPreco tipoPreco,
            Unidade unidadePreco,
            @Positive BigDecimal quantidadeEmbalagem,
            Unidade unidadeEmbalagem,
            @Positive BigDecimal pedidoMinimo,
            Unidade unidadePedidoMinimo,
            @Positive BigDecimal frete,
            LocalDate validade,
            @Size(max = 120) String localizacao,
            @NotBlank @Size(max = 240) String evidenciaPreco,
            @Size(max = 240) String evidenciaPedidoMinimo,
            @NotNull Confianca confianca,
            @Size(max = 120) String marca,
            @Size(max = 120) String fornecedor
    ) {
        public Oferta(String fonteId, String produto, BigDecimal precoAnunciado, TipoPreco tipoPreco,
                Unidade unidadePreco, BigDecimal quantidadeEmbalagem, Unidade unidadeEmbalagem,
                BigDecimal pedidoMinimo, Unidade unidadePedidoMinimo, BigDecimal frete, LocalDate validade,
                String localizacao, String evidenciaPreco, String evidenciaPedidoMinimo, Confianca confianca) {
            this(fonteId, produto, precoAnunciado, tipoPreco, unidadePreco, quantidadeEmbalagem,
                    unidadeEmbalagem, pedidoMinimo, unidadePedidoMinimo, frete, validade, localizacao,
                    evidenciaPreco, evidenciaPedidoMinimo, confianca, null, null);
        }
    }

    public enum TipoPreco { UNITARIO, TOTAL_EMBALAGEM }
    public enum Unidade { KG, G, L, ML, UNIDADE }
    public enum Confianca { ALTA, MEDIA, BAIXA }
}

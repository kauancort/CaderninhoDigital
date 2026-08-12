package com.InovaSkill.CaderninhoDigital.ai.search;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Contrato fechado produzido pelo modelo; nenhum valor deste contrato é usado sem validação posterior. */
public record ExtracaoOfertasMercado(
        @NotNull @Valid @Size(max = 15) List<Oferta> ofertas
) {
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
            @NotNull Confianca confianca
    ) {}

    public enum TipoPreco { UNITARIO, TOTAL_EMBALAGEM }
    public enum Unidade { KG, G, L, ML, UNIDADE }
    public enum Confianca { ALTA, MEDIA, BAIXA }
}

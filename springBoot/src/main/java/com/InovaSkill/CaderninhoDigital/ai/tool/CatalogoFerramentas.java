package com.InovaSkill.CaderninhoDigital.ai.tool;

import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public final class CatalogoFerramentas {
    private final Map<FerramentaPermitida, FerramentaLeitura<?>> ferramentas;
    private final List<MetadadosFerramenta> metadados;

    public CatalogoFerramentas(List<FerramentaLeitura<?>> ferramentasRegistradas) {
        EnumMap<FerramentaPermitida, FerramentaLeitura<?>> mapa = new EnumMap<>(FerramentaPermitida.class);
        for (FerramentaLeitura<?> ferramenta : List.copyOf(ferramentasRegistradas)) {
            validarDeclaracao(ferramenta);
            if (mapa.putIfAbsent(ferramenta.identificador(), ferramenta) != null) {
                throw new IllegalStateException("Identificador de ferramenta duplicado");
            }
        }
        this.ferramentas = Collections.unmodifiableMap(mapa);
        this.metadados = mapa.values().stream()
                .map(item -> new MetadadosFerramenta(
                        item.identificador(), item.descricao(), item.tipoArgumentos()))
                .toList();
    }

    public FerramentaLeitura<?> localizar(FerramentaPermitida identificador) {
        return identificador == null ? null : ferramentas.get(identificador);
    }

    public List<MetadadosFerramenta> metadadosParaPlanejamento() {
        return metadados;
    }

    private void validarDeclaracao(FerramentaLeitura<?> ferramenta) {
        if (ferramenta == null
                || ferramenta.identificador() == null
                || ferramenta.descricao() == null
                || ferramenta.descricao().isBlank()
                || ferramenta.tipoArgumentos() == null
                || ferramenta.classeArgumentos() == null
                || ferramenta.permissaoNecessaria() == null
                || ferramenta.timeout() == null
                || ferramenta.timeout().isZero()
                || ferramenta.timeout().isNegative()
                || !ferramenta.somenteLeitura()) {
            throw new IllegalStateException("Declaração de ferramenta inválida ou não somente leitura");
        }
    }
}

package com.InovaSkill.CaderninhoDigital.ai.stock;

import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;

@Service
public class ConsultaEstoqueCriticoService {
    public static final String CRITERIO = "estoqueAtual <= estoqueMinimo";
    private final MateriaPrimaRepository repository;
    private final PoliticaDadosIa politica;
    private final Clock clock;
    private final AiOrchestratorProperties properties;

    public ConsultaEstoqueCriticoService(MateriaPrimaRepository repository, PoliticaDadosIa politica, Clock clock,
            AiOrchestratorProperties properties) {
        this.repository = repository;
        this.politica = politica;
        this.clock = clock;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public Resultado consultar() {
        var linhas = repository.listarDadosEstoqueAtivos(PageRequest.of(0, properties.getLimits().getContextItems()));
        var criticos = new ArrayList<Item>();
        int insuficientes = 0;
        for (var linha : linhas) {
            if (linha.getEstoqueAtual() == null || linha.getEstoqueMinimo() == null
                    || linha.getUnidadeMedida() == null || linha.getUnidadeMedida().isBlank()
                    || !politica.rotuloOperacionalPermitido(linha.getNome())) {
                insuficientes++;
                continue;
            }
            if (linha.getEstoqueAtual().compareTo(linha.getEstoqueMinimo()) <= 0) {
                criticos.add(new Item(linha.getNome(), linha.getUnidadeMedida(),
                        linha.getEstoqueAtual(), linha.getEstoqueMinimo()));
            }
        }
        List<String> avisos = insuficientes == 0 ? List.of()
                : List.of(insuficientes + " item(ns) omitido(s) por dados insuficientes ou não permitidos");
        return new Resultado(CRITERIO, linhas.size(), criticos.size(), List.copyOf(criticos),
                insuficientes, Instant.now(clock), avisos);
    }

    public record Item(String nome, String unidade, java.math.BigDecimal quantidadeAtual,
                       java.math.BigDecimal estoqueMinimo) {}
    public record Resultado(String criterio, int itensAvaliados, int itensCriticos, List<Item> itens,
                            int dadosInsuficientes, Instant atualizadoEm, List<String> avisos) {}
}

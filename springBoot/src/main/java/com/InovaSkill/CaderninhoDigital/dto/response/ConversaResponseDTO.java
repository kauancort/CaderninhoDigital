package com.InovaSkill.CaderninhoDigital.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.time.Instant;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConversaResponseDTO {
    private String resposta;
    private String versaoContrato;
    private String status;
    private DadosAssistenteDTO dados;
    private List<AcaoSugeridaDTO> acoesSugeridas;
    private String origem;
    private List<String> avisos;
    private String qualidade;
    private String correlacao;
    private LocalDate periodoInicio;
    private LocalDate periodoFim;
    private Instant atualizadoEm;

    public ConversaResponseDTO(String resposta) {
        this.resposta = resposta;
        this.versaoContrato = "1.1";
        this.status = "SUCESSO";
        this.dados = null;
        this.acoesSugeridas = List.of();
        this.origem = "ASSISTENTE";
        this.avisos = List.of();
        this.qualidade = "COMPLETO";
        this.periodoInicio = null;
        this.periodoFim = null;
        this.atualizadoEm = null;
    }
}

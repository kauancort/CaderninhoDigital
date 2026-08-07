package com.InovaSkill.CaderninhoDigital.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConversaResponseDTO {
    private String resposta;
    private String versaoContrato;
    private String status;
    private Map<String, Object> dados;
    private List<AcaoSugeridaDTO> acoesSugeridas;
    private String origem;
    private List<String> avisos;
    private String qualidade;
    private String correlacao;

    public ConversaResponseDTO(String resposta) {
        this.resposta = resposta;
        this.versaoContrato = "1.0";
        this.status = "SUCESSO";
        this.dados = Map.of();
        this.acoesSugeridas = List.of();
        this.origem = "ASSISTENTE";
        this.avisos = List.of();
        this.qualidade = "COMPLETO";
    }
}

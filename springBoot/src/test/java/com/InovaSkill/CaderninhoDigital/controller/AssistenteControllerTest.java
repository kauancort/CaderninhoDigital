package com.InovaSkill.CaderninhoDigital.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.InterpretarVozRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ConversaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VozResultadoResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.OpenRouterService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Collections;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
@AutoConfigureMockMvc
class AssistenteControllerTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private OpenRouterService openRouterService;

    @Test
    @WithMockUser(username = "adm@gmail.com", roles = {"GESTOR"})
    void interpretarVozComSucesso() throws Exception {
        InterpretarVozRequestDTO request = new InterpretarVozRequestDTO();
        request.setTexto("Vendi duas caixas");
        request.setProdutos(Collections.emptyList());
        request.setMateriasPrimas(Collections.emptyList());

        VozResultadoResponseDTO response = new VozResultadoResponseDTO();
        response.setTranscricao("Vendi duas caixas");
        response.setTipo("venda");

        when(openRouterService.interpretarVoz(any(InterpretarVozRequestDTO.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/assistente/interpretar-voz")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transcricao").value("Vendi duas caixas"))
                .andExpect(jsonPath("$.tipo").value("venda"));
    }

    @Test
    @WithMockUser(username = "adm@gmail.com", roles = {"GESTOR"})
    void conversaComSucesso() throws Exception {
        ConversaRequestDTO request = new ConversaRequestDTO();
        request.setMensagem("Olá Vovó");
        request.setHistorico(Collections.emptyList());

        ConversaResponseDTO response = new ConversaResponseDTO("Olá querido!");

        when(openRouterService.conversar(any(), any(ConversaRequestDTO.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/assistente/conversa")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resposta").value("Olá querido!"));
    }

    @Test
    void requisicaoSemAutenticacaoDeveRetornar401() throws Exception {
        ConversaRequestDTO request = new ConversaRequestDTO();
        request.setMensagem("Olá");

        mockMvc.perform(post("/api/v1/assistente/conversa")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }
}

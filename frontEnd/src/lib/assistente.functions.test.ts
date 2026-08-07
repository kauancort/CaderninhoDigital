import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("./api-client", () => ({ apiRequest }));

import { conversarComAssistente } from "./assistente.functions";

describe("contrato do chat da assistente", () => {
  beforeEach(() => apiRequest.mockReset());

  it("envia a conversa somente para o backend autenticado", async () => {
    apiRequest.mockResolvedValue({
      resposta: "Resposta segura",
      versaoContrato: "1.0",
      status: "SUCESSO",
      dados: {},
      acoesSugeridas: [],
      origem: "ASSISTENTE",
      avisos: [],
      qualidade: "COMPLETO",
      correlacao: null,
    });

    const resposta = await conversarComAssistente({
      mensagem: "Como estão as vendas?",
      historico: [{ autor: "assistente", texto: "Como posso ajudar?" }],
    });

    expect(resposta.resposta).toBe("Resposta segura");
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenCalledWith("/assistente/conversa", {
      method: "POST",
      body: JSON.stringify({
        mensagem: "Como estão as vendas?",
        historico: [{ autor: "assistente", texto: "Como posso ajudar?" }],
        versaoContrato: "1.0",
      }),
    });
  });

  it("rejeita campos extras antes da chamada HTTP", async () => {
    const entrada = {
      mensagem: "Resumo",
      historico: [],
      sql: "select *",
    } as unknown as Parameters<typeof conversarComAssistente>[0];

    await expect(conversarComAssistente(entrada)).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});

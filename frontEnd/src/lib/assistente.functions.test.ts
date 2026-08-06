import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("./api-client", () => ({ apiRequest }));

import { conversarComAssistente } from "./assistente.functions";

describe("contrato do chat da assistente", () => {
  beforeEach(() => apiRequest.mockReset());

  it("envia a conversa somente para o backend autenticado", async () => {
    apiRequest.mockResolvedValue({ resposta: "Resposta segura" });

    const resposta = await conversarComAssistente({
      mensagem: "Como estão as vendas?",
      historico: [{ autor: "assistente", texto: "Como posso ajudar?" }],
    });

    expect(resposta).toEqual({ resposta: "Resposta segura" });
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenCalledWith("/assistente/conversa", {
      method: "POST",
      body: JSON.stringify({
        mensagem: "Como estão as vendas?",
        historico: [{ autor: "assistente", texto: "Como posso ajudar?" }],
      }),
    });
  });
});

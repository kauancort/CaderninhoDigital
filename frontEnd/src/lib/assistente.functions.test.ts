import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("./api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api-client")>()),
  apiRequest,
}));

import { conversarComAssistente } from "./assistente.functions";
import { mensagemErroAssistente } from "./assistente.functions";
import { mensagemProgressoAssistente } from "./assistente.functions";
import { ApiError } from "./api-client";

describe("contrato do chat da assistente", () => {
  beforeEach(() => apiRequest.mockReset());

  it("informa que uma consulta demorada continua em andamento", () => {
    expect(mensagemProgressoAssistente(0)).toContain("Analisando");
    expect(mensagemProgressoAssistente(16)).toContain("Ainda estou trabalhando");
    expect(mensagemProgressoAssistente(31)).toContain("continua em andamento");
  });

  it("envia a conversa somente para o backend autenticado", async () => {
    apiRequest.mockResolvedValue({
      resposta: "Resposta segura",
      versaoContrato: "1.1",
      status: "SUCESSO",
      dados: null,
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
    expect(apiRequest).toHaveBeenCalledWith("/assistente/conversa", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        mensagem: "Como estão as vendas?",
        historico: [{ autor: "assistente", texto: "Como posso ajudar?" }],
        versaoContrato: "1.1",
      }),
      signal: expect.any(AbortSignal),
    }));
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

  it("aceita a ação rápida agregada de gastos", async () => {
    apiRequest.mockResolvedValue({
      resposta: "Resumo",
      versaoContrato: "1.1",
      status: "SUCESSO",
      dados: { tipo: "GASTOS", totalGastos: 0, quantidadeLancamentos: 0 },
      acoesSugeridas: [],
      origem: "CAMINHO_RAPIDO",
      avisos: [],
      qualidade: "PARCIAL",
      correlacao: "corr",
    });
    await conversarComAssistente({ acaoRapida: "RESUMIR_GASTOS", historico: [] });
    expect(apiRequest).toHaveBeenCalledOnce();
  });

  it("preserva período, atualização e avisos do contrato", async () => {
    apiRequest.mockResolvedValue({
      resposta: "Resumo",
      versaoContrato: "1.1",
      status: "SUCESSO",
      dados: { tipo: "VENDAS", valorTotalValido: 10, quantidadeVendas: 1, ticketMedio: 10, quantidadeItens: 1 },
      acoesSugeridas: [],
      origem: "CAMINHO_RAPIDO",
      avisos: ["Dados parciais"],
      qualidade: "PARCIAL",
      correlacao: "corr",
      periodoInicio: "2026-08-01",
      periodoFim: "2026-08-07",
      atualizadoEm: "2026-08-07T12:00:00Z",
    });
    const resposta = await conversarComAssistente({ acaoRapida: "RESUMIR_VENDAS", historico: [] });
    expect(resposta.periodoInicio).toBe("2026-08-01");
    expect(resposta.avisos).toEqual(["Dados parciais"]);
  });

  it("aceita comparação financeira tipada", async () => {
    apiRequest.mockResolvedValue({
      resposta: "Comparação concluída",
      versaoContrato: "1.1",
      status: "SUCESSO",
      dados: {
        tipo: "COMPARACAO_VENDAS_GASTOS",
        vendas: { tipo: "VENDAS", valorTotalValido: 18000, quantidadeVendas: 20, ticketMedio: 900, quantidadeItens: 100 },
        gastos: { tipo: "GASTOS", totalGastos: 11000, quantidadeLancamentos: 8 },
        comparacao: { vendas: 18000, gastos: 11000, diferenca: 7000, percentualVendasSobreGastos: 163.64 },
      },
      acoesSugeridas: [], origem: "ORQUESTRADOR", avisos: [], qualidade: "COMPLETO", correlacao: "corr",
    });
    const resposta = await conversarComAssistente({ mensagem: "Compare vendas e gastos", historico: [] });
    expect(resposta.dados?.tipo).toBe("COMPARACAO_VENDAS_GASTOS");
  });

  it("rejeita campo desconhecido na resposta do backend", async () => {
    apiRequest.mockResolvedValue({
      resposta: "Resumo", versaoContrato: "1.1", status: "SUCESSO",
      dados: { tipo: "GASTOS", totalGastos: 10, quantidadeLancamentos: 1, sql: "não permitido" },
      acoesSugeridas: [], origem: "CAMINHO_RAPIDO", avisos: [], qualidade: "COMPLETO", correlacao: null,
    });
    await expect(conversarComAssistente({ acaoRapida: "RESUMIR_GASTOS", historico: [] })).rejects.toThrow();
  });

  it("traduz erros técnicos para orientações simples", () => {
    expect(
      mensagemErroAssistente(new ApiError("segredo técnico", 403, "NAO_AUTORIZADO")),
    ).toContain("permissão");
    expect(
      mensagemErroAssistente(new ApiError("segredo técnico", 429, "LIMITE_EXCEDIDO")),
    ).toContain("limite");
    expect(mensagemErroAssistente(new ApiError("segredo técnico", 504, "TIMEOUT"))).toContain(
      "demorou",
    );
    expect(
      mensagemErroAssistente(new ApiError("segredo técnico", 502, "PLANO_INVALIDO")),
    ).toBe("Esta consulta ainda não está disponível.");
    expect(
      mensagemErroAssistente(new ApiError("segredo técnico", 503, "PROVEDOR_INDISPONIVEL")),
    ).toContain("indisponível");
  });
});

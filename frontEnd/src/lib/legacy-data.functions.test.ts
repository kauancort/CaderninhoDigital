import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("./api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api-client")>()),
  apiRequest,
}));

import {
  importarContatosDadosLegados,
  importarCatalogoDadosLegados,
  simularImportacaoDadosLegados,
  tratarCatalogoDadosLegados,
  verificarContatosDadosLegados,
  validarHistoricosDadosLegados,
  validarDecisoesCatalogoDadosLegados,
} from "./legacy-data.functions";

describe("contrato do tratamento de dados legados", () => {
  beforeEach(() => apiRequest.mockReset());

  it("envia os arquivos para o preview normalizado e valida a resposta", async () => {
    apiRequest.mockResolvedValue({
      arquivoPrincipal: "produtos.xls",
      arquivosAnalisados: 32,
      registrosAnalisados: 29514,
      classificacoes: { PRODUTO_FINAL: 1, MATERIA_PRIMA: 1, REVISAR: 1 },
      itensProntos: 2,
      itensParaRevisao: 1,
      itens: [
        {
          arquivo: "produtos.xls",
          linha: 4,
          codigoLegado: "3",
          nome: "Item comprado",
          classificacaoSugerida: "REVISAR",
          contextos: ["COMPRA"],
          motivos: ["Aparece apenas em compras; pode ser matéria-prima ou gasto operacional."],
          alertas: [],
          unidade: "un",
          precoCusto: 4,
          precoVenda: 5,
          estoque: 3,
          estoqueMinimo: 0,
          ativo: true,
          status: "PENDENTE_REVISAO",
        },
      ],
    });

    const resposta = await tratarCatalogoDadosLegados([
      new File(["dados"], "produtos.xls", { type: "application/vnd.ms-excel" }),
    ]);

    expect(resposta.itensParaRevisao).toBe(1);
    expect(apiRequest).toHaveBeenCalledOnce();
    const [, init] = apiRequest.mock.calls[0];
    expect(init).toMatchObject({ method: "POST" });
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("arquivos")).toBeInstanceOf(File);
  });

  it("valida o relatório da simulação e preserva os bloqueios", async () => {
    apiRequest.mockResolvedValue({
      arquivoPrincipal: "produtos.xls",
      arquivosAnalisados: 32,
      registrosAnalisados: 29514,
      prontoParaImportacao: false,
      itensProntos: 41,
      itensPendentes: 130,
      rejeicoes: [
        {
          arquivo: "produtos.xls",
          linha: 4,
          codigoLegado: "3",
          nome: "Item comprado",
          tipo: "CLASSIFICACAO_AMBIGUA",
          mensagem: "A classificação precisa ser confirmada antes da importação.",
          bloqueante: true,
        },
      ],
      bloqueios: ["Existem itens com classificação ambígua."],
    });

    const resposta = await simularImportacaoDadosLegados([
      new File(["dados"], "produtos.xls", { type: "application/vnd.ms-excel" }),
    ]);

    expect(resposta.prontoParaImportacao).toBe(false);
    expect(resposta.itensPendentes).toBe(130);
    expect(resposta.rejeicoes[0]?.bloqueante).toBe(true);
    expect(apiRequest).toHaveBeenCalledWith(
      "/configuracoes/dados-legados/simulacao",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("envia decisões manuais como parte JSON do multipart", async () => {
    apiRequest.mockResolvedValue({
      arquivoPrincipal: "produtos.xls",
      arquivosAnalisados: 32,
      registrosAnalisados: 29514,
      prontoParaImportacao: true,
      itensAprovados: 171,
      itensNaoImportados: 0,
      itensPendentes: 0,
      decisoesAplicadas: [
        {
          arquivo: "produtos.xls",
          linha: 4,
          codigoLegado: "3",
          classificacaoFinal: "GASTO_OPERACIONAL",
          observacao: "Compra sem uso em receita",
        },
      ],
      rejeicoes: [],
      bloqueios: [],
    });

    const resposta = await validarDecisoesCatalogoDadosLegados(
      [new File(["dados"], "produtos.xls")],
      [
        {
          arquivo: "produtos.xls",
          linha: 4,
          codigoLegado: "3",
          classificacaoFinal: "GASTO_OPERACIONAL",
          observacao: "Compra sem uso em receita",
        },
      ],
    );

    expect(resposta.prontoParaImportacao).toBe(true);
    const [, init] = apiRequest.mock.calls[0];
    expect((init.body as FormData).get("decisoes")).toBeInstanceOf(Blob);
  });

  it("valida o retorno da importação idempotente do catálogo", async () => {
    apiRequest.mockResolvedValue({
      importacaoId: 40,
      status: "CONCLUIDA",
      arquivoPrincipal: "produtos.xls",
      arquivosAnalisados: 32,
      registrosAnalisados: 29514,
      produtosImportados: 12,
      materiasPrimasImportadas: 29,
      jaProcessados: 0,
      naoImportados: 130,
      aguardandoHistorico: 0,
      rejeicoes: [],
    });

    const resposta = await importarCatalogoDadosLegados([new File(["dados"], "produtos.xls")], []);

    expect(resposta.status).toBe("CONCLUIDA");
    expect(resposta.produtosImportados).toBe(12);
    expect(apiRequest).toHaveBeenCalledWith(
      "/configuracoes/dados-legados/importacao-catalogo",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("valida a prévia histórica e preserva a pendência financeira", async () => {
    apiRequest.mockResolvedValue({
      arquivoPrincipal: "produtos.xls",
      arquivosAnalisados: 32,
      registrosAnalisados: 29514,
      registrosPorDominio: { COMPRAS: 2, VENDAS: 3, FINANCEIRO: 10 },
      registrosProntos: 5,
      registrosBloqueados: 10,
      pendencias: [
        {
          arquivo: "financeiro.xls",
          linha: 3,
          codigoLegado: "2",
          dominio: "FINANCEIRO",
          tipo: "DECISAO_FINANCEIRA_NECESSARIA",
          mensagem: "A natureza do lançamento precisa ser confirmada.",
          bloqueante: true,
        },
      ],
    });

    const resposta = await validarHistoricosDadosLegados([
      new File(["dados"], "produtos.xls"),
      new File(["dados"], "financeiro.xls"),
    ]);

    expect(resposta.registrosBloqueados).toBe(10);
    expect(resposta.pendencias[0]?.dominio).toBe("FINANCEIRO");
    expect(apiRequest).toHaveBeenCalledWith(
      "/configuracoes/dados-legados/historicos-preview",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("valida o retorno da importação idempotente de contatos", async () => {
    apiRequest.mockResolvedValue({
      importacaoId: 51,
      status: "CONCLUIDA",
      arquivoPrincipal: "contatos.xls",
      arquivosAnalisados: 3,
      registrosAnalisados: 700,
      clientesImportados: 301,
      fornecedoresImportados: 377,
      jaProcessados: 0,
      pendentes: 32,
      rejeicoes: [],
    });

    const resposta = await importarContatosDadosLegados([new File(["dados"], "contatos.xls")]);

    expect(resposta.clientesImportados).toBe(301);
    expect(resposta.fornecedoresImportados).toBe(377);
    expect(apiRequest).toHaveBeenCalledWith(
      "/configuracoes/dados-legados/importacao-contatos",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("valida a prévia de contatos sem importar", async () => {
    apiRequest.mockResolvedValue({
      arquivoPrincipal: "contatos.xls",
      arquivosAnalisados: 3,
      registrosAnalisados: 710,
      clientesIdentificados: 303,
      fornecedoresIdentificados: 401,
      pendentes: 6,
      pendencias: [],
    });

    const resposta = await verificarContatosDadosLegados([
      new File(["dados"], "contatos.xls"),
      new File(["dados"], "vendas.xls"),
      new File(["dados"], "compras.xls"),
    ]);

    expect(resposta.clientesIdentificados).toBe(303);
    expect(resposta.pendentes).toBe(6);
    expect(apiRequest).toHaveBeenCalledWith(
      "/configuracoes/dados-legados/contatos-preview",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";

export type SituacaoDespachoApi =
  | "NAO_APLICAVEL"
  | "AGUARDANDO_DESPACHO"
  | "DESPACHADO"
  | "ENTREGUE";

export type FormaEnvioApi = "RETIRADA" | "PROPRIO" | "TRANSPORTADORA";

export type VendaTransporte = {
  id: number;
  clienteId: number | null;
  clienteNome: string;
  dataVenda: string;
  valorTotal: number;
  situacaoDespacho: SituacaoDespachoApi;
  formaEnvio: FormaEnvioApi | null;
  codigoRastreamento: string | null;
  aguardandoEstoque: boolean;
};

export const listarVendas = createApiFn({ method: "GET" }).handler(async () => {
  const res = await fetch(`${BASE_URL}/vendas`, {});
  if (!res.ok) throw new Error("Erro ao listar vendas");

  const data = await res.json();

  return data.map((v: any) => ({
    id: String(v.id),
    cliente_id: v.clienteId ? String(v.clienteId) : null,
    comprador: v.clienteNome || v.observacao || "Cliente Avulso",
    forma_pagamento: v.formaPagamento ? v.formaPagamento.toLowerCase() : "pix",
    status_pagamento: v.statusPagamento ?? "NAO_SE_APLICA",
    valor_total: v.valorTotal || 0,
    data_venda: v.dataVenda,
    data_vencimento: v.dataVencimento || null,
    tipo_cartao: v.tipoCartao || null,
    parcelas: v.parcelas || null,
    em_atraso: Boolean(v.emAtraso),
    aguardando_estoque: Boolean(v.aguardandoEstoque),
    situacao_despacho: v.situacaoDespacho ?? "NAO_APLICAVEL",
    forma_envio: v.formaEnvio ?? null,
    codigo_rastreamento: v.codigoRastreamento ?? null,
    contatos: (v.contatos || []).map((c: any) => ({
      data: c.data,
      tipo: c.tipo,
      resposta: c.resposta || "",
    })),
    itens_venda: (v.itens || []).map((i: any) => ({
      id: String(i.id),
      produto_final_id: String(i.produtoId),
      quantidade: i.quantidade,
      preco_unitario: i.valorUnitario,
      modalidade_venda: i.modalidadeVenda ?? "UNIDADE",
      quantidade_modalidade: i.quantidadeModalidade ?? i.quantidade,
      unidades_por_modalidade: i.unidadesPorModalidade ?? 1,
      produtos_finais: {
        nome: i.produtoNome || "Produto",
      },
    })),
  }));
});

export const listarVendasAguardandoEstoque = createApiFn({ method: "GET" }).handler(async () => {
  const res = await fetch(`${BASE_URL}/vendas/aguardando-estoque`, {});
  if (!res.ok) throw new Error("Erro ao listar vendas aguardando estoque");

  const data = await res.json();

  return data.map((v: any) => ({
    id: String(v.id),
    comprador: v.clienteNome || "Cliente Avulso",
    status_pagamento: v.statusPagamento,
    valor_total: v.valorTotal || 0,
    data_venda: v.dataVenda,
    itens_venda: (v.itens || []).map((i: any) => ({
      produto_final_id: String(i.produtoId),
      quantidade: i.quantidade,
      preco_unitario: i.valorUnitario,
      nome: i.produtoNome || "Produto",
    })),
  }));
});

export const prepararDuplicacaoVenda = createApiFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE_URL}/vendas/${data.id}/duplicacao`, {});
    if (!res.ok) throw new Error("Erro ao preparar duplicação da venda");
    return res.json();
  });

export const registrarVenda = createApiFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        comprador: z.string().max(120),
        cliente_id: z.union([z.string().min(1), z.number().positive()]),
        data_venda: z.string().date(),
        forma_pagamento: z
          .enum(["dinheiro", "pix", "cartao", "boleto", "cheque", "outro"])
          .nullable(),
        status_pagamento: z.enum(["PAGO", "PENDENTE", "ATRASADO", "NAO_SE_APLICA"]),
        data_vencimento: z.string().date().optional().nullable(),
        tipo_cartao: z.enum(["CREDITO", "DEBITO"]).optional().nullable(),
        parcelas: z.number().int().positive().optional().nullable(),
        observacao: z.string().max(1000).optional().nullable(),
        forma_envio: z.enum(["RETIRADA", "PROPRIO", "TRANSPORTADORA"]).optional().default("RETIRADA"),
        custo_envio: z.number().min(0).optional().nullable(),
        responsavel_entrega: z.string().max(160).optional().nullable(),
        data_envio: z.string().date().optional().nullable(),
        previsao_entrega: z.string().date().optional().nullable(),
        codigo_rastreamento: z.string().max(160).optional().nullable(),
        transportadora: z.record(z.string(), z.any()).optional().nullable(),
        itens: z
          .array(
            z.object({
              produto_final_id: z.union([z.string(), z.number()]).nullable(),
              nome_avulso: z.string().max(120).optional().nullable(),
              quantidade: z.number().positive(),
              preco_unitario: z.number().min(0),
              modalidade_venda: z
                .enum(["UNIDADE", "CAIXA", "PACOTE", "DUZIA", "PESO", "POTE"])
                .optional(),
              quantidade_modalidade: z.number().positive().optional(),
              unidades_por_modalidade: z.number().positive().optional(),
            }),
          )
          .min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const payload = {
      clienteId: Number(data.cliente_id),
      dataVenda: data.data_venda,
      formaPagamento: data.forma_pagamento?.toUpperCase() ?? null,
      statusPagamento: data.status_pagamento,
      observacao: data.observacao || null,
      formaEnvio: data.forma_envio ?? "RETIRADA",
      custoEnvio: data.custo_envio ?? null,
      responsavelEntrega: data.responsavel_entrega ?? null,
      dataEnvio: data.data_envio ?? null,
      previsaoEntrega: data.previsao_entrega ?? null,
      codigoRastreamento: data.codigo_rastreamento ?? null,
      transportadora: data.transportadora ?? null,
      dataVencimento: data.status_pagamento === "PENDENTE" ? data.data_vencimento : null,
      tipoCartao: data.forma_pagamento === "cartao" ? data.tipo_cartao : null,
      parcelas: data.tipo_cartao === "CREDITO" ? data.parcelas : null,
      itens: data.itens.map((it: any) => ({
        produtoId: it.produto_final_id ? Number(it.produto_final_id) : null,
        nomeAvulso: it.nome_avulso || null,
        quantidade: it.quantidade,
        valorUnitario: it.preco_unitario,
        modalidadeVenda: it.modalidade_venda ?? "UNIDADE",
        quantidadeModalidade: it.quantidade_modalidade ?? it.quantidade,
        unidadesPorModalidade: it.unidades_por_modalidade ?? 1,
      })),
    };

    const res = await fetch(`${BASE_URL}/vendas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao registrar venda" }));
      throw new Error(err.message || "Erro ao registrar venda");
    }

    const resData = await res.json();
    return {
      id: String(resData.id),
      comprador: resData.clienteNome || data.comprador || "Cliente Avulso",
      forma_pagamento: data.forma_pagamento,
      status_pagamento: data.status_pagamento,
      valor_total: resData.valorTotal,
    };
  });

export const adicionarContatoVenda = createApiFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        venda_id: z.union([z.string(), z.number()]),
        tipo: z.string().min(1).max(60),
        resposta: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE_URL}/vendas/${data.venda_id}/contatos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipo: data.tipo,
        resposta: data.resposta || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao registrar contato" }));
      throw new Error(err.message || "Erro ao registrar contato");
    }
    const resData = await res.json();
    return {
      contatos: (resData.contatos || []).map((c: any) => ({
        data: c.data,
        tipo: c.tipo,
        resposta: c.resposta || "",
      })),
    };
  });


export async function listarVendasParaTransporte() {
  const res = await fetch(`${BASE_URL}/vendas/transporte`, {});
  if (!res.ok) throw new Error("Erro ao listar vendas para transporte");
  const data = await res.json();
  return data.map((v: any): VendaTransporte => ({
    id: Number(v.id),
    clienteId: v.clienteId == null ? null : Number(v.clienteId),
    clienteNome: v.clienteNome || "Cliente",
    dataVenda: v.dataVenda,
    valorTotal: Number(v.valorTotal || 0),
    situacaoDespacho: v.situacaoDespacho ?? "AGUARDANDO_DESPACHO",
    formaEnvio: v.formaEnvio ?? null,
    codigoRastreamento: v.codigoRastreamento || null,
    aguardandoEstoque: Boolean(v.aguardandoEstoque),
  }));
}

export async function atualizarDespachoVenda(
  vendaId: number,
  situacaoDespacho: SituacaoDespachoApi,
  codigoRastreamento?: string | null,
) {
  const res = await fetch(`${BASE_URL}/vendas/${vendaId}/despacho`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      situacaoDespacho,
      codigoRastreamento: codigoRastreamento?.trim() || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erro ao atualizar despacho" }));
    throw new Error(err.message || "Não foi possível atualizar o despacho.");
  }
  return res.json();
}

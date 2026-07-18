import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";

function mapVenda(v: any) {
  return {
    id: String(v.id),
    comprador: v.clienteNome || "Cliente não informado",
    cliente_id: v.clienteId ? String(v.clienteId) : null,
    forma_pagamento: v.formaPagamento ? v.formaPagamento.toLowerCase() : "pix",
    status_pagamento: v.statusPagamento ?? "NAO_SE_APLICA",
    valor_total: v.valorTotal || 0,
    data_venda: v.dataVenda,
    data_vencimento: v.dataVencimento || null,
    tipo_cartao: v.tipoCartao || null,
    parcelas: v.parcelas || null,
    em_atraso: Boolean(v.emAtraso),
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
      produtos_finais: { nome: i.produtoNome || "Produto" },
    })),
  };
}

export const listarVendas = createApiFn({ method: "GET" }).handler(async ({ context }) => {
  const res = await fetch(`${BASE_URL}/vendas`, {
    headers: { "X-Usuario-Id": String(context.userId) },
  });

  if (!res.ok) throw new Error("Erro ao listar vendas");

  const data = await res.json();

  return data.map(mapVenda);
});

export const listarVendasPaginado = createApiFn({ method: "GET" })
  .inputValidator((d) => z.object({
    pagina: z.number().int().min(0).default(0),
    tamanho: z.number().int().min(1).max(100).default(20),
    inicio: z.string().date().optional(),
    fim: z.string().date().optional(),
    status: z.enum(["PAGO", "PENDENTE", "ATRASADO", "NAO_SE_APLICA"]).optional(),
    clienteId: z.union([z.string(), z.number()]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const params = new URLSearchParams({ pagina: String(data.pagina), tamanho: String(data.tamanho) });
    if (data.inicio) params.set("inicio", data.inicio);
    if (data.fim) params.set("fim", data.fim);
    if (data.status) params.set("status", data.status);
    if (data.clienteId) params.set("clienteId", String(data.clienteId));
    const res = await fetch(`${BASE_URL}/vendas/pagina?${params}`, {
      headers: { "X-Usuario-Id": String(context.userId) },
    });
    if (!res.ok) throw new Error("Erro ao listar vendas");
    const pagina = await res.json();
    return { ...pagina, registros: pagina.registros.map(mapVenda) };
  });

export const prepararDuplicacaoVenda = createApiFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data, context }) => {
    const res = await fetch(`${BASE_URL}/vendas/${data.id}/duplicacao`, { headers: { "X-Usuario-Id": String(context.userId) } });
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
        forma_pagamento: z.enum(["dinheiro", "pix", "cartao", "boleto", "outro"]).nullable(),
        status_pagamento: z.enum(["PAGO", "PENDENTE", "ATRASADO", "NAO_SE_APLICA"]),
        data_vencimento: z.string().date().optional().nullable(),
        tipo_cartao: z.enum(["CREDITO", "DEBITO"]).optional().nullable(),
        parcelas: z.number().int().positive().optional().nullable(),
        observacao: z.string().max(1000).optional().nullable(),
        itens: z
          .array(
            z.object({
              produto_final_id: z.union([z.string(), z.number()]),
              quantidade: z.number().positive(),
              preco_unitario: z.number().min(0),
            }),
          )
          .min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      clienteId: Number(data.cliente_id),
      dataVenda: data.data_venda,
      formaPagamento: data.forma_pagamento?.toUpperCase() ?? null,
      statusPagamento: data.status_pagamento,
      observacao: data.observacao || null,
      dataVencimento: data.status_pagamento === "PENDENTE" ? data.data_vencimento : null,
      tipoCartao: data.forma_pagamento === "cartao" ? data.tipo_cartao : null,
      parcelas: data.tipo_cartao === "CREDITO" ? data.parcelas : null,
      itens: data.itens.map((it: any) => ({
        produtoId: Number(it.produto_final_id),
        quantidade: it.quantidade,
        valorUnitario: it.preco_unitario,
      })),
    };

    const res = await fetch(`${BASE_URL}/vendas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": String(context.userId),
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
  .handler(async ({ data, context }) => {
    const res = await fetch(`${BASE_URL}/vendas/${data.venda_id}/contatos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": String(context.userId),
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

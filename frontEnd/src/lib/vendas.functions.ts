import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";

export const listarVendas = createApiFn({ method: "GET" }).handler(async ({ context }) => {
  const res = await fetch(`${BASE_URL}/vendas`, {
    headers: { "X-Usuario-Id": String(context.userId) },
  });

  if (!res.ok) throw new Error("Erro ao listar vendas");

  const data = await res.json();

  return data.map((v: any) => ({
    id: String(v.id),
    comprador: v.clienteNome || v.observacao || "Cliente Avulso",
    forma_pagamento: v.formaPagamento ? v.formaPagamento.toLowerCase() : "pix",
    status_pagamento: v.statusPagamento ?? "NAO_SE_APLICA",
    valor_total: v.valorTotal || 0,
    data_venda: v.dataVenda,
    itens_venda: (v.itens || []).map((i: any) => ({
      id: String(i.id),
      produto_final_id: String(i.produtoId),
      quantidade: i.quantidade,
      preco_unitario: i.valorUnitario,
      produtos_finais: {
        nome: i.produtoNome || "Produto",
      },
    })),
  }));
});

export const registrarVenda = createApiFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        comprador: z.string().max(120).optional().nullable(),
        data_venda: z.string().date(),
        forma_pagamento: z.enum(["dinheiro", "pix", "cartao", "boleto", "outro"]).nullable(),
        status_pagamento: z.enum(["PAGO", "PENDENTE", "ATRASADO", "NAO_SE_APLICA"]),
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
    let clienteId: number | null = null;

    if (data.comprador && data.comprador.trim().length > 0) {
      const compradorNome = data.comprador.trim();
      // Fetch clients to match comprador by name
      const clientsRes = await fetch(`${BASE_URL}/clientes`, {
        headers: { "X-Usuario-Id": String(context.userId) },
      });
      if (clientsRes.ok) {
        const clients = await clientsRes.json();
        const matched = clients.find(
          (c: any) => c.nome.toLowerCase() === compradorNome.toLowerCase(),
        );
        if (matched) {
          clienteId = matched.id;
        } else {
          // Create client if not found
          const createRes = await fetch(`${BASE_URL}/clientes`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Usuario-Id": String(context.userId),
            },
            body: JSON.stringify({
              nome: compradorNome,
              ativo: true,
            }),
          });
          if (createRes.ok) {
            const newClient = await createRes.json();
            clienteId = newClient.id;
          }
        }
      }
    }

    const payload = {
      clienteId: clienteId,
      dataVenda: data.data_venda,
      formaPagamento: data.forma_pagamento?.toUpperCase() ?? null,
      statusPagamento: data.status_pagamento,
      observacao: data.observacao || null,
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
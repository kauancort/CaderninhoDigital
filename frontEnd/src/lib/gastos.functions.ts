import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";
export const listarGastos = createApiFn({ method: "GET" }).handler(async ({ context }) => {
  const res = await fetch(`${BASE_URL}/lancamentos?tipo=GASTO_GERAL`, {
    headers: { "X-Usuario-Id": String(context.userId) },
  });
  if (!res.ok) throw new Error("Erro ao listar gastos");
  const data = await res.json();
  return data.map((g: any) => {
    const categoria = String(g.descricao || "outros").split(":")[0];
    return {
      id: String(g.id),
      descricao: g.titulo || "",
      categoria,
      valor: g.valorTotal || 0,
      data_gasto: g.dataLancamento,
    };
  });
});

export const registrarGasto = createApiFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        descricao: z.string().min(1).max(200),
        categoria: z.enum([
          "materia-prima",
          "embalagens",
          "energia",
          "aluguel",
          "transporte",
          "outros",
        ]),
        valor: z.number().positive(),
        data_lancamento: z.string().date(),
        forma_pagamento: z.enum(["DINHEIRO", "PIX", "CARTAO", "BOLETO", "OUTRO"]).nullable(),
        status_pagamento: z.enum(["PAGO", "PENDENTE", "ATRASADO", "NAO_SE_APLICA"]),
        data_vencimento: z.string().date().optional().nullable(),
        observacao: z.string().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const res = await fetch(`${BASE_URL}/lancamentos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": String(context.userId),
      },
      body: JSON.stringify({
        tipo: "GASTO_GERAL",
        titulo: data.descricao,
        descricao: data.observacao ? `${data.categoria}: ${data.observacao}` : data.categoria,
        valorTotal: data.valor,
        dataLancamento: data.data_lancamento,
        dataVencimento: data.data_vencimento || null,
        formaPagamento: data.forma_pagamento,
        statusPagamento: data.status_pagamento,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao registrar gasto" }));
      throw new Error(err.message || "Erro ao registrar gasto");
    }

    return { ok: true };
  });

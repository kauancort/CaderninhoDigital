import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";
function mapProducao(p: any) {
  return {
    id: String(p.id),
    numero_lote: p.id + 100, // Simulate batch count
    produto_final_id: String(p.produtoId),
    quantidade_produzida: p.quantidadeProduzida,
    potes: p.quantidadeProduzida,
    unidade: 22,
    observacoes: p.observacao || "",
    data_producao: p.dataProducao,
    produtos_finais: {
      nome: p.produtoNome || "Produto",
      imagem: null,
    },
    producao_ingredientes: (p.insumos || []).map((ins: any) => ({
      quantidade_utilizada: ins.quantidadeUtilizada,
      materia_prima: {
        id: String(ins.materiaPrimaId),
        nome: ins.materiaPrimaNome || "Ingrediente",
        unidade: ins.unidadeMedida || "un",
      },
    })),
  };
}

export const listarProducoes = createApiFn({ method: "GET" }).handler(async ({ context }) => {
  const res = await fetch(`${BASE_URL}/producoes`, {
    headers: { "X-Usuario-Id": String(context.userId) },
  });
  if (!res.ok) throw new Error("Erro ao listar produções");
  const data = await res.json();
  return data.map(mapProducao);
});

export const obterProducao = createApiFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data, context }) => {
    const res = await fetch(`${BASE_URL}/producoes/${data.id}`, {
      headers: { "X-Usuario-Id": String(context.userId) },
    });
    if (!res.ok) throw new Error("Erro ao carregar produção");
    const p = await res.json();
    return mapProducao(p);
  });

export const proximoLote = createApiFn({ method: "GET" }).handler(async ({ context }) => {
  const res = await fetch(`${BASE_URL}/producoes`, {
    headers: { "X-Usuario-Id": String(context.userId) },
  });
  if (!res.ok) return 101;
  const list = await res.json();
  return 100 + list.length + 1;
});

export const registrarProducao = createApiFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        produto_final_id: z.union([z.string(), z.number()]),
        quantidade_produzida: z.number().positive(),
        data_producao: z.string().date(),
        potes: z.number().int().positive().optional(),
        unidade: z.number().int().positive().optional(),
        observacoes: z.string().max(500).optional().nullable(),
        ingredientes: z
          .array(
            z.object({
              materia_prima_id: z.union([z.string(), z.number()]),
              quantidade_utilizada: z.number().positive(),
            }),
          )
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload: any = {
      produtoId: Number(data.produto_final_id),
      dataProducao: data.data_producao,
      quantidadeProduzida: data.quantidade_produzida,
      observacao: data.observacoes || `Lote com ${data.potes} potes de ${data.unidade}g`,
    };

    if (data.ingredientes.length > 0) {
      payload.insumos = data.ingredientes.map((i: any) => ({
        materiaPrimaId: Number(i.materia_prima_id),
        quantidadeUtilizada: i.quantidade_utilizada,
      }));
    }

    const res = await fetch(`${BASE_URL}/producoes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": String(context.userId),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao registrar produção" }));
      throw new Error(err.message || "Erro ao registrar produção");
    }

    const row = await res.json();
    return mapProducao(row);
  });

import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";
export const listarProdutos = createApiFn({ method: "GET" }).handler(async ({ context }) => {
  const res = await fetch(`${BASE_URL}/produtos`, {
    headers: { "X-Usuario-Id": String(context.userId) },
  });
  if (!res.ok) throw new Error("Erro ao listar produtos");
  const data = await res.json();
  return data.map((p: any) => ({
    id: String(p.id),
    nome: p.nome,
    preco_venda: p.precoVenda,
    custo_estimado: p.precoVenda * 0.3, // Mock estimated cost as 30% of price
    imagem: p.descricao || null,
    quantidade_estoque: p.estoqueAtual || 0,
  }));
});

export const criarProduto = createApiFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        nome: z.string().min(1).max(120),
        preco_venda: z.number().positive(),
        custo_estimado: z.number().min(0).default(0),
        imagem: z.enum(["pacoca", "biriba", "fondant"]).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const res = await fetch(`${BASE_URL}/produtos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": String(context.userId),
      },
      body: JSON.stringify({
        nome: data.nome,
        descricao: data.imagem || "",
        unidadeMedida: "UN",
        precoVenda: data.preco_venda,
        estoqueAtual: 0,
        ativo: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao criar produto" }));
      throw new Error(err.message || "Erro ao criar produto");
    }
    return { ok: true };
  });

export const listarMateriaPrima = createApiFn({ method: "GET" }).handler(async ({ context }) => {
  const res = await fetch(`${BASE_URL}/materias-primas`, {
    headers: { "X-Usuario-Id": String(context.userId) },
  });
  if (!res.ok) throw new Error("Erro ao listar matérias-primas");
  const data = await res.json();
  return data.map((mp: any) => ({
    id: String(mp.id),
    nome: mp.nome,
    unidade: mp.unidadeMedida,
    estoque_minimo: mp.estoqueMinimo || 0,
    quantidade_estoque: mp.estoqueAtual || 0,
    custo_medio: mp.custoMedio || 0,
  }));
});

export const criarMateriaPrima = createApiFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        nome: z.string().min(1).max(120),
        unidade: z.string().min(1).max(10),
        estoque_minimo: z.number().min(0).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const res = await fetch(`${BASE_URL}/materias-primas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": String(context.userId),
      },
      body: JSON.stringify({
        nome: data.nome,
        descricao: "",
        unidadeMedida: data.unidade,
        estoqueAtual: 0,
        estoqueMinimo: data.estoque_minimo,
        custoMedio: 0,
        ativo: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao criar matéria-prima" }));
      throw new Error(err.message || "Erro ao criar matéria-prima");
    }
    const row = await res.json();
    return {
      id: String(row.id),
      nome: row.nome,
      unidade: row.unidadeMedida,
      estoque_minimo: row.estoqueMinimo,
      quantidade_estoque: row.estoqueAtual,
      custo_medio: row.custoMedio,
    };
  });

export const ajustarEstoqueMP = createApiFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.union([z.string(), z.number()]), delta: z.number() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // 1. Fetch current materia-prima
    const getRes = await fetch(`${BASE_URL}/materias-primas/${data.id}`, {
      headers: { "X-Usuario-Id": String(context.userId) },
    });
    if (!getRes.ok) throw new Error("Erro ao carregar matéria-prima");
    const mp = await getRes.json();

    // 2. Adjust stock amount
    const novaQuantidade = Math.max(0, (mp.estoqueAtual || 0) + data.delta);

    // 3. Update stock amount via PUT
    const putRes = await fetch(`${BASE_URL}/materias-primas/${data.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": String(context.userId),
      },
      body: JSON.stringify({
        nome: mp.nome,
        descricao: mp.descricao || "",
        unidadeMedida: mp.unidadeMedida,
        estoqueAtual: novaQuantidade,
        estoqueMinimo: mp.estoqueMinimo,
        custoMedio: mp.custoMedio,
        ativo: mp.ativo,
      }),
    });
    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({ message: "Erro ao ajustar estoque" }));
      throw new Error(err.message || "Erro ao ajustar estoque");
    }
    return { ok: true };
  });

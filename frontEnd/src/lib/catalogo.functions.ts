import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";
export const listarProdutos = createApiFn({ method: "GET" }).handler(async () => {
  const res = await fetch(`${BASE_URL}/produtos`, {});
  if (!res.ok) throw new Error("Erro ao listar produtos");
  const data = await res.json();
  return data.map((p: any) => ({
    id: String(p.id),
    nome: p.nome,
    preco_venda: p.precoVenda,
    custo_atual: p.custoAtual ?? null,
    sku: p.sku || "",
    categoria_id: p.categoriaId ? String(p.categoriaId) : "",
    categoria: p.categoriaNome || "",
    custo_estimado: p.custoAtual ?? 0,
    imagem: p.descricao || null,
    quantidade_estoque: p.estoqueAtual || 0,
    gabarito: p.gabarito
      ? {
          id: String(p.gabarito.id),
          quantidade_base: Number(p.gabarito.quantidadeBase),
          tutorial: p.gabarito.observacao || "",
          ingredientes: (p.gabarito.itens || []).map((item: any) => ({
            id: String(item.id),
            materia_prima_id: String(item.materiaPrimaId),
            nome: item.materiaPrimaNome,
            unidade: item.unidadeMedida,
            quantidade: Number(item.quantidadeNecessaria),
          })),
        }
      : null,
  }));
});

export const pesquisarProdutos = createApiFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        busca: z.string().default(""),
        pagina: z.number().int().min(0).default(0),
        tamanho: z.number().int().min(1).max(100).default(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      busca: data.busca,
      pagina: String(data.pagina),
      tamanho: String(data.tamanho),
      ativo: "true",
    });
    const res = await fetch(`${BASE_URL}/produtos/pagina?${params}`, {});
    if (!res.ok) throw new Error("Erro ao pesquisar produtos");
    const pagina = await res.json();
    return {
      ...pagina,
      registros: pagina.registros.map((p: any) => ({
        id: String(p.id),
        nome: p.nome,
        sku: p.sku || "",
        categoria: p.categoria || "",
        preco_venda: p.precoVenda,
        quantidade_estoque: p.estoqueAtual || 0,
      })),
    };
  });

export const obterProduto = createApiFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE_URL}/produtos/${data.id}`, {});
    if (!res.ok) throw new Error("Erro ao carregar produto");
    const produto = await res.json();
    return {
      id: String(produto.id),
      nome: produto.nome,
      sku: produto.sku || "",
      preco_venda: produto.precoVenda,
      custo_atual: produto.custoAtual ?? null,
      quantidade_estoque: produto.estoqueAtual || 0,
    };
  });

export const criarProduto = createApiFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        nome: z.string().min(1).max(120),
        preco_venda: z.number().positive(),
        custo_estimado: z.number().min(0).default(0),
        custo_atual: z.number().min(0).optional().nullable(),
        sku: z.string().max(60).optional().nullable(),
        categoria_id: z.union([z.string(), z.number()]).optional().nullable(),
        imagem: z.enum(["pacoca", "biriba", "fondant"]).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE_URL}/produtos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nome: data.nome,
        descricao: data.imagem || "",
        unidadeMedida: "UN",
        precoVenda: data.preco_venda,
        custoAtual: data.custo_atual ?? null,
        sku: data.sku || null,
        categoriaId: data.categoria_id ? Number(data.categoria_id) : null,
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

export const listarMateriaPrima = createApiFn({ method: "GET" }).handler(async () => {
  const res = await fetch(`${BASE_URL}/materias-primas`, {});
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

export const pesquisarMateriasPrimas = createApiFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        busca: z.string().default(""),
        pagina: z.number().int().min(0).default(0),
        tamanho: z.number().int().min(1).max(100).default(20),
        emAlerta: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      busca: data.busca,
      pagina: String(data.pagina),
      tamanho: String(data.tamanho),
      ativo: "true",
    });
    if (data.emAlerta) params.set("emAlerta", "true");
    const res = await fetch(`${BASE_URL}/materias-primas/pagina?${params}`, {});
    if (!res.ok) throw new Error("Erro ao pesquisar matérias-primas");
    const pagina = await res.json();
    return {
      ...pagina,
      registros: pagina.registros.map((mp: any) => ({
        id: String(mp.id),
        nome: mp.nome,
        unidade: mp.unidadeMedida,
        estoque_minimo: mp.estoqueMinimo || 0,
        quantidade_estoque: mp.estoqueAtual || 0,
        custo_medio: mp.custoMedio || 0,
      })),
    };
  });

export const obterMateriaPrima = createApiFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE_URL}/materias-primas/${data.id}`, {});
    if (!res.ok) throw new Error("Erro ao carregar matéria-prima");
    const materia = await res.json();
    return {
      id: String(materia.id),
      nome: materia.nome,
      unidade: materia.unidadeMedida,
      estoque_minimo: materia.estoqueMinimo || 0,
      quantidade_estoque: materia.estoqueAtual || 0,
      custo_medio: materia.custoMedio || 0,
    };
  });

export const resumirEstoqueMateriasPrimas = createApiFn({ method: "GET" })
  .inputValidator((d) => z.object({ busca: z.string().default("") }).parse(d))
  .handler(async ({ data }) => {
    const params = new URLSearchParams({ busca: data.busca, ativo: "true" });
    const res = await fetch(`${BASE_URL}/materias-primas/resumo-estoque?${params}`, {});
    if (!res.ok) throw new Error("Erro ao resumir estoque de matérias-primas");
    return res.json() as Promise<{
      totalItens: number;
      itensEmAlerta: number;
      valorEstoque: number;
    }>;
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
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE_URL}/materias-primas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
  .handler(async ({ data }) => {
    // 1. Fetch current materia-prima
    const getRes = await fetch(`${BASE_URL}/materias-primas/${data.id}`, {});
    if (!getRes.ok) throw new Error("Erro ao carregar matéria-prima");
    const mp = await getRes.json();

    // 2. Adjust stock amount
    const novaQuantidade = Math.max(0, (mp.estoqueAtual || 0) + data.delta);

    // 3. Update stock amount via PUT
    const putRes = await fetch(`${BASE_URL}/materias-primas/${data.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
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

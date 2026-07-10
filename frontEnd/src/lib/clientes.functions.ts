import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";
const clienteSchema = z.object({
  nome: z.string().min(1).max(120),
  telefone: z.string().max(40).optional().default(""),
  email: z.string().max(120).optional().default(""),
  endereco: z.string().max(240).optional().default(""),
  documento: z.string().max(40).optional().default(""),
});

export const listarClientes = createApiFn({ method: "GET" }).handler(async ({ context }) => {
  const res = await fetch(`${BASE_URL}/clientes`, {
    headers: { "X-Usuario-Id": String(context.userId) },
  });
  if (!res.ok) throw new Error("Erro ao listar clientes");
  const data = await res.json();
  return data.map((c: any) => ({
    id: String(c.id),
    nome: c.nome,
    telefone: c.telefone || "",
    email: c.email || "",
    endereco: c.endereco || "",
    documento: c.documento || "",
  }));
});

export const criarCliente = createApiFn({ method: "POST" })
  .inputValidator((d) => clienteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const res = await fetch(`${BASE_URL}/clientes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": String(context.userId),
      },
      body: JSON.stringify({
        nome: data.nome,
        email: data.email || null,
        telefone: data.telefone || null,
        documento: data.documento || null,
        endereco: data.endereco || null,
        ativo: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao criar cliente" }));
      throw new Error(err.message || "Erro ao criar cliente");
    }
    return { ok: true };
  });

export const atualizarCliente = createApiFn({ method: "POST" })
  .inputValidator((d) => clienteSchema.extend({ id: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const res = await fetch(`${BASE_URL}/clientes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": String(context.userId),
      },
      body: JSON.stringify({
        nome: rest.nome,
        email: rest.email || null,
        telefone: rest.telefone || null,
        documento: rest.documento || null,
        endereco: rest.endereco || null,
        ativo: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao atualizar cliente" }));
      throw new Error(err.message || "Erro ao atualizar cliente");
    }
    return { ok: true };
  });

export const excluirCliente = createApiFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data, context }) => {
    const res = await fetch(`${BASE_URL}/clientes/${data.id}`, {
      method: "DELETE",
      headers: { "X-Usuario-Id": String(context.userId) },
    });
    if (!res.ok) throw new Error("Erro ao excluir cliente");
    return { ok: true };
  });

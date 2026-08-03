import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";
const clienteSchema = z.object({
  nome: z.string().min(1).max(120),
  telefone: z.string().trim().min(1, "Informe o telefone do cliente.").max(40),
  email: z.string().trim().email("Informe um e-mail válido.").max(120),
  endereco: z.string().max(240).optional().default(""),
  numero: z.string().max(20).optional().default(""),
  complemento: z.string().max(120).optional().default(""),
  documento: z.string().max(40).optional().default(""),
  cep: z
    .string()
    .regex(/^$|^\d{8}$/, "Informe os 8 dígitos do CEP.")
    .optional()
    .default(""),
  bairro: z.string().max(120).optional().default(""),
  inscricaoEstadual: z.string().max(40).optional().default(""),
});

function mapCliente(c: any) {
  return {
    id: String(c.id),
    nome: c.nome,
    telefone: c.telefone || "",
    email: c.email || "",
    endereco: c.endereco || "",
    numero: c.numero || "",
    complemento: c.complemento || "",
    documento: c.documento || "",
    cep: c.cep || "",
    bairro: c.bairro || "",
    inscricaoEstadual: c.inscricaoEstadual || "",
  };
}

export function clientePayload(data: z.infer<typeof clienteSchema>) {
  return {
    nome: data.nome,
    email: data.email || null,
    telefone: data.telefone || null,
    documento: data.documento || null,
    endereco: data.endereco || null,
    numero: data.numero || null,
    complemento: data.complemento || null,
    cep: data.cep || null,
    bairro: data.bairro || null,
    inscricaoEstadual: data.inscricaoEstadual || null,
    ativo: true,
  };
}

export const listarClientes = createApiFn({ method: "GET" }).handler(async () => {
  const res = await fetch(`${BASE_URL}/clientes`, {});
  if (!res.ok) throw new Error("Erro ao listar clientes");
  const data = await res.json();
  return data.map(mapCliente);
});

export const pesquisarClientes = createApiFn({ method: "GET" })
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
    const res = await fetch(`${BASE_URL}/clientes/pagina?${params}`, {});
    if (!res.ok) throw new Error("Erro ao pesquisar clientes");
    const pagina = await res.json();
    return {
      ...pagina,
      registros: pagina.registros.map(mapCliente),
    };
  });

export const criarCliente = createApiFn({ method: "POST" })
  .inputValidator((d) => clienteSchema.parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE_URL}/clientes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clientePayload(data)),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao criar cliente" }));
      throw new Error(err.message || "Erro ao criar cliente");
    }
    const cliente = await res.json();
    return mapCliente(cliente);
  });

export const atualizarCliente = createApiFn({ method: "POST" })
  .inputValidator((d) => clienteSchema.extend({ id: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const res = await fetch(`${BASE_URL}/clientes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clientePayload(rest)),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao atualizar cliente" }));
      throw new Error(err.message || "Erro ao atualizar cliente");
    }
    return { ok: true };
  });

export const excluirCliente = createApiFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.union([z.string(), z.number()]) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE_URL}/clientes/${data.id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Erro ao excluir cliente");
    return { ok: true };
  });

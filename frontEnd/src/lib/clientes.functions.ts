import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";
import { UFS_BRASIL } from "./cliente-form";
const emailOpcional = z.union([
  z.literal(""),
  z.string().trim().email("Informe um e-mail válido.").max(160),
]);
export const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do cliente.").max(120),
  telefone: z
    .string()
    .trim()
    .regex(/^(?:\D*\d){10,11}\D*$/, "Informe um telefone válido."),
  email: emailOpcional.default(""),
  endereco: z.string().trim().min(1, "Informe a rua ou o endereço.").max(255),
  numero: z.string().trim().min(1, "Informe o número.").max(20),
  complemento: z.string().max(120).optional().default(""),
  documento: z.string().min(1, "Informe o CPF ou CNPJ.").max(40),
  cep: z
    .string()
    .regex(/^$|^\d{8}$/, "Informe os 8 dígitos do CEP.")
    .optional()
    .default(""),
  bairro: z.string().trim().min(1, "Informe o bairro.").max(120),
  cidade: z.string().trim().min(1, "Informe a cidade.").max(120),
  estado: z.enum(UFS_BRASIL, { message: "Selecione o estado." }),
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
    cidade: c.cidade || "",
    estado: c.estado || "",
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
    cidade: data.cidade,
    estado: data.estado,
    inscricaoEstadual: data.inscricaoEstadual || null,
    ativo: true,
  };
}

function mensagemCliente(message: string, fallback: string) {
  if (!message) return fallback;
  return message
    .split("; ")
    .map((parte) => parte.replace(/^[\wÀ-ÿ]+:\s*/, ""))
    .join(" ");
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
      throw new Error(mensagemCliente(err.message, "Não foi possível criar o cliente."));
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
      throw new Error(mensagemCliente(err.message, "Não foi possível atualizar o cliente."));
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


export type Transportadora = {
  id: string;
  clienteId: string;
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  observacao: string;
};

export type TransportadoraPayload = Omit<Transportadora, "id" | "clienteId">;

function mapTransportadora(t: any): Transportadora {
  return {
    id: String(t.id),
    clienteId: String(t.clienteId),
    nome: t.nome || "",
    cnpj: t.cnpj || "",
    telefone: t.telefone || "",
    email: t.email || "",
    cep: t.cep || "",
    endereco: t.endereco || "",
    numero: t.numero || "",
    complemento: t.complemento || "",
    bairro: t.bairro || "",
    cidade: t.cidade || "",
    estado: t.estado || "",
    observacao: t.observacao || "",
  };
}

export async function buscarTransportadoraCliente(clienteId: string | number) {
  const res = await fetch(`${BASE_URL}/clientes/${clienteId}/transportadora`, {});
  if (res.status === 204) return null;
  if (!res.ok) throw new Error("Erro ao buscar a transportadora do cliente");
  return mapTransportadora(await res.json());
}

export async function salvarTransportadoraCliente(
  clienteId: string | number,
  data: TransportadoraPayload,
) {
  const res = await fetch(`${BASE_URL}/clientes/${clienteId}/transportadora`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erro ao salvar transportadora" }));
    throw new Error(mensagemCliente(err.message, "Não foi possível salvar a transportadora."));
  }
  return mapTransportadora(await res.json());
}

export async function removerTransportadoraCliente(clienteId: string | number) {
  const res = await fetch(`${BASE_URL}/clientes/${clienteId}/transportadora`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erro ao remover a transportadora");
  return { ok: true };
}

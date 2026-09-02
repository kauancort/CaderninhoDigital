import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";
import { UFS_BRASIL } from "./cliente-form";

const emailOpcional = z.union([
  z.literal(""),
  z.string().trim().email("Informe um e-mail válido.").max(160),
]);

const clienteCamposSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do cliente.").max(120),

  telefone: z
    .string()
    .trim()
    .regex(/^$|^(?:\D*\d){10,11}\D*$/, "Informe um telefone válido.")
    .default(""),

  email: emailOpcional.default(""),

  endereco: z.string().trim().max(255).default(""),

  numero: z.string().trim().max(20).default(""),

  complemento: z.string().max(120).optional().default(""),

  documento: z.string().trim().max(40).default(""),

  cep: z
    .string()
    .regex(/^$|^\d{8}$/, "Informe os 8 dígitos do CEP.")
    .optional()
    .default(""),

  bairro: z.string().trim().max(120).default(""),

  cidade: z.string().trim().max(120).default(""),

  estado: z.union([z.enum(UFS_BRASIL), z.literal("")]).default(""),

  inscricaoEstadual: z.string().max(40).optional().default(""),
  tipo: z.enum(["CLIENTE", "TRANSPORTADORA", "LOJISTA"]).optional().default("CLIENTE"),
});

function validarCamposCliente(
  data: z.infer<typeof clienteCamposSchema>,
  contexto: z.RefinementCtx,
) {
  if (data.tipo === "TRANSPORTADORA") return;

  const obrigatorios: Array<[keyof typeof data, string]> = [
    ["telefone", "Informe um telefone válido."],
    ["documento", "Informe o CPF ou CNPJ."],
    ["endereco", "Informe a rua ou o endereço."],
    ["numero", "Informe o número."],
    ["bairro", "Informe o bairro."],
    ["cidade", "Informe a cidade."],
    ["estado", "Selecione o estado."],
  ];

  for (const [campo, mensagem] of obrigatorios) {
    if (!String(data[campo] ?? "").trim()) {
      contexto.addIssue({
        code: "custom",
        path: [campo],
        message: mensagem,
      });
    }
  }
}

export const clienteSchema = clienteCamposSchema.superRefine(validarCamposCliente);

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

export type TransportadoraDetalhes = {
  id: string;
  nome: string;
  clientesVinculados: Array<{
    id: string;
    nome: string;
    tipo: "CLIENTE" | "TRANSPORTADORA" | "LOJISTA" | null;
  }>;
  historico: Array<{
    vendaId: string;
    clienteId: string;
    clienteNome: string;
    dataVenda: string;
    custoEnvio: number | null;
    dataEnvio: string | null;
    previsaoEntrega: string | null;
    codigoRastreamento: string | null;
    situacaoDespacho: string | null;
  }>;
};

const transportadoraPayloadSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da transportadora.").max(160),

  cnpj: z.string().max(20).optional().default(""),
  telefone: z.string().max(30).optional().default(""),
  email: z.string().max(160).optional().default(""),
  cep: z.string().max(8).optional().default(""),
  endereco: z.string().max(255).optional().default(""),
  numero: z.string().max(20).optional().default(""),
  complemento: z.string().max(120).optional().default(""),
  bairro: z.string().max(120).optional().default(""),
  cidade: z.string().max(120).optional().default(""),
  estado: z.string().max(2).optional().default(""),
  observacao: z.string().max(500).optional().default(""),
});

const camposTransportadoraVinculada = {
  usaTransportadora: z.boolean().optional().default(false),
  transportadoraNome: z.string().optional().default(""),
  transportadoraCnpj: z.string().optional().default(""),
  transportadoraTelefone: z.string().optional().default(""),
  transportadoraEmail: z.string().optional().default(""),
  transportadoraCep: z.string().optional().default(""),
  transportadoraEndereco: z.string().optional().default(""),
  transportadoraNumero: z.string().optional().default(""),
  transportadoraComplemento: z.string().optional().default(""),
  transportadoraBairro: z.string().optional().default(""),
  transportadoraCidade: z.string().optional().default(""),
  transportadoraEstado: z.string().optional().default(""),
  transportadoraObservacao: z.string().optional().default(""),
};

const clienteComTransportadoraSchema = clienteCamposSchema
  .extend(camposTransportadoraVinculada)
  .superRefine(validarCamposCliente);

export type ClienteComTransportadora = z.infer<typeof clienteComTransportadoraSchema>;

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
    tipo: c.tipo || "CLIENTE",
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
    tipo: data.tipo,
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

function montarTransportadoraPayload(data: ClienteComTransportadora): TransportadoraPayload {
  return {
    nome: data.transportadoraNome?.trim() || "",
    cnpj: data.transportadoraCnpj?.trim() || "",
    telefone: data.transportadoraTelefone?.trim() || "",
    email: data.transportadoraEmail?.trim() || "",
    cep: data.transportadoraCep?.replace(/\D/g, "") || "",
    endereco: data.transportadoraEndereco?.trim() || "",
    numero: data.transportadoraNumero?.trim() || "",
    complemento: data.transportadoraComplemento?.trim() || "",
    bairro: data.transportadoraBairro?.trim() || "",
    cidade: data.transportadoraCidade?.trim() || "",
    estado: data.transportadoraEstado?.trim() || "",
    observacao: data.transportadoraObservacao?.trim() || "",
  };
}

async function sincronizarTransportadora(
  clienteId: string | number,
  data: ClienteComTransportadora,
) {
  if (data.usaTransportadora) {
    const transportadora = montarTransportadoraPayload(data);

    const resultado = transportadoraPayloadSchema.safeParse(transportadora);

    if (!resultado.success) {
      throw new Error(resultado.error.issues[0]?.message || "Dados da transportadora inválidos.");
    }

    await salvarTransportadoraCliente(clienteId, resultado.data);

    return;
  }

  await removerTransportadoraCliente(clienteId);
}

export const listarClientes = createApiFn({
  method: "GET",
}).handler(async () => {
  const res = await fetch(`${BASE_URL}/clientes`, {});

  if (!res.ok) {
    throw new Error("Erro ao listar clientes");
  }

  const data = await res.json();

  return data.map(mapCliente);
});

export const pesquisarClientes = createApiFn({
  method: "GET",
})
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

    if (!res.ok) {
      throw new Error("Erro ao pesquisar clientes");
    }

    const pagina = await res.json();

    return {
      ...pagina,
      registros: pagina.registros.map(mapCliente),
    };
  });

export const criarCliente = createApiFn({
  method: "POST",
})
  .inputValidator((d) => clienteComTransportadoraSchema.parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE_URL}/clientes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clientePayload(data)),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({
        message: "Erro ao criar cliente",
      }));

      throw new Error(mensagemCliente(err.message, "Não foi possível criar o cliente."));
    }

    const cliente = await res.json();

    const clienteMapeado = mapCliente(cliente);

    await sincronizarTransportadora(clienteMapeado.id, data);

    return clienteMapeado;
  });

export const atualizarCliente = createApiFn({
  method: "POST",
})
  .inputValidator((d) =>
    clienteComTransportadoraSchema
      .and(z.object({ id: z.union([z.string(), z.number()]) }))
      .parse(d),
  )
  .handler(async ({ data }) => {
    const {
      id,
      usaTransportadora,
      transportadoraNome,
      transportadoraCnpj,
      transportadoraTelefone,
      transportadoraEmail,
      transportadoraCep,
      transportadoraEndereco,
      transportadoraNumero,
      transportadoraComplemento,
      transportadoraBairro,
      transportadoraCidade,
      transportadoraEstado,
      transportadoraObservacao,
      ...rest
    } = data;

    const res = await fetch(`${BASE_URL}/clientes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clientePayload(rest)),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({
        message: "Erro ao atualizar cliente",
      }));

      throw new Error(mensagemCliente(err.message, "Não foi possível atualizar o cliente."));
    }

    await sincronizarTransportadora(id, {
      ...rest,
      usaTransportadora,
      transportadoraNome,
      transportadoraCnpj,
      transportadoraTelefone,
      transportadoraEmail,
      transportadoraCep,
      transportadoraEndereco,
      transportadoraNumero,
      transportadoraComplemento,
      transportadoraBairro,
      transportadoraCidade,
      transportadoraEstado,
      transportadoraObservacao,
    });

    return { ok: true };
  });

export const excluirCliente = createApiFn({
  method: "POST",
})
  .inputValidator((d) =>
    z
      .object({
        id: z.union([z.string(), z.number()]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE_URL}/clientes/${data.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error("Erro ao excluir cliente");
    }

    return { ok: true };
  });

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

  if (res.status === 204) {
    return null;
  }

  if (!res.ok) {
    throw new Error("Erro ao buscar a transportadora do cliente");
  }

  return mapTransportadora(await res.json());
}

export async function buscarDetalhesTransportadora(clienteId: string | number) {
  const res = await fetch(`${BASE_URL}/clientes/${clienteId}/transportadora/detalhes`, {});

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erro ao buscar detalhes" }));
    throw new Error(err.message || "Não foi possível carregar os detalhes da transportadora.");
  }

  const data = await res.json();

  return {
    id: String(data.id),
    nome: data.nome,
    clientesVinculados: (data.clientesVinculados ?? []).map((cliente: any) => ({
      id: String(cliente.id),
      nome: cliente.nome,
      tipo: cliente.tipo ?? null,
    })),
    historico: (data.historico ?? []).map((uso: any) => ({
      vendaId: String(uso.vendaId),
      clienteId: String(uso.clienteId),
      clienteNome: uso.clienteNome,
      dataVenda: uso.dataVenda,
      custoEnvio: uso.custoEnvio == null ? null : Number(uso.custoEnvio),
      dataEnvio: uso.dataEnvio ?? null,
      previsaoEntrega: uso.previsaoEntrega ?? null,
      codigoRastreamento: uso.codigoRastreamento ?? null,
      situacaoDespacho: uso.situacaoDespacho ?? null,
    })),
  } satisfies TransportadoraDetalhes;
}

export async function salvarTransportadoraCliente(
  clienteId: string | number,
  data: TransportadoraPayload,
) {
  const res = await fetch(`${BASE_URL}/clientes/${clienteId}/transportadora`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({
      message: "Erro ao salvar transportadora",
    }));

    throw new Error(mensagemCliente(err.message, "Não foi possível salvar a transportadora."));
  }

  return mapTransportadora(await res.json());
}

export async function removerTransportadoraCliente(clienteId: string | number) {
  const res = await fetch(`${BASE_URL}/clientes/${clienteId}/transportadora`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("Erro ao remover a transportadora");
  }

  return { ok: true };
}

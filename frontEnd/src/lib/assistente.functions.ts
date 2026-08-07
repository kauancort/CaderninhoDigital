import { z } from "zod";
import { apiRequest } from "./api-client";

export const ASSISTENTE_CONTRACT_VERSION = "1.0";

const mensagemSchema = z
  .object({ autor: z.enum(["usuario", "assistente"]), texto: z.string().trim().min(1).max(4000) })
  .strict();

const conversaSchema = z
  .object({
    mensagem: z.string().trim().min(1).max(2000).optional(),
    acaoRapida: z
      .enum(["RESUMIR_NEGOCIO", "VERIFICAR_ESTOQUE", "RESUMIR_VENDAS", "VERIFICAR_RECEBIVEIS"])
      .optional(),
    historico: z.array(mensagemSchema).max(30).default([]),
    contextoTela: z
      .object({ rota: z.string().max(80).optional(), recurso: z.string().max(40).optional() })
      .strict()
      .optional(),
    versaoContrato: z.literal(ASSISTENTE_CONTRACT_VERSION).default(ASSISTENTE_CONTRACT_VERSION),
    correlacao: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,100}$/)
      .optional(),
  })
  .strict()
  .refine((value) => Boolean(value.mensagem || value.acaoRapida), {
    message: "Informe uma mensagem ou ação rápida",
  });

const respostaSchema = z
  .object({
    resposta: z.string(),
    versaoContrato: z.literal(ASSISTENTE_CONTRACT_VERSION),
    status: z.string(),
    dados: z.record(z.string(), z.unknown()).nullable().optional(),
    acoesSugeridas: z.array(z.object({ codigo: z.string(), rotulo: z.string() })).default([]),
    origem: z.string(),
    avisos: z.array(z.string()).default([]),
    qualidade: z.string(),
    correlacao: z.string().nullable().optional(),
  })
  .passthrough();

export type MensagemConversa = z.infer<typeof conversaSchema>["historico"][number];
export type AssistenteResposta = z.infer<typeof respostaSchema>;

export async function conversarComAssistente(data: {
  mensagem?: string;
  acaoRapida?: "RESUMIR_NEGOCIO" | "VERIFICAR_ESTOQUE" | "RESUMIR_VENDAS" | "VERIFICAR_RECEBIVEIS";
  historico: MensagemConversa[];
  contextoTela?: { rota?: string; recurso?: string };
  correlacao?: string;
}): Promise<AssistenteResposta> {
  const parsedData = conversaSchema.parse(data);
  const response = await apiRequest<unknown>("/assistente/conversa", {
    method: "POST",
    body: JSON.stringify(parsedData),
  });
  return respostaSchema.parse(response);
}

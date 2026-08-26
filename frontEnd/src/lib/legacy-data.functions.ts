import { z } from "zod";
import { apiRequest } from "./api-client";

const legacyAuditItemSchema = z.object({
  arquivo: z.string(),
  linha: z.number().int(),
  codigoLegado: z.string(),
  nome: z.string(),
  classificacaoSugerida: z.string(),
  contextos: z.array(z.string()),
  motivos: z.array(z.string()),
  alertas: z.array(z.string()),
  unidade: z.string(),
  estoque: z.number().nullable(),
  ativo: z.boolean().nullable(),
});

const legacyQuantityIssueSchema = z.object({
  arquivo: z.string(),
  linha: z.number().int(),
  codigoLegado: z.string(),
  coluna: z.string(),
  valor: z.number().nullable(),
  unidade: z.string(),
  tipo: z.string(),
  mensagem: z.string(),
});

const legacyAuditResponseSchema = z.object({
  arquivoPrincipal: z.string(),
  arquivosAnalisados: z.number().int(),
  registrosAnalisados: z.number().int(),
  classificacoes: z.record(z.string(), z.number().int()),
  registrosComAlertas: z.number().int(),
  quantidadesExorbitantes: z.number().int(),
  itensParaRevisao: z.array(legacyAuditItemSchema),
  alertasQuantidade: z.array(legacyQuantityIssueSchema),
});

const legacyCatalogTreatmentItemSchema = z.object({
  arquivo: z.string(),
  linha: z.number().int(),
  codigoLegado: z.string(),
  nome: z.string(),
  classificacaoSugerida: z.string(),
  contextos: z.array(z.string()),
  motivos: z.array(z.string()),
  alertas: z.array(z.string()),
  unidade: z.string(),
  precoCusto: z.number().nullable(),
  precoVenda: z.number().nullable(),
  estoque: z.number().nullable(),
  estoqueMinimo: z.number().nullable(),
  ativo: z.boolean().nullable(),
  status: z.enum(["PRONTO", "PENDENTE_REVISAO"]),
});

const legacyCatalogTreatmentResponseSchema = z.object({
  arquivoPrincipal: z.string(),
  arquivosAnalisados: z.number().int(),
  registrosAnalisados: z.number().int(),
  classificacoes: z.record(z.string(), z.number().int()),
  itensProntos: z.number().int(),
  itensParaRevisao: z.number().int(),
  itens: z.array(legacyCatalogTreatmentItemSchema),
});

const legacyImportRejectionSchema = z.object({
  arquivo: z.string(),
  linha: z.number().int(),
  codigoLegado: z.string(),
  nome: z.string(),
  tipo: z.string(),
  mensagem: z.string(),
  bloqueante: z.boolean(),
});

const legacyImportSimulationResponseSchema = z.object({
  arquivoPrincipal: z.string(),
  arquivosAnalisados: z.number().int(),
  registrosAnalisados: z.number().int(),
  prontoParaImportacao: z.boolean(),
  itensProntos: z.number().int(),
  itensPendentes: z.number().int(),
  rejeicoes: z.array(legacyImportRejectionSchema),
  bloqueios: z.array(z.string()),
});

const legacyCatalogDecisionAppliedSchema = z.object({
  arquivo: z.string(),
  linha: z.number().int(),
  codigoLegado: z.string(),
  classificacaoFinal: z.string(),
  observacao: z.string().nullable(),
});

const legacyCatalogDecisionResponseSchema = z.object({
  arquivoPrincipal: z.string(),
  arquivosAnalisados: z.number().int(),
  registrosAnalisados: z.number().int(),
  prontoParaImportacao: z.boolean(),
  itensAprovados: z.number().int(),
  itensNaoImportados: z.number().int(),
  itensPendentes: z.number().int(),
  decisoesAplicadas: z.array(legacyCatalogDecisionAppliedSchema),
  rejeicoes: z.array(legacyImportRejectionSchema),
  bloqueios: z.array(z.string()),
});

const legacyCatalogImportResponseSchema = z.object({
  importacaoId: z.number().int(),
  status: z.enum(["SIMULACAO", "EM_EXECUCAO", "CONCLUIDA", "FALHA"]),
  arquivoPrincipal: z.string(),
  arquivosAnalisados: z.number().int(),
  registrosAnalisados: z.number().int(),
  produtosImportados: z.number().int(),
  materiasPrimasImportadas: z.number().int(),
  jaProcessados: z.number().int(),
  naoImportados: z.number().int(),
  aguardandoHistorico: z.number().int(),
  rejeicoes: z.array(legacyImportRejectionSchema),
});

const legacyHistoricalIssueSchema = z.object({
  arquivo: z.string(),
  linha: z.number().int(),
  codigoLegado: z.string(),
  dominio: z.string(),
  tipo: z.string(),
  mensagem: z.string(),
  bloqueante: z.boolean(),
});

const legacyHistoricalTreatmentResponseSchema = z.object({
  arquivoPrincipal: z.string(),
  arquivosAnalisados: z.number().int(),
  registrosAnalisados: z.number().int(),
  registrosPorDominio: z.record(z.string(), z.number().int()),
  registrosProntos: z.number().int(),
  registrosBloqueados: z.number().int(),
  pendencias: z.array(legacyHistoricalIssueSchema),
});

const legacyContactImportResponseSchema = z.object({
  importacaoId: z.number().int(),
  status: z.enum(["SIMULACAO", "EM_EXECUCAO", "CONCLUIDA", "FALHA"]),
  arquivoPrincipal: z.string(),
  arquivosAnalisados: z.number().int(),
  registrosAnalisados: z.number().int(),
  clientesImportados: z.number().int(),
  fornecedoresImportados: z.number().int(),
  jaProcessados: z.number().int(),
  pendentes: z.number().int(),
  rejeicoes: z.array(legacyHistoricalIssueSchema),
});

const legacyContactPreviewResponseSchema = z.object({
  arquivoPrincipal: z.string(),
  arquivosAnalisados: z.number().int(),
  registrosAnalisados: z.number().int(),
  clientesIdentificados: z.number().int(),
  fornecedoresIdentificados: z.number().int(),
  pendentes: z.number().int(),
  pendencias: z.array(legacyHistoricalIssueSchema),
});

export type LegacyAuditResponse = z.infer<typeof legacyAuditResponseSchema>;
export type LegacyCatalogTreatmentResponse = z.infer<typeof legacyCatalogTreatmentResponseSchema>;
export type LegacyImportSimulationResponse = z.infer<typeof legacyImportSimulationResponseSchema>;
export type LegacyCatalogDecision = {
  arquivo: string;
  linha: number;
  codigoLegado: string;
  classificacaoFinal: string;
  observacao: string;
};
export type LegacyCatalogDecisionResponse = z.infer<typeof legacyCatalogDecisionResponseSchema>;
export type LegacyCatalogImportResponse = z.infer<typeof legacyCatalogImportResponseSchema>;
export type LegacyHistoricalTreatmentResponse = z.infer<
  typeof legacyHistoricalTreatmentResponseSchema
>;
export type LegacyContactImportResponse = z.infer<typeof legacyContactImportResponseSchema>;
export type LegacyContactPreviewResponse = z.infer<typeof legacyContactPreviewResponseSchema>;

export async function auditarDadosLegados(files: File[]): Promise<LegacyAuditResponse> {
  if (files.length === 0) throw new Error("Selecione ao menos um arquivo legado.");

  const formData = new FormData();
  files.forEach((file) => formData.append("arquivos", file, file.name));

  const response = await apiRequest<unknown>("/configuracoes/dados-legados/preview", {
    method: "POST",
    body: formData,
  });
  return legacyAuditResponseSchema.parse(response);
}

export async function tratarCatalogoDadosLegados(
  files: File[],
): Promise<LegacyCatalogTreatmentResponse> {
  if (files.length === 0) throw new Error("Selecione ao menos um arquivo legado.");

  const formData = new FormData();
  files.forEach((file) => formData.append("arquivos", file, file.name));

  const response = await apiRequest<unknown>("/configuracoes/dados-legados/tratamento-preview", {
    method: "POST",
    body: formData,
  });
  return legacyCatalogTreatmentResponseSchema.parse(response);
}

export async function simularImportacaoDadosLegados(
  files: File[],
): Promise<LegacyImportSimulationResponse> {
  if (files.length === 0) throw new Error("Selecione ao menos um arquivo legado.");

  const formData = new FormData();
  files.forEach((file) => formData.append("arquivos", file, file.name));

  const response = await apiRequest<unknown>("/configuracoes/dados-legados/simulacao", {
    method: "POST",
    body: formData,
  });
  return legacyImportSimulationResponseSchema.parse(response);
}

export async function validarDecisoesCatalogoDadosLegados(
  files: File[],
  decisions: LegacyCatalogDecision[],
): Promise<LegacyCatalogDecisionResponse> {
  if (files.length === 0) throw new Error("Selecione ao menos um arquivo legado.");

  const formData = new FormData();
  files.forEach((file) => formData.append("arquivos", file, file.name));
  formData.append("decisoes", new Blob([JSON.stringify(decisions)], { type: "application/json" }));

  const response = await apiRequest<unknown>("/configuracoes/dados-legados/decisoes-preview", {
    method: "POST",
    body: formData,
  });
  return legacyCatalogDecisionResponseSchema.parse(response);
}

export async function importarCatalogoDadosLegados(
  files: File[],
  decisions: LegacyCatalogDecision[],
): Promise<LegacyCatalogImportResponse> {
  if (files.length === 0) throw new Error("Selecione ao menos um arquivo legado.");

  const formData = new FormData();
  files.forEach((file) => formData.append("arquivos", file, file.name));
  formData.append("decisoes", new Blob([JSON.stringify(decisions)], { type: "application/json" }));

  const response = await apiRequest<unknown>("/configuracoes/dados-legados/importacao-catalogo", {
    method: "POST",
    body: formData,
  });
  return legacyCatalogImportResponseSchema.parse(response);
}

export async function validarHistoricosDadosLegados(
  files: File[],
): Promise<LegacyHistoricalTreatmentResponse> {
  if (files.length === 0) throw new Error("Selecione ao menos um arquivo legado.");

  const formData = new FormData();
  files.forEach((file) => formData.append("arquivos", file, file.name));

  const response = await apiRequest<unknown>("/configuracoes/dados-legados/historicos-preview", {
    method: "POST",
    body: formData,
  });
  return legacyHistoricalTreatmentResponseSchema.parse(response);
}

export async function importarContatosDadosLegados(
  files: File[],
): Promise<LegacyContactImportResponse> {
  if (files.length === 0) throw new Error("Selecione ao menos um arquivo legado.");

  const formData = new FormData();
  files.forEach((file) => formData.append("arquivos", file, file.name));

  const response = await apiRequest<unknown>("/configuracoes/dados-legados/importacao-contatos", {
    method: "POST",
    body: formData,
  });
  return legacyContactImportResponseSchema.parse(response);
}

export async function verificarContatosDadosLegados(
  files: File[],
): Promise<LegacyContactPreviewResponse> {
  if (files.length === 0) throw new Error("Selecione ao menos um arquivo legado.");

  const formData = new FormData();
  files.forEach((file) => formData.append("arquivos", file, file.name));

  const response = await apiRequest<unknown>("/configuracoes/dados-legados/contatos-preview", {
    method: "POST",
    body: formData,
  });
  return legacyContactPreviewResponseSchema.parse(response);
}

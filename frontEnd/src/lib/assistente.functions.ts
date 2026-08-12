import { z } from "zod";
import { ApiError, apiRequest } from "./api-client";

export const ASSISTENTE_CONTRACT_VERSION = "1.1";

const mensagemSchema = z
  .object({ autor: z.enum(["usuario", "assistente"]), texto: z.string().trim().min(1).max(4000) })
  .strict();

const conversaSchema = z
  .object({
    mensagem: z.string().trim().min(1).max(2000).optional(),
    acaoRapida: z
      .enum([
        "VERIFICAR_ESTOQUE",
        "RESUMIR_VENDAS",
        "RESUMIR_GASTOS",
        "VERIFICAR_RECEBIVEIS",
      ])
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

const dinheiro = z.number().finite();
const vendasSchema = z.object({ tipo: z.literal("VENDAS"), valorTotalValido: dinheiro,
  quantidadeVendas: z.number().int().nonnegative(), ticketMedio: dinheiro,
  quantidadeItens: z.number().int().nonnegative() }).strict();
const gastosSchema = z.object({ tipo: z.literal("GASTOS"), totalGastos: dinheiro,
  quantidadeLancamentos: z.number().int().nonnegative() }).strict();
const faixaSchema = z.object({ valor: dinheiro, quantidade: z.number().int().nonnegative() }).strict();
const recebiveisSchema = z.object({ tipo: z.literal("RECEBIVEIS"), totalEmAberto: dinheiro,
  totalVencido: dinheiro, totalAVencer: dinheiro, quantidadeCobrancas: z.number().int().nonnegative(),
  atraso1a7Dias: faixaSchema, atraso8a30Dias: faixaSchema, atrasoAcima30Dias: faixaSchema }).strict();
const estoqueSchema = z.object({ tipo: z.literal("ESTOQUE"), criterio: z.string(),
  itensAvaliados: z.number().int().nonnegative(), itensCriticos: z.number().int().nonnegative(),
  dadosInsuficientes: z.number().int().nonnegative(), itens: z.array(z.object({ nome: z.string(),
    unidade: z.string(), quantidadeAtual: dinheiro, estoqueMinimo: dinheiro }).strict()) }).strict();
const custoSchema = z.object({ tipo: z.literal("CUSTO_PRODUTO"), produtoId: z.number().int().nullable(),
  custoAtualConhecido: dinheiro.nullable(), custoUnitarioFicha: dinheiro.nullable(),
  rendimentoBase: dinheiro.nullable(), componentes: z.number().int().nonnegative(),
  componentesSemCusto: z.number().int().nonnegative(), dataBaseCusto: z.string().datetime({ offset: true }).nullable() }).strict();
const itemCompraSchema = z.object({ materiaPrimaId: z.number().int().positive(), unidade: z.string(),
  quantidadeTotal: dinheiro, valorTotal: dinheiro, precoMedioPonderado: dinheiro.nullable(),
  menorPreco: dinheiro.nullable(), maiorPreco: dinheiro.nullable(), amplitudePrecoPercentual: dinheiro.nullable(),
  quantidadeCompras: z.number().int().nonnegative(), quantidadeMediaPorCompra: dinheiro.nullable(),
  primeiraCompra: z.string().date().nullable(), ultimaCompra: z.string().date().nullable(),
  intervaloMedioDias: z.number().int().positive().nullable(),
  frequenciaObservada: z.enum(["SEMANAL", "QUINZENAL", "MENSAL", "ESPORADICA", "INSUFICIENTE"]),
  historicoSuficiente: z.boolean() }).strict();
const comprasSchema = z.object({ tipo: z.literal("COMPRAS_INSUMO"), materiaPrimaId: z.number().int().positive().nullable(),
  valorTotal: dinheiro, insumosAnalisados: z.number().int().nonnegative(), itens: z.array(itemCompraSchema),
  simulacaoMensal: z.object({ pedidosSimulados: z.number().int().positive(), custoHistorico: dinheiro,
    custoSimuladoSemDesconto: dinheiro, economiaComprovada: dinheiro, economiaComprovavel: z.boolean(),
    limitacao: z.string() }).strict() }).strict();
const ofertaMercadoSchema = z.object({ titulo: z.string(), url: z.string().url(), dominio: z.string(),
  precoUnitario: dinheiro, quantidadeCalculada: dinheiro, custoTotal: dinheiro,
  freteIncluido: z.boolean(), pedidoMinimo: dinheiro.nullable(), compativelQuantidadeAlvo: z.boolean(),
  localizacao: z.string().nullable(), validade: z.string().date().nullable(), evidenciaPreco: z.string(), evidenciaPedidoMinimo: z.string().nullable(),
  confianca: z.enum(["ALTA", "MEDIA"]) }).strict();
const comparacaoMercadoSchema = z.object({ tipo: z.literal("COMPARACAO_MERCADO"),
  materiaPrimaId: z.number().int().positive().nullable(), unidade: z.string(), quantidadeAlvo: dinheiro,
  precoInternoUnitario: dinheiro.nullable(), custoInternoComparavel: dinheiro.nullable(),
  menorCustoExterno: dinheiro.nullable(), economiaEstimada: dinheiro.nullable(),
  diferencaExternaMenosInterna: dinheiro.nullable(), percentualDiferenca: dinheiro.nullable(),
  situacao: z.enum(["CUSTO_INTERNO_MENOR","OFERTA_EXTERNA_MENOR","EQUIVALENTE","INSUFICIENTE"]),
  pesquisadoEm: z.string().datetime({ offset: true }),
  ofertas: z.array(ofertaMercadoSchema).max(5) }).strict();
const comparacaoFinanceiraSchema = z.object({ tipo: z.literal("COMPARACAO_VENDAS_GASTOS"),
  vendas: vendasSchema, gastos: gastosSchema, comparacao: z.object({ vendas: dinheiro, gastos: dinheiro,
    diferenca: dinheiro, percentualVendasSobreGastos: dinheiro.nullable() }).strict() }).strict();
const periodoVendasSchema = z.object({ inicio: z.string().date(), fim: z.string().date(), dados: vendasSchema }).strict();
const comparacaoTemporalSchema = z.object({ tipo: z.literal("COMPARACAO_VENDAS_PERIODOS"),
  periodoAnterior: periodoVendasSchema, periodoAtual: periodoVendasSchema,
  comparacao: z.object({ vendasPeriodoAnterior: dinheiro, vendasPeriodoAtual: dinheiro, diferenca: dinheiro,
    variacaoPercentual: dinheiro.nullable(), diasPeriodoAnterior: z.number().int().positive(),
    diasPeriodoAtual: z.number().int().positive(), coberturaEquivalente: z.boolean() }).strict() }).strict();
const dadosSchema = z.discriminatedUnion("tipo", [estoqueSchema, vendasSchema, gastosSchema,
  recebiveisSchema, custoSchema, comprasSchema, comparacaoFinanceiraSchema, comparacaoTemporalSchema,
  comparacaoMercadoSchema]);

const respostaSchema = z
  .object({
    resposta: z.string(),
    versaoContrato: z.literal(ASSISTENTE_CONTRACT_VERSION),
    status: z.enum(["SUCESSO", "PARCIAL", "ERRO"]),
    dados: dadosSchema.nullable(),
    acoesSugeridas: z.array(z.object({ codigo: z.string(), rotulo: z.string() }).strict()).default([]),
    origem: z.enum(["ASSISTENTE", "CAMINHO_RAPIDO", "ORQUESTRADOR"]),
    avisos: z.array(z.string()).default([]),
    qualidade: z.enum(["COMPLETO", "PARCIAL", "INDISPONIVEL", "INSUFICIENTE", "INCOMPATIVEL"]),
    correlacao: z.string().nullable().optional(),
    periodoInicio: z.string().date().nullable().optional(),
    periodoFim: z.string().date().nullable().optional(),
    atualizadoEm: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export type MensagemConversa = z.infer<typeof conversaSchema>["historico"][number];
export type AssistenteResposta = z.infer<typeof respostaSchema>;
export type AcaoRapidaAssistente = NonNullable<z.infer<typeof conversaSchema>["acaoRapida"]>;

export function mensagemProgressoAssistente(segundos: number): string {
  if (segundos >= 30) return "A consulta está demorando um pouco, mas continua em andamento.";
  if (segundos >= 15) return "Ainda estou trabalhando na análise. Algumas fontes externas podem levar mais tempo.";
  if (segundos >= 5) return "Consultando e conferindo os dados. Aguarde mais um pouco...";
  return "Analisando sua pergunta...";
}

export async function conversarComAssistente(data: {
  mensagem?: string;
  acaoRapida?: AcaoRapidaAssistente;
  historico: MensagemConversa[];
  contextoTela?: { rota?: string; recurso?: string };
  correlacao?: string;
}): Promise<AssistenteResposta> {
  const parsedData = conversaSchema.parse(data);
<<<<<<< HEAD
  const controller = new AbortController();
  // Pesquisa externa inclui descoberta, estruturação e redação; o backend mantém limites próprios por etapa.
  const timeout = globalThis.setTimeout(() => controller.abort(), 130_000);
  let response: unknown;
=======

>>>>>>> 06db426 (feat: adiciona segurança RLS)
  try {
    response = await apiRequest<unknown>("/assistente/conversa", {
      method: "POST",
      body: JSON.stringify(parsedData),
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
  return respostaSchema.parse(response);
}

<<<<<<< HEAD
export function mensagemErroAssistente(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message.includes("conectar ao servidor")
      ? "Não consegui acessar os dados agora. Verifique sua conexão e tente novamente."
      : "Ocorreu um erro temporário. Tente novamente em instantes.";
  }
  if (error.status === 403 || error.code === "NAO_AUTORIZADO")
    return "Você não tem permissão para fazer esta consulta.";
  if (error.code === "LIMITE_EXCEDIDO")
    return "O limite de consultas foi atingido. Aguarde um pouco e tente novamente.";
  if (error.code === "TIMEOUT") return "A consulta demorou mais que o esperado. Tente novamente.";
  if (error.code === "PLANO_INVALIDO")
    return "Esta consulta ainda não está disponível.";
  if (error.code === "PROVEDOR_INDISPONIVEL" || error.status === 503)
    return "A assistente está temporariamente indisponível. As consultas rápidas podem ser tentadas novamente.";
  if (
    error.code === "ENTRADA_INVALIDA" ||
    error.code === "ARGUMENTOS_INVALIDOS" ||
    error.status === 400
  )
    return "Não consegui entender essa consulta. Escolha uma opção rápida ou escreva de outra forma.";
  return "Ocorreu um erro temporário. Tente novamente em instantes.";
=======
function obterMockConversa(mensagem: string): string {
  const msg = mensagem.toLowerCase();
  if (msg.includes("lucro") || msg.includes("faturamento") || msg.includes("ganh") || msg.includes("rend") || msg.includes("financeiro")) {
    return "Oi, meu bem! Como a IA do servidor está offline, eu peguei minhas anotações rápidas para você:\n\n" +
           "- **Faturamento Total**: R$ 1.500,00\n" +
           "- **Custos Estimados**: R$ 600,00\n" +
           "- **Lucro Líquido Estimado**: R$ 900,00\n\n" +
           "Fique à vontade para me perguntar sobre estoque ou receitas, querido!";
  } else if (msg.includes("estoque") || msg.includes("falta") || msg.includes("compr") || msg.includes("ingrediente")) {
    return "Meu filho, dei uma olhada rápida nas prateleiras:\n\n" +
           "- 🥜 **Amendoim**: Baixo (restam apenas 2kg)\n" +
           "- 🥛 **Leite**: Ok (restam 15L)\n" +
           "- 🍬 **Açúcar**: Ok (restam 10kg)\n\n" +
           "Recomendo comprar mais amendoim em breve para não interromper a produção, meu bem!";
  }
  
  return "Oi, querido! Eu sou a Vovó AI. A IA do servidor está temporariamente indisponível no momento, mas você pode me perguntar sobre o **estoque** ou o **lucro** estimado que eu te mostro os dados simulados que tenho aqui com o maior carinho! 💛";
>>>>>>> 06db426 (feat: adiciona segurança RLS)
}

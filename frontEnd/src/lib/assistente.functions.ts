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
const margemProdutoSchema = z.object({ tipo: z.literal("MARGEM_PRODUTO"), produtoId: z.number().int().nullable(),
  produto: z.string(), quantidadeProduzida: dinheiro.nullable(), custoProducaoConhecido: dinheiro.nullable(),
  custoUnitarioConhecido: dinheiro.nullable(), quantidadeVendida: dinheiro.nullable(), receitaVendas: dinheiro.nullable(),
  precoMedioVenda: dinheiro.nullable(), margemBrutaConhecidaUnitaria: dinheiro.nullable(),
  margemBrutaConhecidaTotal: dinheiro.nullable(),
  situacao: z.enum(["INSUFICIENTE", "MARGEM_CONHECIDA_NEGATIVA", "MARGEM_CONHECIDA_POSITIVA", "MARGEM_CONHECIDA_ZERO"]),
  componentes: z.array(z.object({ nome: z.string(), custoConhecido: dinheiro,
    participacaoPercentual: dinheiro.nullable() }).strict()), custosNaoModelados: z.array(z.string()) }).strict();
const modalidadeRentabilidadeSchema = z.object({
  tipo: z.enum(["UNIDADE", "CAIXA", "PACOTE", "DUZIA", "PESO", "POTE"]),
  unidadesPorModalidade: dinheiro.nullable(), preco: dinheiro.nullable(),
  precoEquivalenteUnidade: dinheiro.nullable(), margemConhecidaUnidade: dinheiro.nullable(),
  margemPercentual: dinheiro.nullable(), quantidadeVendidaUnidades: dinheiro,
  receita: dinheiro, fonte: z.enum(["VENDAS_REAIS", "PRECO_CADASTRADO", "PERGUNTA"]),
}).strict();
const componenteRentabilidadeSchema = z.object({ nome: z.string(), custoConhecido: dinheiro,
  percentual: dinheiro.nullable() }).strict();
const referenciaRentabilidadeSchema = z.object({ nome: z.string(), url: z.string().url(),
  precoEquivalenteUnidade: dinheiro, comparabilidade: z.enum(["ALTA", "MEDIA", "BAIXA"]),
  segmento: z.enum(["REGIONAL", "ONLINE", "ATACADO"]), evidencia: z.string().nullable() }).strict();
const referenciaCustoIndiretoSchema = z.object({ nome: z.string(), url: z.string().url(),
  percentualReceita: dinheiro, evidencia: z.string() }).strict();
const componenteCustoIndiretoSchema = z.object({ nome: z.string(), menorPercentual: dinheiro,
  medianaPercentual: dinheiro, maiorPercentual: dinheiro, base: z.literal("RECEITA"),
  valorEstimadoUnidade: dinheiro.nullable(), referenciasValidas: z.number().int().min(2),
  confianca: z.enum(["ALTA", "MEDIA"]), referencias: z.array(referenciaCustoIndiretoSchema).min(2).max(5) }).strict();
const estimativaCustosIndiretosSchema = z.object({
  status: z.enum(["CALCULADA", "PARCIAL", "DADOS_INSUFICIENTES", "INDISPONIVEL"]),
  criterio: z.literal("MEDIANA_REFERENCIAS_EXTERNAS"), precoBaseUnidade: dinheiro.nullable(),
  custoIndiretoEstimadoUnidade: dinheiro.nullable(), custoTotalEstimadoUnidade: dinheiro.nullable(),
  margemEstimadaUnidade: dinheiro.nullable(), margemEstimadaPercentual: dinheiro.nullable(),
  componentes: z.array(componenteCustoIndiretoSchema).max(5), custosNaoEstimados: z.array(z.string()),
  aviso: z.string(),
}).strict();
const rentabilidadeProdutoSchema = z.object({
  tipo: z.literal("RENTABILIDADE_PRODUTO"), produtoId: z.number().int().positive(), produto: z.string(),
  periodoInicio: z.string().date(), periodoFim: z.string().date(),
  custo: z.object({ custoConhecidoUnidade: dinheiro.nullable(), custoProducaoConhecido: dinheiro,
    quantidadeProduzida: dinheiro, criterio: z.enum(["MEDIA_PONDERADA_PRODUCOES_PERIODO",
      "CUSTO_ATUAL_CADASTRADO", "SEM_CUSTO_CONHECIDO"]), custosConsiderados: z.array(z.string()),
    custosNaoDisponiveis: z.array(z.string()), componentes: z.array(componenteRentabilidadeSchema) }).strict(),
  vendas: z.object({ precoCadastradoUnidade: dinheiro.nullable(), quantidadeVendida: dinheiro,
    receita: dinheiro, precoMedioReal: dinheiro.nullable(), menorPrecoReal: dinheiro.nullable(),
    maiorPrecoReal: dinheiro.nullable(), itensVenda: z.number().int().nonnegative(),
    modalidades: z.array(modalidadeRentabilidadeSchema) }).strict(),
  modalidades: z.array(modalidadeRentabilidadeSchema), principalComponenteCusto: componenteRentabilidadeSchema.nullable(),
  mercado: z.object({ menorPrecoComparavel: dinheiro.nullable(), mediana: dinheiro.nullable(),
    maiorPrecoComparavel: dinheiro.nullable(), referenciasValidas: z.number().int().nonnegative(),
    posicao: z.enum(["ABAIXO_DA_FAIXA", "DENTRO_DA_FAIXA", "ACIMA_DA_FAIXA", "DADOS_INSUFICIENTES"]),
    pesquisadoEm: z.string().datetime({ offset: true }).nullable(), referencias: z.array(referenciaRentabilidadeSchema),
    aviso: z.string().nullable() }).strict(),
  estimativaCustosIndiretos: estimativaCustosIndiretosSchema,
  situacao: z.enum(["INFORMACAO_NECESSARIA", "DADOS_INSUFICIENTES", "MODALIDADES_DIVERGENTES",
    "MARGEM_CONHECIDA_NEGATIVA", "MARGEM_CONHECIDA_POSITIVA"]), informacaoNecessaria: z.string().nullable(),
}).strict();
const analiseCompostaSchema = z.object({ tipo: z.literal("ANALISE_COMPOSTA"),
  resultados: z.record(z.string(), z.unknown()) }).strict();
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
  confianca: z.enum(["ALTA", "MEDIA"]), mesesCoberturaPedidoMinimo: dinheiro.nullable(),
  status: z.array(z.enum(["COMPATIVEL_COM_QUANTIDADE", "PEDIDO_MINIMO_ACIMA_DA_QUANTIDADE",
    "ESTOQUE_EXCESSIVO_PROVAVEL", "FRETE_DESCONHECIDO", "FRETE_ALTO", "INFORMACOES_INSUFICIENTES"])),
  marca: z.string().nullable(), fornecedor: z.string().nullable() }).strict();
const metricasHistoricasSchema = z.object({ ultimaCompraPreco: dinheiro.nullable(), ultimaCompraData: z.string().date().nullable(),
  media30Dias: dinheiro.nullable(), media90Dias: dinheiro.nullable(), media6Meses: dinheiro.nullable(),
  menorPreco6Meses: dinheiro.nullable(), maiorPreco6Meses: dinheiro.nullable(), quantidade6Meses: dinheiro.nullable(),
  consumoMedioMensal: dinheiro.nullable(), tendencia: z.string() }).strict();
const fonteMercadoSchema = z.object({ fonteId: z.string(), titulo: z.string(), url: z.string().url(),
  dominio: z.string(), status: z.enum(["VALIDADA", "REJEITADA", "NAO_CONCLUIDA"]), motivo: z.string().nullable() }).strict();
const comparacaoMercadoSchema = z.object({ tipo: z.literal("COMPARACAO_MERCADO"),
  materiaPrimaId: z.number().int().positive().nullable(), materiaPrima: z.string().min(1),
  unidade: z.string(), quantidadeAlvo: dinheiro.nullable(),
  precoInternoUnitario: dinheiro.nullable(), custoInternoComparavel: dinheiro.nullable(),
  menorCustoExterno: dinheiro.nullable(), economiaEstimada: dinheiro.nullable(),
  diferencaExternaMenosInterna: dinheiro.nullable(), percentualDiferenca: dinheiro.nullable(),
  situacao: z.enum(["CUSTO_INTERNO_MENOR","OFERTA_EXTERNA_MENOR","EQUIVALENTE","INSUFICIENTE","SOMENTE_PEDIDO_MINIMO_MAIOR"]),
  pesquisadoEm: z.string().datetime({ offset: true }),
  metricasHistoricas: metricasHistoricasSchema.nullable(),
  fontes: z.array(fonteMercadoSchema).max(5).default([]),
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
  recebiveisSchema, custoSchema, margemProdutoSchema, rentabilidadeProdutoSchema, analiseCompostaSchema, comprasSchema,
  comparacaoFinanceiraSchema, comparacaoTemporalSchema, comparacaoMercadoSchema]);

const respostaSchema = z
  .object({
    resposta: z.string(),
    versaoContrato: z.literal(ASSISTENTE_CONTRACT_VERSION),
    status: z.enum(["SUCESSO", "PARCIAL", "ERRO"]),
    dados: dadosSchema.nullable(),
    acoesSugeridas: z.array(z.object({ codigo: z.string(), rotulo: z.string() }).strict()).default([]),
    origem: z.enum(["ASSISTENTE", "CAMINHO_RAPIDO", "ORQUESTRADOR", "FALLBACK"]),
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
  const controller = new AbortController();
  // Pesquisa externa inclui descoberta, estruturação e redação; o backend mantém limites próprios por etapa.
  const timeout = globalThis.setTimeout(() => controller.abort(), 360_000);
  let response: unknown;
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
}

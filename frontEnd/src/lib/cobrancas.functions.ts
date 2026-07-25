import { apiRequest } from "@/lib/api-client";
import type { FiltroParcelamento, FormaPagamentoApi } from "@/lib/vendas-modulo.functions";

export type SituacaoCobranca = "EM_DIA" | "ATRASO_RECENTE" | "ATRASO_MEDIO" | "MUITO_ATRASADO";

export type OrdenacaoCobranca =
  | "vencimentoAntigo"
  | "vencimentoProximo"
  | "maiorAtraso"
  | "maiorValor"
  | "menorValor"
  | "cliente";

export type ItemCobranca = {
  id: number;
  produtoId: number;
  produtoNome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

export type Cobranca = {
  id: number;
  clienteId: number | null;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteEmail: string | null;
  descricao: string | null;
  dataVenda: string;
  dataVencimento: string;
  valor: number;
  formaPagamento: FormaPagamentoApi | null;
  parcelas: number | null;
  diasAtraso: number;
  situacao: SituacaoCobranca;
  gestorNome: string | null;
  itens: ItemCobranca[];
};

export type FiltrosCobranca = {
  pagina: number;
  tamanho?: number;
  ordenarPor: OrdenacaoCobranca;
  busca?: string;
  clienteId?: string;
  produtoId?: string;
  inicio?: string;
  fim?: string;
  situacao?: SituacaoCobranca | "";
  forma?: FormaPagamentoApi | "";
  parcelamento?: FiltroParcelamento;
};

export type PaginaCobrancas = {
  registros: Cobranca[];
  paginaAtual: number;
  tamanhoPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  temAnterior: boolean;
  temProxima: boolean;
};

export type ResumoCobrancas = {
  totalReceber: number;
  totalVencido: number;
  totalEmDia: number;
  quantidadeAtrasadas: number;
  quantidadeCobrancas: number;
};

function parametros(filtros: Omit<FiltrosCobranca, "pagina" | "tamanho" | "ordenarPor">) {
  const params = new URLSearchParams();
  if (filtros.busca?.trim()) params.set("busca", filtros.busca.trim());
  if (filtros.clienteId) params.set("clienteId", filtros.clienteId);
  if (filtros.produtoId) params.set("produtoId", filtros.produtoId);
  if (filtros.inicio) params.set("inicio", filtros.inicio);
  if (filtros.fim) params.set("fim", filtros.fim);
  if (filtros.situacao) params.set("situacao", filtros.situacao);
  if (filtros.forma) params.set("forma", filtros.forma);
  if (filtros.parcelamento) {
    params.set("parcelada", String(filtros.parcelamento === "parceladas"));
  }
  return params;
}

export function listarCobrancas(filtros: FiltrosCobranca) {
  const params = parametros(filtros);
  params.set("pagina", String(filtros.pagina));
  params.set("tamanho", String(filtros.tamanho ?? 12));
  params.set("ordenarPor", filtros.ordenarPor);
  return apiRequest<PaginaCobrancas>(`/vendas/cobrancas?${params}`);
}

export function resumirCobrancas(
  filtros: Omit<FiltrosCobranca, "pagina" | "tamanho" | "ordenarPor">,
) {
  return apiRequest<ResumoCobrancas>(`/vendas/cobrancas/resumo?${parametros(filtros)}`);
}

export function confirmarPagamentoCobranca(id: number) {
  return apiRequest(`/vendas/${id}/confirmar-pagamento`, { method: "POST" });
}

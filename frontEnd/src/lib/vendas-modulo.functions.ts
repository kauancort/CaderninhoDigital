import { apiRequest } from "@/lib/api-client";

export type StatusPagamentoApi = "PAGO" | "PENDENTE" | "ATRASADO" | "NAO_SE_APLICA";
export type FormaPagamentoApi = "DINHEIRO" | "PIX" | "CARTAO" | "BOLETO" | "CHEQUE" | "OUTRO";
export type FiltroParcelamento = "" | "parceladas" | "nao-parceladas";

export type FiltrosHistoricoVendas = {
  pagina: number;
  tamanho?: number;
  busca?: string;
  clienteId?: string;
  produtoId?: string;
  inicio?: string;
  fim?: string;
  status?: StatusPagamentoApi | "";
  forma?: FormaPagamentoApi | "";
  parcelamento?: FiltroParcelamento;
  ordenarPor?: "dataVenda" | "valorTotal" | "cliente" | "statusPagamento";
  direcao?: "ASC" | "DESC";
};

export type VendaHistoricoItem = {
  id: number;
  dataVenda: string;
  clienteId: number | null;
  clienteNome: string;
  quantidadeItens: number;
  valorTotal: number;
  formaPagamento: FormaPagamentoApi | null;
  parcelas: number | null;
  statusPagamento: StatusPagamentoApi;
  emAtraso: boolean;
};

export type PaginaHistoricoVendas = {
  registros: VendaHistoricoItem[];
  paginaAtual: number;
  tamanhoPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  temAnterior: boolean;
  temProxima: boolean;
};

export type ResumoHistoricoVendas = {
  faturamento: number;
  quantidadeVendas: number;
  quantidadeItens: number;
  ticketMedio: number;
};

export type VendaDetalhes = {
  id: number;
  clienteId: number | null;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteEmail: string | null;
  clienteDocumento: string | null;
  dataVenda: string;
  formaPagamento: FormaPagamentoApi | null;
  statusPagamento: StatusPagamentoApi;
  valorTotal: number;
  observacao: string | null;
  dataVencimento: string | null;
  tipoCartao: "CREDITO" | "DEBITO" | null;
  parcelas: number | null;
  emAtraso: boolean;
  gestorNome: string | null;
  contatos: Array<{ data: string; tipo: string; resposta: string | null }>;
  criadoEm: string;
  itens: Array<{
    id: number;
    produtoId: number;
    produtoNome: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
};

function parametrosHistorico(filtros: Omit<FiltrosHistoricoVendas, "pagina" | "tamanho">) {
  const params = new URLSearchParams();
  if (filtros.busca?.trim()) params.set("busca", filtros.busca.trim());
  if (filtros.clienteId) params.set("clienteId", filtros.clienteId);
  if (filtros.produtoId) params.set("produtoId", filtros.produtoId);
  if (filtros.inicio) params.set("inicio", filtros.inicio);
  if (filtros.fim) params.set("fim", filtros.fim);
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.forma) params.set("forma", filtros.forma);
  if (filtros.parcelamento) {
    params.set("parcelada", String(filtros.parcelamento === "parceladas"));
  }
  if (filtros.ordenarPor) params.set("ordenarPor", filtros.ordenarPor);
  if (filtros.direcao) params.set("direcao", filtros.direcao);
  return params;
}

export function listarHistoricoVendas(filtros: FiltrosHistoricoVendas) {
  const params = parametrosHistorico(filtros);
  params.set("pagina", String(filtros.pagina));
  params.set("tamanho", String(filtros.tamanho ?? 15));
  return apiRequest<PaginaHistoricoVendas>(`/vendas/historico?${params}`);
}

export function resumirHistoricoVendas(
  filtros: Omit<FiltrosHistoricoVendas, "pagina" | "tamanho">,
) {
  const params = parametrosHistorico(filtros);
  params.delete("ordenarPor");
  params.delete("direcao");
  return apiRequest<ResumoHistoricoVendas>(`/vendas/historico/resumo?${params}`);
}

export function buscarVendaDetalhes(id: number) {
  return apiRequest<VendaDetalhes>(`/vendas/${id}/detalhes`);
}

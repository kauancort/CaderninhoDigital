import { apiRequest } from "@/lib/api-client";

export type TipoItemEstoque = "PRODUTO" | "MATERIA_PRIMA";
export type TipoMovimentacaoEstoque = "ENTRADA" | "SAIDA" | "AJUSTE";
export type OrigemMovimentacaoEstoque =
  "CADASTRO" | "COMPRA" | "PRODUCAO" | "VENDA" | "AJUSTE_MANUAL" | "REMOCAO_MANUAL";

export type MovimentacaoEstoque = {
  id: number;
  tipoItem: TipoItemEstoque;
  itemId: number;
  itemNome: string;
  unidadeMedida: string;
  tipoMovimentacao: TipoMovimentacaoEstoque;
  origem: OrigemMovimentacaoEstoque;
  origemId: number | null;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  usuarioId: number;
  usuarioNome: string;
  observacao: string | null;
  ocorridoEm: string;
};

export type PaginaMovimentacoes = {
  content: MovimentacaoEstoque[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
};

export type FiltrosMovimentacao = {
  inicio?: string;
  fim?: string;
  usuarioId?: string;
  tipo?: TipoMovimentacaoEstoque | "";
  origem?: string;
  tipoItem?: TipoItemEstoque | "";
  itemId?: string;
  pagina: number;
  ordem: "ASC" | "DESC";
};

export function listarMovimentacoes(filtros: FiltrosMovimentacao) {
  const params = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanho: "20",
    ordem: filtros.ordem,
  });
  if (filtros.inicio) params.set("inicio", filtros.inicio);
  if (filtros.fim) params.set("fim", filtros.fim);
  if (filtros.usuarioId) params.set("usuarioId", filtros.usuarioId);
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  if (filtros.origem) params.set("origem", filtros.origem);
  if (filtros.tipoItem) params.set("tipoItem", filtros.tipoItem);
  if (filtros.itemId) params.set("itemId", filtros.itemId);
  return apiRequest<PaginaMovimentacoes>(`/estoque/movimentacoes?${params}`);
}

export type ResumoMovimentacoes = {
  quantidadeMovimentacoes: number;
  entradas: number;
  saidas: number;
  ajustes: number;
};
export function resumirMovimentacoes(filtros: Omit<FiltrosMovimentacao, "pagina" | "ordem">) {
  const params = new URLSearchParams();
  if (filtros.inicio) params.set("inicio", filtros.inicio);
  if (filtros.fim) params.set("fim", filtros.fim);
  if (filtros.usuarioId) params.set("responsavelId", filtros.usuarioId);
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  if (filtros.origem) params.set("origem", filtros.origem);
  if (filtros.tipoItem) params.set("tipoItem", filtros.tipoItem);
  if (filtros.itemId) params.set("itemId", filtros.itemId);
  return apiRequest<ResumoMovimentacoes>(`/estoque/movimentacoes/resumo?${params}`);
}

export function listarUsuariosMovimentacao() {
  return apiRequest<Array<{ id: number; nome: string }>>("/estoque/movimentacoes/usuarios");
}

export type CompraMateriaPrimaDetalhes = {
  id: number;
  fornecedorId: number | null;
  fornecedorNome: string | null;
  dataCompra: string;
  formaPagamento: string | null;
  statusPagamento: string;
  valorTotal: number;
  observacao: string | null;
  criadoEm: string;
  itens: Array<{
    id: number;
    materiaPrimaId: number;
    materiaPrimaNome: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
};

export function buscarCompraMateriaPrima(id: number) {
  return apiRequest<CompraMateriaPrimaDetalhes>(`/compras-materias-primas/${id}`);
}

export function removerMateriaPrima(id: number, motivo?: string) {
  const params = new URLSearchParams();
  if (motivo?.trim()) params.set("motivo", motivo.trim());
  const query = params.size ? `?${params}` : "";
  return apiRequest<void>(`/materias-primas/${id}${query}`, { method: "DELETE" });
}

export function removerProduto(id: number, motivo?: string) {
  const params = new URLSearchParams();
  if (motivo?.trim()) params.set("motivo", motivo.trim());
  const query = params.size ? `?${params}` : "";
  return apiRequest<void>(`/produtos/${id}${query}`, { method: "DELETE" });
}

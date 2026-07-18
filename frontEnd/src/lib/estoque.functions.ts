import { apiRequest } from "@/lib/api-client";

export type TipoItemEstoque = "PRODUTO" | "MATERIA_PRIMA";
export type TipoMovimentacaoEstoque = "ENTRADA" | "SAIDA" | "AJUSTE";

export type MovimentacaoEstoque = {
  id: number;
  tipoItem: TipoItemEstoque;
  itemId: number;
  itemNome: string;
  unidadeMedida: string;
  tipoMovimentacao: TipoMovimentacaoEstoque;
  origem: "CADASTRO" | "COMPRA" | "PRODUCAO" | "VENDA" | "AJUSTE_MANUAL";
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
  if (filtros.tipoItem) params.set("tipoItem", filtros.tipoItem);
  if (filtros.itemId) params.set("itemId", filtros.itemId);
  return apiRequest<PaginaMovimentacoes>(`/estoque/movimentacoes?${params}`);
}

export function listarUsuariosMovimentacao() {
  return apiRequest<Array<{ id: number; nome: string }>>("/estoque/movimentacoes/usuarios");
}

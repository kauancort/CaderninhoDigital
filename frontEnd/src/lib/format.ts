export const fmtBRL = (n: number) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export const fmtDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export type CategoriaGasto =
  "materia-prima" | "embalagens" | "energia" | "aluguel" | "transporte" | "outros";

export const categoriaLabel: Record<CategoriaGasto, string> = {
  "materia-prima": "Matéria-prima",
  embalagens: "Embalagens",
  energia: "Energia",
  aluguel: "Aluguel",
  transporte: "Transporte",
  outros: "Outros",
};

export type FormaPagamento = "dinheiro" | "pix" | "cartao" | "boleto" | "cheque" | "outro";
export type StatusPagamento = "PAGO" | "PENDENTE" | "ATRASADO" | "NAO_SE_APLICA";

export const hojeISO = () => new Date().toISOString().slice(0, 10);

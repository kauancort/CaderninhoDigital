export const fmtBRL = (n: number) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dataParaExibicao(iso: string) {
  const somenteData = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!somenteData) return new Date(iso);
  return new Date(Number(somenteData[1]), Number(somenteData[2]) - 1, Number(somenteData[3]));
}

export const fmtDate = (iso: string) =>
  dataParaExibicao(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

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

export const hojeISO = () => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

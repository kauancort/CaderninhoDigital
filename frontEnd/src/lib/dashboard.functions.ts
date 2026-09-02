import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";

export function dataLocalParaIso(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function normalizarDataVenda(data: unknown): string {
  return typeof data === "string" ? data.slice(0, 10) : "";
}

export const obterDashboard = createApiFn({ method: "GET" }).handler(async () => {
  const hoje = new Date();
  const todayStr = dataLocalParaIso(hoje);
  const firstDayStr = dataLocalParaIso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  // 1. Fetch dashboard summaries
  const [resumoHojeRes, resumoMesRes] = await Promise.all([
    fetch(`${BASE_URL}/dashboard/resumo?inicio=${todayStr}&fim=${todayStr}`, {}),
    fetch(`${BASE_URL}/dashboard/resumo?inicio=${firstDayStr}&fim=${todayStr}`, {}),
  ]);

  let totalHoje = 0;
  let totalMes = 0;
  let producaoHoje = 0;
  let custoMes = 0;

  if (resumoHojeRes.ok) {
    const summaryHoje = await resumoHojeRes.json();
    totalHoje = summaryHoje.totalVendas || 0;
    producaoHoje = summaryHoje.totalProducao || 0;
  }

  if (resumoMesRes.ok) {
    const summaryMes = await resumoMesRes.json();
    totalMes = Number(summaryMes.totalVendas || 0);
    custoMes = (summaryMes.totalGastosGerais || 0) + (summaryMes.totalComprasProduto || 0);
  }

  // 2. Fetch raw materials to check stock levels
  const mpRes = await fetch(`${BASE_URL}/materias-primas`, {});
  let estoqueAlerta = null;
  let qtdBaixos = 0;

  if (mpRes.ok) {
    const mps = await mpRes.json();
    const baixos = mps
      .filter((i: any) => Number(i.estoqueAtual) <= Number(i.estoqueMinimo))
      .sort(
        (a: any, b: any) =>
          Number(a.estoqueAtual) / Math.max(0.01, Number(a.estoqueMinimo)) -
          Number(b.estoqueAtual) / Math.max(0.01, Number(b.estoqueMinimo)),
      );
    qtdBaixos = baixos.length;
    if (baixos[0]) {
      estoqueAlerta = {
        nome: baixos[0].nome,
        unidade: baixos[0].unidadeMedida,
        estoque: Number(baixos[0].estoqueAtual),
        estoqueMinimo: Number(baixos[0].estoqueMinimo),
      };
    }
  }

  // 3. Fetch sales to construct weekly chart and list latest sales
  const salesRes = await fetch(`${BASE_URL}/vendas`, {});

  let ultimasVendas: any[] = [];
  let salesList: any[] = [];
  let vendasAReceber = 0;
  let valorAReceber = 0;
  let vendasAguardandoEstoque = 0;

  if (salesRes.ok) {
    const salesBody = await salesRes.json();
    salesList = Array.isArray(salesBody) ? salesBody : [];
    vendasAReceber = salesList.filter(
      (v: any) => v.statusPagamento === "PENDENTE" || v.statusPagamento === "ATRASADO",
    ).length;
    valorAReceber = salesList
      .filter((v: any) => v.statusPagamento === "PENDENTE" || v.statusPagamento === "ATRASADO")
      .reduce((sum: number, v: any) => sum + Number(v.valorTotal || 0), 0);
    vendasAguardandoEstoque = salesList.filter((v: any) => Boolean(v.aguardandoEstoque)).length;
    // latest sales
    ultimasVendas = salesList.slice(0, 5).map((v: any) => ({
      id: String(v.id),
      comprador: v.clienteNome || "Cliente Avulso",
      data: v.dataVenda,
      valor: Number(v.valorTotal || 0),
      status: v.statusPagamento || "NAO_SE_APLICA",
      emAtraso: Boolean(v.emAtraso),
      resumo:
        (v.itens || [])
          .map((it: any) => `${Number(it.quantidade)}× ${it.produtoNome || "item"}`)
          .join(", ") || "—",
    }));
  }

  // series of the last 7 days
  const dias = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateKey = dataLocalParaIso(d);
    const total = salesList
      .filter((v: any) => normalizarDataVenda(v.dataVenda) === dateKey)
      .reduce((sum: number, v: any) => sum + Number(v.valorTotal || 0), 0);

    return {
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      total,
      isHoje: dateKey === todayStr,
    };
  });

  return {
    totalHoje,
    totalMes,
    custoMes,
    producaoHoje,
    estoqueAlerta,
    qtdBaixos,
    vendasAReceber,
    valorAReceber,
    vendasAguardandoEstoque,
    dias,
    ultimasVendas,
  };
});

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listarVendas } from "@/lib/vendas.functions";
import { fmtBRL, fmtDateTime, type FormaPagamento } from "@/lib/format";
import { ReceiptText } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/vendas")({
  component: () => (
    <AppShell>
      <Vendas />
    </AppShell>
  ),
});

type StatusPagamento = "PAGO" | "PENDENTE" | "ATRASADO" | "NAO_SE_APLICA";

function Vendas() {
  const { data: vendas = [] } = useQuery({ queryKey: ["vendas"], queryFn: () => listarVendas() });
  const [filtro, setFiltro] = useState<"todas" | "hoje" | "semana">("todas");

  const hoje = new Date().toDateString();
  const sete = Date.now() - 7 * 86400000;

  const filtradas = vendas.filter((v: any) => {
    if (filtro === "hoje") return new Date(v.data_venda).toDateString() === hoje;
    if (filtro === "semana") return +new Date(v.data_venda) >= sete;
    return true;
  });

  const total = filtradas.reduce((s: number, v: any) => s + Number(v.valor_total), 0);
  const totalItens = filtradas.reduce(
    (s: number, v: any) =>
      s + (v.itens_venda ?? []).reduce((a: number, i: any) => a + Number(i.quantidade), 0),
    0,
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-4xl font-display font-bold text-primary">Vendas</h1>
          <p className="font-body text-sm md:text-base text-muted-foreground mt-1">
            Cada docinho que saiu pra rua.
          </p>
        </div>
        <div className="flex items-center gap-1 md:gap-2 bg-card border border-border rounded-full p-1 shadow-warm-sm flex-wrap">
          {(["todas", "hoje", "semana"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={[
                "px-3 md:px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider transition",
                filtro === f
                  ? "bg-primary text-primary-foreground shadow-warm-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card label="Total" value={fmtBRL(total)} tone="primary" />
        <Card label="Vendas" value={String(filtradas.length)} tone="gold" />
        <Card label="Docinhos" value={String(totalItens)} tone="success" />
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center py-12 px-6 bg-card border border-dashed border-border rounded-2xl">
          <ReceiptText className="mx-auto text-muted-foreground mb-3" size={36} />
          <h3 className="font-display text-xl text-foreground mb-1">Nenhuma venda</h3>
          <p className="font-body text-sm text-muted-foreground">
            Mude o filtro ou registre uma nova.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-warm-sm">
          {filtradas.map((v: any) => {
            const resumo = (v.itens_venda ?? [])
              .map((i: any) => `${Number(i.quantidade)}× ${i.produtos_finais?.nome ?? "item"}`)
              .join(", ");
            return (
              <div
                key={v.id}
                className="px-5 py-4 border-t border-border first:border-t-0 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">{resumo || "—"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-1">
                    {v.comprador && <>{v.comprador} · </>}
                    {fmtDateTime(v.data_venda)}
                    <PagamentoBadge tipo={v.forma_pagamento} />
                    <StatusPagamentoBadge status={v.status_pagamento} />
                  </div>
                </div>
                <div className="text-right font-display font-bold text-primary tabular-nums">
                  {fmtBRL(Number(v.valor_total))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "gold" | "success";
}) {
  const accent =
    tone === "primary" ? "text-primary" : tone === "gold" ? "text-gold-dark" : "text-success";
  return (
    <div className="bg-card border border-border rounded-2xl p-3 md:p-4 shadow-warm-sm min-w-0">
      <div className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 truncate">
        {label}
      </div>
      <div
        className={`font-display text-base md:text-2xl font-bold ${accent} tabular-nums break-words leading-tight`}
      >
        {value}
      </div>
    </div>
  );
}

function PagamentoBadge({ tipo }: { tipo: FormaPagamento }) {
  const map: Record<FormaPagamento, { label: string; cls: string }> = {
    dinheiro: { label: "Dinheiro", cls: "bg-success-bg text-success" },
    pix: { label: "Pix", cls: "bg-info-bg text-info" },
    cartao: { label: "Cartão", cls: "bg-gold-bg text-gold-dark" },
    boleto: { label: "Boleto", cls: "bg-warning-bg text-warning" },
    outro: { label: "Outro", cls: "bg-secondary text-brown-mid" },
  };
  const { label, cls } = map[tipo];
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}
    >
      {label}
    </span>
  );
}

function StatusPagamentoBadge({ status }: { status: StatusPagamento }) {
  const map: Record<StatusPagamento, { label: string; cls: string }> = {
    PAGO: { label: "Pago", cls: "bg-success-bg text-success" },
    PENDENTE: { label: "Pendente", cls: "bg-warning-bg text-warning" },
    ATRASADO: { label: "Atrasado", cls: "bg-red-100 text-red-700" },
    NAO_SE_APLICA: { label: "N/A", cls: "bg-secondary text-brown-mid" },
  };
  const { label, cls } = map[status] ?? map.NAO_SE_APLICA;
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}
    >
      {label}
    </span>
  );
}
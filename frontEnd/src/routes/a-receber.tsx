import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listarVendas } from "@/lib/vendas.functions";
import { fmtBRL, fmtDateTime } from "@/lib/format";
import { HandCoins, AlertTriangle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/a-receber")({
  component: () => (
    <AppShell>
      <AReceber />
    </AppShell>
  ),
});

function AReceber() {
  const { data: vendas = [] } = useQuery({ queryKey: ["vendas"], queryFn: () => listarVendas() });
  const [filtro, setFiltro] = useState<"todas" | "atrasadas">("todas");

  // Só o que ainda não foi pago
  const pendentes = vendas.filter((v: any) => v.status_pagamento === "PENDENTE");

  const filtradas = filtro === "atrasadas" ? pendentes.filter((v: any) => v.em_atraso) : pendentes;

  // Ordena: atrasadas primeiro, depois por data de vencimento mais próxima
  const ordenadas = [...filtradas].sort((a: any, b: any) => {
    if (a.em_atraso !== b.em_atraso) return a.em_atraso ? -1 : 1;
    const da = a.data_vencimento ? +new Date(a.data_vencimento) : Infinity;
    const db = b.data_vencimento ? +new Date(b.data_vencimento) : Infinity;
    return da - db;
  });

  const totalPendente = pendentes.reduce((s: number, v: any) => s + Number(v.valor_total), 0);
  const totalAtrasado = pendentes
    .filter((v: any) => v.em_atraso)
    .reduce((s: number, v: any) => s + Number(v.valor_total), 0);
  const qtdAtrasadas = pendentes.filter((v: any) => v.em_atraso).length;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-4xl font-display font-bold text-primary">A receber</h1>
          <p className="font-body text-sm md:text-base text-muted-foreground mt-1">
            Quem ainda deve pra Vó Cida.
          </p>
        </div>
        <div className="flex items-center gap-1 md:gap-2 bg-card border border-border rounded-full p-1 shadow-warm-sm flex-wrap">
          {(["todas", "atrasadas"] as const).map((f) => (
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
              {f === "todas" ? "Todas" : "Atrasadas"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card label="A receber" value={fmtBRL(totalPendente)} tone="gold" />
        <Card label="Em atraso" value={fmtBRL(totalAtrasado)} tone="error" />
        <Card label="Cobranças atrasadas" value={String(qtdAtrasadas)} tone="error" />
      </div>

      {ordenadas.length === 0 ? (
        <div className="text-center py-12 px-6 bg-card border border-dashed border-border rounded-2xl">
          <HandCoins className="mx-auto text-muted-foreground mb-3" size={36} />
          <h3 className="font-display text-xl text-foreground mb-1">
            {filtro === "atrasadas" ? "Nenhuma cobrança atrasada" : "Nada pendente"}
          </h3>
          <p className="font-body text-sm text-muted-foreground">
            {filtro === "atrasadas"
              ? "Todo mundo em dia por aqui."
              : "Todas as vendas já foram pagas ou não se aplicam."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-warm-sm">
          {ordenadas.map((v: any) => {
            const resumo = (v.itens_venda ?? [])
              .map((i: any) => `${Number(i.quantidade)}× ${i.produtos_finais?.nome ?? "item"}`)
              .join(", ");
            return (
              <div
                key={v.id}
                className={[
                  "px-5 py-4 border-t border-border first:border-t-0 flex items-start justify-between gap-3",
                  v.em_atraso ? "bg-error-bg/30" : "",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    {v.em_atraso && <AlertTriangle size={14} className="text-error shrink-0" />}
                    {v.comprador || "Cliente Avulso"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{resumo || "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
                    Vendido em {fmtDateTime(v.data_venda)}
                    {v.data_vencimento && (
                      <>
                        {" "}
                        · Vence em{" "}
                        <strong className={v.em_atraso ? "text-error" : "text-foreground"}>
                          {v.data_vencimento.split("-").reverse().join("/")}
                        </strong>
                      </>
                    )}
                    {v.em_atraso && (
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-error-bg text-error">
                        Em atraso
                      </span>
                    )}
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
  tone: "primary" | "gold" | "success" | "error";
}) {
  const accent =
    tone === "primary"
      ? "text-primary"
      : tone === "gold"
        ? "text-gold-dark"
        : tone === "error"
          ? "text-error"
          : "text-success";
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

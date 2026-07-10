import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listarGastos } from "@/lib/gastos.functions";
import { fmtBRL, fmtDate, categoriaLabel, type CategoriaGasto } from "@/lib/format";
import { Wallet, PieChart, Plus, Tag, Zap, Home, Truck, Package } from "lucide-react";

export const Route = createFileRoute("/gastos")({
  component: () => (
    <AppShell>
      <Gastos />
    </AppShell>
  ),
});

const iconCat: Record<CategoriaGasto, React.ReactNode> = {
  "materia-prima": <Tag size={14} />,
  embalagens: <Package size={14} />,
  energia: <Zap size={14} />,
  aluguel: <Home size={14} />,
  transporte: <Truck size={14} />,
  outros: <Wallet size={14} />,
};
const corCat: Record<CategoriaGasto, string> = {
  "materia-prima": "bg-primary",
  embalagens: "bg-gold",
  energia: "bg-brown-mid",
  aluguel: "bg-success",
  transporte: "bg-info",
  outros: "bg-muted-foreground",
};

function Gastos() {
  const { data: gastos = [] } = useQuery({ queryKey: ["gastos"], queryFn: () => listarGastos() });

  const mesAtual = new Date().getMonth();
  const noMes: any[] = (gastos as any[]).filter(
    (g: any) => new Date(g.data_gasto).getMonth() === mesAtual,
  );
  const total = noMes.reduce((s: number, g: any) => s + Number(g.valor), 0);

  const porCategoria = noMes.reduce<Record<string, number>>((acc, g: any) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + Number(g.valor);
    return acc;
  }, {});
  const cats = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]) as [
    CategoriaGasto,
    number,
  ][];
  const maior = cats[0];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-4xl font-display font-bold text-primary">
            Controle de Gastos
          </h1>
          <p className="font-body text-sm md:text-base text-muted-foreground mt-1">
            Acompanhe as despesas do mês.
          </p>
        </div>
        <Link
          to="/registrar/gastos"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-sm px-5 py-3 rounded-md hover:bg-primary-dark shadow-warm-sm"
        >
          <Plus size={16} /> Registrar Gasto
        </Link>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryCard
          icon={<Wallet size={18} />}
          tone="primary"
          label="Total no Mês"
          value={fmtBRL(total)}
          sub={new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        />
        <SummaryCard
          icon={<PieChart size={18} />}
          tone="gold"
          label="Maior Categoria"
          value={maior ? categoriaLabel[maior[0]] : "—"}
          sub={
            maior ? `${fmtBRL(maior[1])} · ${Math.round((maior[1] / total) * 100)}%` : "Sem gastos"
          }
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-warm-sm">
          <h2 className="font-display text-xl font-bold text-primary mb-5">Por categoria</h2>
          {cats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum gasto no mês.</p>
          ) : (
            <div className="space-y-5">
              {cats.map(([cat, v]) => {
                const pct = (v / (maior?.[1] || 1)) * 100;
                return (
                  <div key={cat}>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="font-semibold text-foreground">{categoriaLabel[cat]}</span>
                      <span className="font-display font-bold text-foreground tabular-nums">
                        {fmtBRL(v)}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${corCat[cat]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 bg-card border border-border rounded-2xl overflow-hidden shadow-warm-sm">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-display text-xl font-bold text-primary">Recentes</h2>
          </div>
          {noMes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sem gastos.</p>
          ) : (
            noMes.slice(0, 10).map((g: any) => (
              <div
                key={g.id}
                className="px-6 py-4 border-t border-border flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">{g.descricao}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                    {iconCat[g.categoria as CategoriaGasto]}{" "}
                    {categoriaLabel[g.categoria as CategoriaGasto]} · {fmtDate(g.data_gasto)}
                  </div>
                </div>
                <div className="text-right font-display font-bold text-foreground tabular-nums">
                  {fmtBRL(Number(g.valor))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  tone: "primary" | "gold" | "error";
  label: string;
  value: string;
  sub: string;
}) {
  const iconBg =
    tone === "primary"
      ? "bg-primary-bg text-primary"
      : tone === "gold"
        ? "bg-gold-bg text-gold-dark"
        : "bg-error-bg text-error";
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-warm-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1 font-body">{sub}</div>
    </div>
  );
}

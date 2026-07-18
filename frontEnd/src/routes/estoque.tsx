import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, PackageSearch } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/DesignSystem";

export const Route = createFileRoute("/estoque")({
  component: EstoqueRoute,
});

const opcoes = [
  {
    to: "/estoque/consultar" as const,
    titulo: "Consultar Estoque",
    descricao: "Veja saldos, custos, produtos finais e itens que precisam de reposição.",
    icon: PackageSearch,
    tone: "bg-primary-bg text-primary",
  },
  {
    to: "/estoque/historico" as const,
    titulo: "Histórico de Lançamentos",
    descricao: "Consulte entradas, saídas e ajustes com data, responsável e origem.",
    icon: ClipboardList,
    tone: "bg-gold-bg text-gold-dark",
  },
];

function EstoqueRoute() {
  const matchRoute = useMatchRoute();
  const estaNoInicio = Boolean(matchRoute({ to: "/estoque", fuzzy: false }));

  if (!estaNoInicio) return <Outlet />;

  return (
    <AppShell>
      <EstoqueHub />
    </AppShell>
  );
}

function EstoqueHub() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Estoque"
        description="Consulte a posição atual ou acompanhe cada movimentação."
      />

      <div className="grid gap-5 md:grid-cols-2">
        {opcoes.map(({ to, titulo, descricao, icon: Icon, tone }) => (
          <Link
            key={to}
            to={to}
            className="group flex min-h-52 flex-col rounded-3xl border border-border bg-card p-6 shadow-warm-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-warm-md"
          >
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}>
              <Icon size={27} />
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold text-foreground">{titulo}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{descricao}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
              Acessar{" "}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { Link, useLocation } from "@tanstack/react-router";
import { CircleDollarSign, Plus, ReceiptText } from "lucide-react";

export function VendasLayout({
  pendentes,
  atrasadas,
  children,
}: {
  pendentes?: number;
  atrasadas?: number;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const emReceber = location.pathname === "/vendas/a-receber";
  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary md:text-4xl">Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            Acompanhe o histórico comercial e os recebimentos.
          </p>
        </div>
        <Link
          to="/registrar/venda"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground shadow-warm-sm hover:bg-primary-dark sm:w-auto"
        >
          <Plus size={17} /> Nova venda
        </Link>
      </header>

      <nav
        className="grid grid-cols-2 rounded-2xl border border-border bg-card p-1.5 shadow-warm-sm"
        role="tablist"
        aria-label="Visões do módulo de vendas"
      >
        <Link
          to="/vendas"
          role="tab"
          aria-selected={!emReceber}
          className={[
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            !emReceber
              ? "bg-primary text-primary-foreground shadow-warm-sm"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          ].join(" ")}
        >
          <ReceiptText size={16} /> <span>Histórico de vendas</span>
        </Link>
        <Link
          to="/vendas/a-receber"
          role="tab"
          aria-selected={emReceber}
          className={[
            "inline-flex min-h-12 flex-wrap items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            emReceber
              ? "bg-primary text-primary-foreground shadow-warm-sm"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          ].join(" ")}
        >
          <CircleDollarSign size={16} />
          <span>A receber{pendentes === undefined ? "" : ` • ${pendentes}`}</span>
          {Boolean(atrasadas) && (
            <span
              className={[
                "rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
                emReceber ? "bg-white/20 text-white" : "bg-error-bg text-error",
              ].join(" ")}
            >
              {atrasadas} atrasadas
            </span>
          )}
        </Link>
      </nav>

      <section role="tabpanel">{children}</section>
    </div>
  );
}

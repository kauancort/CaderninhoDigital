import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingDown, Package, Cookie, PlusCircle, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { obterDashboard } from "@/lib/dashboard.functions";
import { fmtBRL, fmtDate } from "@/lib/format";
import { FeedbackBanner } from "@/components/DesignSystem";

export const Route = createFileRoute("/")({
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

function Dashboard() {
  const dadosVazios = {
    totalHoje: 0,
    custoMes: 0,
    producaoHoje: 0,
    estoqueAlerta: null,
    qtdBaixos: 0,
    dias: Array.from({ length: 7 }, (_, i) => {
      const data = new Date();
      data.setDate(data.getDate() - (6 - i));
      return {
        label: data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        total: 0,
        isHoje: i === 6,
      };
    }),
    ultimasVendas: [],
  };

  const {
    data = dadosVazios,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => obterDashboard(),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando painel...</div>;
  }

  const { totalHoje, custoMes, producaoHoje, estoqueAlerta, dias, ultimasVendas } = data;
  const maxVenda = Math.max(1, ...dias.map((d) => d.total));

  return (
    <div className="space-y-8">
      {isError && (
        <FeedbackBanner
          tone="error"
          title="A API do Spring Boot está indisponível."
          description="O painel foi aberto com valores vazios. Inicie o backend na porta 8080 para carregar os dados."
          action={
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="min-h-11 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {isFetching ? "Tentando..." : "Tentar novamente"}
            </button>
          }
        />
      )}

      <header>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-primary">Visão Geral</h1>
        <p className="font-body text-muted-foreground mt-1">
          Acompanhe o desempenho da sua cozinha hoje.
        </p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi
          icon={<Cookie size={18} />}
          tone="primary"
          tag="Hoje"
          label="Produção"
          value={
            <>
              <span className="font-display text-2xl md:text-4xl font-bold break-words">
                {producaoHoje}
              </span>
              <span className="text-[11px] md:text-sm text-muted-foreground ml-1 font-sans">
                doces/dia
              </span>
            </>
          }
        />
        <Kpi
          icon={<Wallet size={18} />}
          tone="gold"
          tag="Hoje"
          label="Vendas"
          value={
            <span className="font-display text-xl md:text-3xl font-bold break-words">
              {fmtBRL(totalHoje)}
            </span>
          }
        />
        <Kpi
          icon={<TrendingDown size={18} />}
          tone="primary"
          tag="Mês"
          label="Custo"
          value={
            <span className="font-display text-xl md:text-3xl font-bold break-words">
              {fmtBRL(custoMes)}
            </span>
          }
        />
        <Kpi
          icon={<Package size={18} />}
          tone={estoqueAlerta ? "error" : "success"}
          tag={estoqueAlerta ? "Alerta" : "Ok"}
          label={estoqueAlerta ? `${estoqueAlerta.nome} (Estoque)` : "Estoque"}
          value={
            estoqueAlerta ? (
              <span className="font-display text-2xl md:text-3xl font-bold break-words">
                {estoqueAlerta.estoque}
                <span className="text-[11px] md:text-sm text-muted-foreground ml-1 font-sans">
                  {estoqueAlerta.unidade}
                </span>
              </span>
            ) : (
              <span className="font-display text-2xl md:text-3xl font-bold">Tudo ok</span>
            )
          }
        />
      </section>

      {estoqueAlerta && (
        <div className="vovo-gradient border border-gold-light/50 rounded-2xl p-5 flex gap-4 items-start shadow-warm-sm">
          <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg shrink-0 border-2 border-gold">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-bold text-primary text-sm">
                Fale com a IA Assistente
              </span>
              <span className="bg-error-bg text-error text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                Atenção
              </span>
            </div>
            <p className="font-body text-sm text-brown-mid leading-relaxed">
              Olha, querida —{" "}
              <strong className="text-primary">{estoqueAlerta.nome.toLowerCase()}</strong> está
              baixo ({estoqueAlerta.estoque} {estoqueAlerta.unidade}, mínimo{" "}
              {estoqueAlerta.estoqueMinimo}).
            </p>
            <div className="flex gap-2 mt-3">
              <Link
                to="/estoque"
                className="text-xs font-bold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-dark"
              >
                Ver estoque
              </Link>
            </div>
          </div>
        </div>
      )}

      <section className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-warm-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl md:text-2xl text-foreground">Vendas da Semana</h2>
          <Link
            to="/vendas"
            className="text-xs font-bold text-primary hover:text-primary-dark uppercase tracking-wider"
          >
            Ver relatório completo →
          </Link>
        </div>
        <div className="flex items-end gap-2 md:gap-4 h-44">
          {dias.map((d, i) => {
            const h = (d.total / maxVenda) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <div className="text-[10px] md:text-xs text-muted-foreground font-semibold tabular-nums">
                  {d.total > 0 ? fmtBRL(d.total).replace("R$\u00A0", "") : "—"}
                </div>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={[
                      "w-full rounded-t-md transition-all",
                      d.isHoje ? "bg-primary" : "bg-gold/60",
                    ].join(" ")}
                    style={{ height: `${Math.max(h, 3)}%` }}
                  />
                </div>
                <div
                  className={[
                    "text-[11px] md:text-xs font-bold uppercase",
                    d.isHoje ? "text-primary" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {d.label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-card border border-border rounded-2xl overflow-hidden shadow-warm-sm">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-display text-lg text-foreground">Últimas vendas</h3>
          </div>
          {ultimasVendas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground font-body">
              Nenhuma venda registrada.
            </div>
          ) : (
            <ul>
              {ultimasVendas.map((v) => (
                <li
                  key={v.id}
                  className="px-5 py-3 border-t border-border first:border-t-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{v.resumo}</div>
                    <div className="text-xs text-muted-foreground">
                      {v.comprador ? `${v.comprador} · ` : ""}
                      {fmtDate(v.data)}
                    </div>
                  </div>
                  <div className="font-display font-bold text-primary tabular-nums">
                    {fmtBRL(v.valor)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link
          to="/registrar"
          className="vovo-gradient border-2 border-primary/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-primary transition-colors group"
        >
          <PlusCircle
            className="text-primary mb-3 group-hover:scale-110 transition-transform"
            size={40}
          />
          <div className="font-display text-lg font-bold text-primary mb-1">Registrar agora</div>
          <div className="text-xs text-brown-mid font-body">Venda, compra, produção ou gasto</div>
        </Link>
      </section>

      <Link
        to="/registrar"
        className="md:hidden fixed bottom-20 right-5 z-30 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-warm-lg"
        aria-label="Registrar"
      >
        <PlusCircle size={26} />
      </Link>
    </div>
  );
}

function Kpi({
  icon,
  tone,
  tag,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "primary" | "gold" | "success" | "error";
  tag: string;
  label: string;
  value: React.ReactNode;
}) {
  const iconBg =
    tone === "primary"
      ? "bg-primary/5 text-primary"
      : tone === "gold"
        ? "bg-gold/10 text-gold-dark"
        : tone === "success"
          ? "bg-success/10 text-success"
          : "bg-error/10 text-error";
  const tagCls =
    tone === "error"
      ? "bg-error/10 text-error"
      : tone === "gold"
        ? "bg-gold/10 text-gold-dark"
        : "bg-secondary text-muted-foreground";
  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-warm-sm relative min-w-0">
      <div className="flex items-start justify-between mb-3 md:mb-4 gap-2">
        <div
          className={`w-9 h-9 md:w-10 md:h-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}
        >
          {icon}
        </div>
        <span
          className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tagCls}`}
        >
          {tag}
        </span>
      </div>
      <div className="text-[11px] md:text-xs font-semibold text-muted-foreground mb-1 truncate">
        {label}
      </div>
      <div className="leading-tight text-foreground min-w-0">{value}</div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Cookie,
  Package,
  PlusCircle,
  ReceiptText,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FeedbackBanner } from "@/components/DesignSystem";
import { useAuth } from "@/hooks/use-auth";
import { obterDashboard } from "@/lib/dashboard.functions";
import { fmtBRL, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

function dadosVazios() {
  return {
    totalHoje: 0,
    totalMes: 0,
    custoMes: 0,
    producaoHoje: 0,
    estoqueAlerta: null,
    qtdBaixos: 0,
    vendasAReceber: 0,
    valorAReceber: 0,
    vendasAguardandoEstoque: 0,
    dias: Array.from({ length: 7 }, (_, i) => {
      const data = new Date();
      data.setDate(data.getDate() - (6 - i));
      return {
        label: data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        total: 0,
        isHoje: i === 6,
      };
    }),
    ultimasVendas: [] as Array<{
      id: string;
      comprador: string;
      data: string;
      valor: number;
      status: string;
      emAtraso: boolean;
      resumo: string;
    }>,
  };
}

function Dashboard() {
  const { user } = useAuth();
  const {
    data = dadosVazios(),
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

  const primeiroNome = user?.nome?.trim().split(/\s+/)[0] || "empreendedora";
  const totalSemana = data.dias.reduce((total, dia) => total + Number(dia.total || 0), 0);
  const mediaDiaria = totalSemana / data.dias.length;
  const maiorVenda = Math.max(1, ...data.dias.map((dia) => Number(dia.total || 0)));
  const temPendencias =
    data.qtdBaixos > 0 || data.vendasAReceber > 0 || data.vendasAguardandoEstoque > 0;

  return (
    <div className="space-y-6 md:space-y-8">
      {isError && (
        <FeedbackBanner
          tone="error"
          title="Não foi possível atualizar o painel."
          description="Confira se a API está ativa e tente carregar os dados novamente."
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

      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarDays size={14} aria-hidden="true" />
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </div>
          <h1 className="font-display text-3xl font-bold text-primary md:text-4xl">
            Bom dia, {primeiroNome}!
          </h1>
          <p className="mt-1 font-body text-muted-foreground">
            Aqui está o que merece sua atenção hoje.
          </p>
        </div>
        <Link
          to="/registrar/venda"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-warm-sm transition-colors hover:bg-primary-dark"
        >
          <PlusCircle size={18} aria-hidden="true" />
          Registrar venda
        </Link>
      </header>

      <section
        aria-label="Resumo financeiro e operacional"
        className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4"
      >
        <MetricCard
          icon={<CircleDollarSign size={19} />}
          tone="gold"
          label="Vendas hoje"
          value={fmtBRL(data.totalHoje)}
          hint="faturamento do dia"
        />
        <MetricCard
          icon={<TrendingUp size={19} />}
          tone="primary"
          label="Vendas no mês"
          value={fmtBRL(data.totalMes)}
          hint="faturamento acumulado"
        />
        <MetricCard
          icon={<Wallet size={19} />}
          tone="warning"
          label="A receber"
          value={fmtBRL(data.valorAReceber)}
          hint={`${data.vendasAReceber} ${data.vendasAReceber === 1 ? "venda pendente" : "vendas pendentes"}`}
        />
        <MetricCard
          icon={<Package size={19} />}
          tone={data.qtdBaixos > 0 ? "error" : "success"}
          label="Estoque baixo"
          value={String(data.qtdBaixos)}
          hint={data.qtdBaixos > 0 ? "itens precisam de atenção" : "tudo dentro do mínimo"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-warm-sm md:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl text-foreground md:text-2xl">Vendas</h2>
                <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Últimos 7 dias
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Acompanhe o ritmo da sua cozinha.
              </p>
            </div>
            <Link
              to="/vendas"
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark"
            >
              Ver relatório <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <div className="mb-5 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="font-display text-2xl font-bold text-primary">
                {fmtBRL(totalSemana)}
              </div>
              <div className="text-xs text-muted-foreground">total no período</div>
            </div>
            <div>
              <div className="font-display text-lg font-bold text-foreground">
                {fmtBRL(mediaDiaria)}
              </div>
              <div className="text-xs text-muted-foreground">média por dia</div>
            </div>
          </div>

          <div
            className="relative flex h-52 items-stretch gap-2 border-b border-border pt-6 md:gap-4"
            role="img"
            aria-label={`Vendas dos últimos 7 dias, total de ${fmtBRL(totalSemana)}`}
          >
            <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-dashed border-border/70" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border/70" />
            <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-dashed border-border/70" />
            {data.dias.map((dia, index) => {
              const total = Number(dia.total || 0);
              const altura = total > 0 ? Math.max((total / maiorVenda) * 100, 6) : 3;
              return (
                <div
                  key={`${dia.label}-${index}`}
                  className="group relative z-10 flex min-w-0 flex-1 flex-col items-center"
                >
                  <div className="pointer-events-none absolute -top-1 hidden -translate-y-full whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-warm-sm group-hover:block">
                    {fmtBRL(total)}
                  </div>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className={`w-full max-w-12 rounded-t-md transition-all ${dia.isHoje ? "bg-primary" : "bg-gold/70"}`}
                      style={{ height: `${altura}%` }}
                      title={`${dia.label}: ${fmtBRL(total)}`}
                    />
                  </div>
                  <div
                    className={`mt-3 text-[10px] font-bold uppercase md:text-xs ${dia.isHoje ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {dia.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-warm-sm md:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-foreground">Atenção hoje</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Pendências que merecem uma olhada.
              </p>
            </div>
            <div
              className={`rounded-full p-2 ${temPendencias ? "bg-error/10 text-error" : "bg-success/10 text-success"}`}
            >
              {temPendencias ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            </div>
          </div>

          {temPendencias ? (
            <div className="space-y-3">
              {data.qtdBaixos > 0 && (
                <AttentionRow
                  icon={<Package size={17} />}
                  title={`${data.qtdBaixos} ${data.qtdBaixos === 1 ? "item" : "itens"} com estoque baixo`}
                  description={
                    data.estoqueAlerta
                      ? `${data.estoqueAlerta.nome} está abaixo do mínimo.`
                      : "Confira os itens que precisam de reposição."
                  }
                  to="/estoque"
                  tone="error"
                />
              )}
              {data.vendasAReceber > 0 && (
                <AttentionRow
                  icon={<Clock3 size={17} />}
                  title={`${data.vendasAReceber} ${data.vendasAReceber === 1 ? "venda" : "vendas"} a receber`}
                  description={`${fmtBRL(data.valorAReceber)} aguardando pagamento.`}
                  to="/vendas/a-receber"
                  tone="warning"
                />
              )}
              {data.vendasAguardandoEstoque > 0 && (
                <AttentionRow
                  icon={<Cookie size={17} />}
                  title={`${data.vendasAguardandoEstoque} venda${data.vendasAguardandoEstoque === 1 ? "" : "s"} aguardando produção`}
                  description="Veja os pedidos que dependem de produção."
                  to="/vendas"
                  tone="primary"
                />
              )}
            </div>
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-xl bg-success/5 px-5 text-center">
              <CheckCircle2 className="mb-2 text-success" size={28} />
              <div className="font-display font-bold text-foreground">Tudo em ordem</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Nenhuma pendência importante por aqui.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-warm-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 md:px-6">
            <div>
              <h2 className="font-display text-xl text-foreground">Últimas vendas</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Acompanhe os pedidos mais recentes.
              </p>
            </div>
            <ReceiptText className="text-muted-foreground" size={20} aria-hidden="true" />
          </div>
          {data.ultimasVendas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground font-body">
              Nenhuma venda registrada.
            </div>
          ) : (
            <ul>
              {data.ultimasVendas.map((venda) => (
                <li
                  key={venda.id}
                  className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 first:border-t-0 md:px-6"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">{venda.resumo}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{venda.comprador}</span>
                      <span aria-hidden="true">·</span>
                      <span>{fmtDate(venda.data)}</span>
                      <StatusBadge status={venda.status} emAtraso={venda.emAtraso} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-display font-bold tabular-nums text-primary">
                    {fmtBRL(venda.valor)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-card to-secondary/70 p-5 shadow-warm-sm md:p-6">
          <div className="mb-5 flex items-center gap-2 text-primary">
            <Sparkles size={18} aria-hidden="true" />
            <h2 className="font-display text-xl font-bold">Ações rápidas</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <QuickAction to="/registrar/venda" icon={<ReceiptText size={18} />} label="Venda" />
            <QuickAction to="/registrar/compra" icon={<Package size={18} />} label="Compra" />
            <QuickAction to="/registrar/producao" icon={<Cookie size={18} />} label="Produção" />
            <QuickAction to="/registrar/gastos" icon={<TrendingDown size={18} />} label="Gasto" />
          </div>
          <Link
            to="/registrar"
            className="mt-4 flex min-h-11 items-center justify-center gap-1 rounded-md border border-primary/20 bg-card/70 text-xs font-bold text-primary transition-colors hover:border-primary hover:bg-card"
          >
            Ver todas as opções <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <Link
        to="/registrar/venda"
        className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-warm-lg md:hidden"
        aria-label="Registrar venda"
      >
        <PlusCircle size={26} />
      </Link>
    </div>
  );
}

function MetricCard({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: "primary" | "gold" | "warning" | "success" | "error";
  label: string;
  value: string;
  hint: string;
}) {
  const styles = {
    primary: "bg-primary/5 text-primary",
    gold: "bg-gold/10 text-gold-dark",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    error: "bg-error/10 text-error",
  };
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-warm-sm md:p-5">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md ${styles[tone]}`}>
        {icon}
      </div>
      <div className="truncate text-[11px] font-semibold text-muted-foreground md:text-xs">
        {label}
      </div>
      <div className="mt-1 truncate font-display text-xl font-bold text-foreground md:text-2xl">
        {value}
      </div>
      <div className="mt-1 truncate text-[10px] text-muted-foreground md:text-xs">{hint}</div>
    </div>
  );
}

function AttentionRow({
  icon,
  title,
  description,
  to,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: "/estoque" | "/vendas/a-receber" | "/vendas";
  tone: "primary" | "warning" | "error";
}) {
  const styles = {
    primary: "bg-primary/5 text-primary",
    warning: "bg-warning/10 text-warning",
    error: "bg-error/10 text-error",
  };
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/30 hover:bg-secondary/50"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${styles[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-foreground">{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{description}</div>
      </div>
      <ArrowRight
        size={15}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  );
}

function QuickAction({
  to,
  icon,
  label,
}: {
  to: "/registrar/venda" | "/registrar/compra" | "/registrar/producao" | "/registrar/gastos";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card/80 text-xs font-bold text-foreground transition-colors hover:border-primary/30 hover:text-primary"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </Link>
  );
}

function StatusBadge({ status, emAtraso }: { status: string; emAtraso: boolean }) {
  const atrasada = emAtraso || status === "ATRASADO";
  const pago = status === "PAGO";
  const label = atrasada
    ? "Atrasada"
    : pago
      ? "Pago"
      : status === "PENDENTE"
        ? "Pendente"
        : "Sem cobrança";
  const classes = atrasada
    ? "bg-error/10 text-error"
    : pago
      ? "bg-success/10 text-success"
      : "bg-warning/10 text-warning";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${classes}`}>{label}</span>
  );
}

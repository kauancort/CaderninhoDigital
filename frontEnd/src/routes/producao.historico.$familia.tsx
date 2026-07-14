import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listarProducoes } from "@/lib/producoes.functions";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Cookie, UserRound } from "lucide-react";
import { FAMILIAS, detectarFamilia, type FamiliaKey } from "@/lib/produto-familia";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/producao/historico/$familia")({
  component: () => (
    <AppShell>
      <HistoricoFamilia />
    </AppShell>
  ),
});

function HistoricoFamilia() {
  const { familia } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const famKey = familia as FamiliaKey;
  const fam = FAMILIAS.find((f) => f.key === famKey);
  const { data: lotes = [] } = useQuery({
    queryKey: ["producoes"],
    queryFn: () => listarProducoes(),
  });

  if (!fam) {
    return (
      <div className="text-sm">
        Produto não encontrado.{" "}
        <Link to="/producao" className="text-primary underline">
          Voltar
        </Link>
      </div>
    );
  }

  const lotesFam = (lotes as any[]).filter(
    (l) => detectarFamilia(l.produtos_finais?.nome) === famKey,
  );

  return (
    <div className="space-y-8">
      <button
        onClick={() => navigate({ to: "/producao" })}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <header>
        <h1 className="text-2xl md:text-4xl font-display font-bold text-primary">
          Histórico de Produção
        </h1>
        <p className="font-body text-sm md:text-base text-muted-foreground mt-1">{fam.nome}</p>
      </header>

      {lotesFam.length === 0 ? (
        <div className="text-center py-12 px-6 bg-card border border-dashed border-border rounded-2xl">
          <Cookie className="mx-auto text-muted-foreground mb-3" size={36} />
          <h3 className="font-display text-xl text-foreground mb-1">Nenhum lote ainda</h3>
          <p className="font-body text-sm text-muted-foreground">
            Registre a primeira produção de {fam.nome}.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-warm-sm">
          <ul className="divide-y divide-border" aria-label={`Lotes de ${fam.nome}`}>
            {lotesFam.map((lote: any) => {
              const dataHora = formatarDataHora(lote.criado_em, lote.data_producao);
              const potes = Number(lote.potes ?? 0);
              const totalUnidades = potes * Number(lote.unidade ?? 0);
              return (
                <li key={lote.id}>
                  <Link
                    to="/producao/$id"
                    params={{ id: lote.id }}
                    className="group flex min-h-24 items-center gap-4 px-4 py-4 transition-colors hover:bg-secondary/60 sm:px-6"
                    aria-label={`Abrir lote ${formatarNumeroLote(lote.id)}`}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-bg font-display text-lg font-bold text-primary sm:h-16 sm:w-16">
                      {formatarNumeroLote(lote.id)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-lg font-bold text-foreground">
                        Lote {formatarNumeroLote(lote.id)}
                      </h2>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={15} aria-hidden="true" /> {dataHora.data}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={15} aria-hidden="true" /> {dataHora.hora}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <UserRound size={15} aria-hidden="true" />
                          <span className="truncate">
                            {user?.nome ?? "Responsável não informado"}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-foreground">
                        {potes} {potes === 1 ? "pote" : "potes"}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {totalUnidades} {totalUnidades === 1 ? "unidade" : "unidades"}
                      </div>
                    </div>

                    <ArrowRight
                      size={20}
                      aria-hidden="true"
                      className="shrink-0 text-primary transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatarNumeroLote(id: string | number) {
  return String(id).padStart(3, "0");
}

function formatarDataHora(criadoEm: string | null, dataProducao: string) {
  const data = criadoEm ? new Date(criadoEm) : new Date(`${dataProducao}T00:00:00`);
  return {
    data: new Intl.DateTimeFormat("pt-BR").format(data),
    hora: criadoEm
      ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(data)
      : "Horário não informado",
  };
}

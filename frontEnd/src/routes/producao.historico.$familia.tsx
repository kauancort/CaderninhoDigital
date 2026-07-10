import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listarProducoes } from "@/lib/producoes.functions";
import { fmtDateLong } from "@/lib/format";
import { ArrowLeft, ArrowRight, Cookie, NotebookPen } from "lucide-react";
import { FAMILIAS, detectarFamilia, imgFamilia, type FamiliaKey } from "@/lib/produto-familia";

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {lotesFam.map((lote: any) => {
            const ings = lote.producao_ingredientes ?? [];
            return (
              <Link
                key={lote.id}
                to="/producao/$id"
                params={{ id: lote.id }}
                className="bg-card border border-border rounded-2xl overflow-hidden shadow-warm-sm hover:shadow-warm-md transition-shadow flex flex-col group"
              >
                <div className="relative aspect-[4/3] bg-secondary">
                  <img
                    src={imgFamilia(famKey)}
                    alt={fam.nome}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-3 left-3 bg-gold text-foreground text-xs font-bold px-3 py-1 rounded-full shadow-warm-sm">
                    {fmtDateLong(lote.data_producao)}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-display text-xl font-bold text-foreground mb-1">
                    {lote.produtos_finais?.nome ?? fam.nome}
                  </h3>
                  <div className="text-xs text-muted-foreground mb-1">
                    {Number(lote.potes ?? 0)} potes · {Number(lote.unidade ?? 0)} uni/pote
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {Number(lote.quantidade_produzida)} unidades totais
                  </div>
                  {ings.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-2">
                        <NotebookPen size={14} /> Ingredientes
                      </div>
                      <ul className="space-y-1.5 mb-4 flex-1">
                        {ings.slice(0, 4).map((i: any, idx: number) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm font-body text-brown-mid"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-gold mt-2 shrink-0" />
                            {Number(i.quantidade_utilizada)} {i.materia_prima?.unidade} de{" "}
                            {i.materia_prima?.nome}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                    <span className="text-sm font-bold text-muted-foreground">
                      Lote #{lote.numero_lote}
                    </span>
                    <ArrowRight
                      size={20}
                      className="text-primary group-hover:translate-x-1 transition-transform"
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

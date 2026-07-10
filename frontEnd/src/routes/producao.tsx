import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listarProducoes } from "@/lib/producoes.functions";
import { ArrowRight, NotebookPen, Cookie } from "lucide-react";
import { FAMILIAS, detectarFamilia, type FamiliaKey } from "@/lib/produto-familia";

export const Route = createFileRoute("/producao")({
  component: () => (
    <AppShell>
      <Producao />
    </AppShell>
  ),
});

function Producao() {
  const { data: lotes = [] } = useQuery({
    queryKey: ["producoes"],
    queryFn: () => listarProducoes(),
  });

  // Agrupa lotes por família de produto
  const porFamilia = new Map<FamiliaKey, any[]>();
  for (const lote of lotes as any[]) {
    const fam = detectarFamilia(lote.produtos_finais?.nome);
    if (!fam) continue;
    if (!porFamilia.has(fam)) porFamilia.set(fam, []);
    porFamilia.get(fam)!.push(lote);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl md:text-4xl font-display font-bold text-primary">Produção</h1>
        <p className="font-body text-sm md:text-base text-muted-foreground mt-1 max-w-xl">
          Visão geral dos produtos fabricados pela empresa.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {FAMILIAS.map((fam) => {
          const lotesFam = porFamilia.get(fam.key) ?? [];
          const totalPotes = lotesFam.reduce((s, l) => s + Number(l.potes ?? 0), 0);
          const totalUnidades = lotesFam.reduce(
            (s, l) => s + Number(l.quantidade_produzida ?? 0),
            0,
          );

          // Agrega ingredientes por nome
          const ingMap = new Map<string, { qtd: number; unidade: string }>();
          for (const l of lotesFam) {
            for (const i of l.producao_ingredientes ?? []) {
              const nome = i.materia_prima?.nome;
              if (!nome) continue;
              const cur = ingMap.get(nome) ?? { qtd: 0, unidade: i.materia_prima?.unidade ?? "" };
              cur.qtd += Number(i.quantidade_utilizada ?? 0);
              ingMap.set(nome, cur);
            }
          }
          const ings = Array.from(ingMap.entries()).slice(0, 4);

          return (
            <Link
              key={fam.key}
              to="/producao/historico/$familia"
              params={{ familia: fam.key }}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-warm-sm hover:shadow-warm-md transition-shadow flex flex-col group"
            >
              <div className="relative aspect-[4/3] bg-secondary">
                <img
                  src={fam.img}
                  alt={fam.nome}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-3 left-3 bg-gold text-foreground text-xs font-bold px-3 py-1 rounded-full shadow-warm-sm">
                  {lotesFam.length} {lotesFam.length === 1 ? "lote" : "lotes"}
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-display text-xl font-bold text-foreground mb-1">{fam.nome}</h3>
                <div className="text-xs text-muted-foreground mb-1">
                  {totalPotes} potes produzidos
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {totalUnidades} unidades totais
                </div>

                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  <NotebookPen size={14} /> Ingredientes
                </div>
                {ings.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic mb-4 flex-1 flex items-center gap-2">
                    <Cookie size={14} /> Nenhuma produção registrada
                  </div>
                ) : (
                  <ul className="space-y-1.5 mb-4 flex-1">
                    {ings.map(([nome, info], idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm font-body text-brown-mid"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-gold mt-2 shrink-0" />
                        {Number(info.qtd.toFixed(2))} {info.unidade} de {nome}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                  <span className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors">
                    Histórico de produção
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
    </div>
  );
}

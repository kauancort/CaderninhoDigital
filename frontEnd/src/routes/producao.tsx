import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listarProducoes } from "@/lib/producoes.functions";
import { listarProdutos } from "@/lib/catalogo.functions";
import { ArrowRight, BookOpen, Cookie, History, NotebookPen, Scale } from "lucide-react";
import { FAMILIAS, detectarFamilia, type FamiliaKey } from "@/lib/produto-familia";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/producao")({
  component: ProducaoRoute,
});

function ProducaoRoute() {
  const matchRoute = useMatchRoute();
  const estaNaVisaoGeral = Boolean(matchRoute({ to: "/producao", fuzzy: false }));

  if (!estaNaVisaoGeral) return <Outlet />;

  return (
    <AppShell>
      <Producao />
    </AppShell>
  );
}

function Producao() {
  const [receitaAberta, setReceitaAberta] = useState<any | null>(null);
  const { data: lotes = [] } = useQuery({
    queryKey: ["producoes"],
    queryFn: () => listarProducoes(),
  });
  const {
    data: produtos = [],
    isLoading: carregandoProdutos,
    isError: erroProdutos,
  } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => listarProdutos(),
  });

  const produtosPorFamilia = new Map<FamiliaKey, any>();
  for (const produto of produtos as any[]) {
    const familia = detectarFamilia(produto.nome);
    if (familia && !produtosPorFamilia.has(familia)) produtosPorFamilia.set(familia, produto);
  }

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

      {erroProdutos && (
        <div
          role="alert"
          className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-sm text-error"
        >
          Não foi possível carregar as receitas. Tente atualizar a página.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {FAMILIAS.map((fam) => {
          const produto = produtosPorFamilia.get(fam.key);
          const receita = produto?.gabarito;
          const lotesFam = porFamilia.get(fam.key) ?? [];
          const totalPotes = lotesFam.reduce((s, l) => s + Number(l.potes ?? 0), 0);
          const totalUnidades = lotesFam.reduce(
            (s, l) => s + Number(l.quantidade_produzida ?? 0),
            0,
          );

          const ingredientes = receita?.ingredientes ?? [];

          return (
            <article
              key={fam.key}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-warm-sm hover:shadow-warm-md transition-shadow flex flex-col"
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
                  <NotebookPen size={14} aria-hidden="true" /> Receita padrão
                </div>
                {carregandoProdutos ? (
                  <div className="space-y-2 mb-4 flex-1" aria-label="Carregando receita">
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  </div>
                ) : ingredientes.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic mb-4 flex-1 flex items-center gap-2">
                    <Cookie size={14} aria-hidden="true" /> Receita não cadastrada
                  </div>
                ) : (
                  <ul className="space-y-1.5 mb-4 flex-1">
                    {ingredientes.slice(0, 3).map((ingrediente: any) => (
                      <li
                        key={ingrediente.id}
                        className="flex items-start gap-2 text-sm font-body text-brown-mid"
                      >
                        <span
                          aria-hidden="true"
                          className="w-1.5 h-1.5 rounded-full bg-gold mt-2 shrink-0"
                        />
                        {formatarQuantidade(ingrediente.quantidade)} {ingrediente.unidade} de{" "}
                        {ingrediente.nome}
                      </li>
                    ))}
                    {ingredientes.length > 3 && (
                      <li className="text-xs font-semibold text-muted-foreground">
                        + {ingredientes.length - 3} ingredientes
                      </li>
                    )}
                  </ul>
                )}

                <div className="space-y-2 pt-3 border-t border-border mt-auto">
                  <button
                    type="button"
                    onClick={() => setReceitaAberta({ ...produto, familia: fam })}
                    disabled={!receita}
                    className="min-h-11 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    <BookOpen size={17} aria-hidden="true" /> Ver receita e preparo
                  </button>
                  <Link
                    to="/producao/historico/$familia"
                    params={{ familia: fam.key }}
                    className="group min-h-11 w-full rounded-lg px-3 py-2 text-sm font-bold text-muted-foreground hover:bg-secondary hover:text-primary inline-flex items-center justify-between"
                  >
                    <span className="inline-flex items-center gap-2">
                      <History size={16} aria-hidden="true" /> Ver histórico
                    </span>
                    <ArrowRight
                      size={18}
                      aria-hidden="true"
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Sheet
        open={Boolean(receitaAberta)}
        onOpenChange={(aberto) => !aberto && setReceitaAberta(null)}
      >
        <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-lg">
          {receitaAberta && <PainelReceita produto={receitaAberta} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PainelReceita({ produto }: { produto: any }) {
  const receita = produto.gabarito;
  return (
    <div className="space-y-6 pb-6">
      <SheetHeader className="pr-8 text-left">
        <div className="text-xs font-bold uppercase tracking-widest text-primary">
          Receita padrão
        </div>
        <SheetTitle className="font-display text-2xl text-primary">{produto.nome}</SheetTitle>
        <SheetDescription>
          Ingredientes calculados para {formatarQuantidade(receita.quantidade_base)} unidades.
        </SheetDescription>
      </SheetHeader>

      <div className="overflow-hidden rounded-xl border border-border">
        <img src={produto.familia.img} alt="" className="h-36 w-full object-cover" />
      </div>

      <section aria-labelledby="titulo-ingredientes">
        <h2
          id="titulo-ingredientes"
          className="mb-3 flex items-center gap-2 font-display text-xl font-bold text-foreground"
        >
          <Scale size={18} className="text-primary" aria-hidden="true" /> Ingredientes
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-background">
          {receita.ingredientes.map((ingrediente: any) => (
            <li key={ingrediente.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <span className="text-sm font-semibold text-foreground">{ingrediente.nome}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                {formatarQuantidade(ingrediente.quantidade)} {ingrediente.unidade}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-preparo" className="rounded-xl bg-gold-bg p-5">
        <h2
          id="titulo-preparo"
          className="mb-2 flex items-center gap-2 font-display text-xl font-bold text-foreground"
        >
          <BookOpen size={18} className="text-primary" aria-hidden="true" /> Modo de preparo
        </h2>
        <p className="whitespace-pre-line font-body text-sm leading-7 text-brown-mid">
          {receita.tutorial || "Nenhuma instrução de preparo cadastrada."}
        </p>
      </section>

      <Link
        to="/registrar/producao"
        className="min-h-12 w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary-dark inline-flex items-center justify-center gap-2"
      >
        <Cookie size={17} aria-hidden="true" /> Registrar produção
      </Link>
    </div>
  );
}

function formatarQuantidade(valor: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(valor));
}

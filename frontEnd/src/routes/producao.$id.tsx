import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { obterProducao } from "@/lib/producoes.functions";
import { fmtDateLong } from "@/lib/format";
import { ArrowLeft, Cookie, NotebookPen } from "lucide-react";
import pacoca from "@/assets/pacoca.jpg";
import biriba from "@/assets/biriba.jpg";
import fondant from "@/assets/fondant.jpg";
import { detectarFamilia } from "@/lib/produto-familia";

const imgs: Record<string, string> = { pacoca, biriba, fondant };

export const Route = createFileRoute("/producao/$id")({
  component: () => (
    <AppShell>
      <DetalheLote />
    </AppShell>
  ),
});

function DetalheLote() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: lote, isLoading } = useQuery({
    queryKey: ["producao", id],
    queryFn: () => obterProducao({ data: { id } }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!lote)
    return (
      <div className="text-sm">
        Lote não encontrado.{" "}
        <Link to="/producao" className="text-primary underline">
          Voltar
        </Link>
      </div>
    );

  const l: any = lote;
  const img = l.produtos_finais?.imagem ? imgs[l.produtos_finais.imagem] : undefined;
  const horario = new Date(l.data_producao).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const familia = detectarFamilia(l.produtos_finais?.nome);

  function voltar() {
    if (familia) {
      navigate({ to: "/producao/historico/$familia", params: { familia } });
      return;
    }
    navigate({ to: "/producao" });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <button
        onClick={voltar}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <header className="bg-card border border-border rounded-2xl overflow-hidden shadow-warm-sm">
        <div className="relative aspect-[16/9] bg-secondary">
          {img ? (
            <img src={img} alt={l.produtos_finais?.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Cookie size={64} />
            </div>
          )}
          <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-warm-sm">
            Lote #{l.numero_lote}
          </div>
        </div>
        <div className="p-6">
          <h1 className="font-display text-3xl font-bold text-primary">
            {l.produtos_finais?.nome ?? "Produto"}
          </h1>
          <div className="text-sm text-muted-foreground mt-1">
            {fmtDateLong(l.data_producao)} · {horario}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-warm-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Potes produzidos
          </div>
          <div className="font-display text-2xl md:text-3xl font-bold text-foreground mt-1 break-words">
            {Number(l.potes ?? 0)}{" "}
            <span className="text-sm text-muted-foreground font-sans">potes</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {Number(l.unidade ?? 0)} uni/pote
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-warm-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Total de unidades
          </div>
          <div className="font-display text-2xl md:text-3xl font-bold text-foreground mt-1 break-words">
            {Number(l.quantidade_produzida)}{" "}
            <span className="text-sm text-muted-foreground font-sans">unidades</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-warm-sm">
        <h2 className="font-display text-xl font-bold text-primary flex items-center gap-2 mb-4">
          <NotebookPen size={18} /> Ingredientes utilizados
        </h2>
        {(l.producao_ingredientes ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum ingrediente registrado.</div>
        ) : (
          <ul className="space-y-2">
            {l.producao_ingredientes.map((i: any, idx: number) => (
              <li
                key={idx}
                className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3"
              >
                <span className="font-semibold text-foreground">{i.materia_prima?.nome}</span>
                <span className="font-display font-bold text-primary tabular-nums">
                  {Number(i.quantidade_utilizada)} {i.materia_prima?.unidade}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {l.observacoes && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-warm-sm">
          <h2 className="font-display text-xl font-bold text-primary mb-2">Observações</h2>
          <p className="font-body text-sm text-brown-mid whitespace-pre-line">{l.observacoes}</p>
        </div>
      )}
    </div>
  );
}

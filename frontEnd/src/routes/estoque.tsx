import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import { Plus, Minus, AlertTriangle, Package, Cookie } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  listarMateriaPrima,
  listarProdutos,
  ajustarEstoqueMP,
  criarMateriaPrima,
  criarProduto,
} from "@/lib/catalogo.functions";
import { fmtBRL } from "@/lib/format";

export const Route = createFileRoute("/estoque")({
  component: () => (
    <AppShell>
      <Estoque />
    </AppShell>
  ),
});

function Estoque() {
  const qc = useQueryClient();
  const fnAjustar = useApiFn(ajustarEstoqueMP);
  const fnCriarMP = useApiFn(criarMateriaPrima);
  const fnCriarPF = useApiFn(criarProduto);
  const { data: mps = [] } = useQuery({
    queryKey: ["materia_prima"],
    queryFn: () => listarMateriaPrima(),
  });
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => listarProdutos(),
  });
  const [aba, setAba] = useState<"mp" | "pf">("mp");
  const [novoMP, setNovoMP] = useState({ nome: "", unidade: "kg", estoque_minimo: "0" });
  const [novoPF, setNovoPF] = useState({ nome: "", preco_venda: "" });
  const [soAlerta, setSoAlerta] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [destacado, setDestacado] = useState<string | null>(null);

  async function adicionarMP() {
    if (!novoMP.nome.trim()) return;
    await fnCriarMP({
      data: {
        nome: novoMP.nome,
        unidade: novoMP.unidade,
        estoque_minimo: Number(novoMP.estoque_minimo) || 0,
      },
    });
    setNovoMP({ nome: "", unidade: "kg", estoque_minimo: "0" });
    qc.invalidateQueries({ queryKey: ["materia_prima"] });
  }
  async function adicionarPF() {
    const preco = Number(novoPF.preco_venda.replace(",", "."));
    if (!novoPF.nome.trim() || !Number.isFinite(preco) || preco <= 0) return;
    await fnCriarPF({
      data: {
        nome: novoPF.nome,
        preco_venda: preco,
        custo_estimado: 0,
      },
    });
    setNovoPF({ nome: "", preco_venda: "" });
    qc.invalidateQueries({ queryKey: ["produtos"] });
  }
  async function ajustar(id: string, delta: number) {
    await fnAjustar({ data: { id, delta } });
    qc.invalidateQueries({ queryKey: ["materia_prima"] });
  }

  const itensAlerta = mps.filter(
    (i: any) => Number(i.quantidade_estoque) <= Number(i.estoque_minimo),
  );
  const baixos = itensAlerta.length;

  function abrirAlertas() {
    if (baixos === 0) return;
    setAba("mp");
    setSoAlerta((v) => !v);
    setTimeout(() => listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function irParaItem(id: string) {
    setAba("mp");
    setDestacado(id);
    setTimeout(() => {
      itemRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  useEffect(() => {
    if (!destacado) return;
    const t = setTimeout(() => setDestacado(null), 2000);
    return () => clearTimeout(t);
  }, [destacado]);

  const mpsExibidos = soAlerta ? itensAlerta : mps;

  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <h1 className="text-2xl md:text-4xl font-display font-bold text-foreground">Estoque</h1>
        <p className="font-body text-sm md:text-base text-muted-foreground mt-1">
          Ingredientes e produtos finais.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 bg-card border border-border rounded-2xl md:rounded-full p-1 shadow-warm-sm w-full md:w-fit">
        <button
          onClick={() => setAba("mp")}
          className={[
            "flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap",
            aba === "mp"
              ? "bg-primary text-primary-foreground shadow-warm-sm"
              : "text-muted-foreground",
          ].join(" ")}
        >
          Matéria-prima · {mps.length}
        </button>
        <button
          onClick={() => setAba("pf")}
          className={[
            "flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap",
            aba === "pf"
              ? "bg-primary text-primary-foreground shadow-warm-sm"
              : "text-muted-foreground",
          ].join(" ")}
        >
          Produtos finais · {produtos.length}
        </button>
      </div>

      {aba === "mp" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Sum
              icon={<Package size={18} />}
              tone="primary"
              label="Itens"
              value={String(mps.length)}
            />
            <Sum
              icon={<AlertTriangle size={18} />}
              tone={baixos ? "error" : "success"}
              label="Em alerta"
              value={String(baixos)}
              onClick={baixos ? abrirAlertas : undefined}
              active={soAlerta}
              hint={baixos ? (soAlerta ? "Mostrar todos" : "Clique para filtrar") : undefined}
            />
            <Sum
              icon={<span>💰</span>}
              tone="gold"
              label="Valor em despensa"
              value={fmtBRL(
                mps.reduce(
                  (s: number, i: any) => s + Number(i.quantidade_estoque) * Number(i.custo_medio),
                  0,
                ),
              )}
            />
          </div>

          {baixos > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-warm-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold flex items-center gap-2 text-error">
                  <AlertTriangle size={16} /> Produtos em alerta ({baixos})
                </div>
                {soAlerta && (
                  <button
                    onClick={() => setSoAlerta(false)}
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Mostrar todos
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {itensAlerta.map((i: any) => {
                  const critico = Number(i.quantidade_estoque) <= Number(i.estoque_minimo) * 0.5;
                  return (
                    <button
                      key={i.id}
                      onClick={() => irParaItem(i.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${critico ? "bg-error-bg text-error border-error/30 hover:bg-error/10" : "bg-warning-bg text-gold-dark border-warning/30 hover:bg-warning/10"}`}
                    >
                      {i.nome} · {Number(i.quantidade_estoque)}/{Number(i.estoque_minimo)}{" "}
                      {i.unidade}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5 shadow-warm-sm">
            <div className="text-sm font-bold mb-3">Adicionar matéria-prima</div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_100px_120px_auto] gap-2">
              <input
                className="ds-input"
                placeholder="Nome"
                value={novoMP.nome}
                onChange={(e) => setNovoMP({ ...novoMP, nome: e.target.value })}
              />
              <select
                className="ds-input"
                value={novoMP.unidade}
                onChange={(e) => setNovoMP({ ...novoMP, unidade: e.target.value })}
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="un">un</option>
                <option value="lata">lata</option>
                <option value="L">L</option>
              </select>
              <input
                className="ds-input"
                placeholder="Mín."
                type="number"
                value={novoMP.estoque_minimo}
                onChange={(e) => setNovoMP({ ...novoMP, estoque_minimo: e.target.value })}
              />
              <button
                onClick={adicionarMP}
                className="px-4 rounded-md bg-primary text-primary-foreground font-bold text-sm"
              >
                Adicionar
              </button>
            </div>
          </div>

          <div ref={listaRef} className="space-y-3">
            {mpsExibidos.length === 0 ? (
              <Empty
                msg={
                  soAlerta
                    ? "Nenhum item em alerta. 🎉"
                    : "Nenhum ingrediente. Use uma compra ou o formulário acima."
                }
              />
            ) : (
              mpsExibidos.map((i: any) => (
                <div
                  key={i.id}
                  ref={(el) => {
                    itemRefs.current[i.id] = el;
                  }}
                  className={`rounded-2xl transition-all ${destacado === i.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                >
                  <RowMP item={i} onAjustar={ajustar} />
                </div>
              ))
            )}
          </div>
        </>
      )}

      {aba === "pf" && (
        <>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-warm-sm">
            <div className="text-sm font-bold mb-3">Adicionar produto final</div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2">
              <input
                className="ds-input"
                placeholder="Nome (ex.: Brigadeiro)"
                value={novoPF.nome}
                onChange={(e) => setNovoPF({ ...novoPF, nome: e.target.value })}
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  R$
                </span>
                <input
                  className="ds-input pl-9"
                  placeholder="Preço"
                  value={novoPF.preco_venda}
                  onChange={(e) => setNovoPF({ ...novoPF, preco_venda: e.target.value })}
                />
              </div>
              <button
                onClick={adicionarPF}
                className="px-4 rounded-md bg-primary text-primary-foreground font-bold text-sm"
              >
                Adicionar
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {produtos.length === 0 ? (
              <Empty msg="Nenhum produto. Cadastre acima." />
            ) : (
              produtos.map((p: any) => (
                <div
                  key={p.id}
                  className="bg-card border border-border rounded-2xl p-5 shadow-warm-sm flex items-center justify-between"
                >
                  <div>
                    <div className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                      <Cookie size={16} /> {p.nome}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Preço de venda: {fmtBRL(Number(p.preco_venda))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-bold text-foreground leading-none">
                      {Number(p.quantidade_estoque)}
                      <span className="text-sm text-muted-foreground font-sans ml-1">un</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <style>{`.ds-input{width:100%;font-family:var(--font-sans);font-size:1rem;color:var(--color-foreground);background:var(--color-card);border:1.5px solid var(--color-border);border-radius:.5rem;padding:.5rem .75rem;min-height:42px;outline:none;}.ds-input:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px oklch(0.48 0.19 27/0.12);}`}</style>
    </div>
  );
}

function RowMP({ item, onAjustar }: { item: any; onAjustar: (id: string, delta: number) => void }) {
  const estoque = Number(item.quantidade_estoque);
  const min = Number(item.estoque_minimo);
  const pct = Math.min(100, (estoque / Math.max(min * 2, 0.01)) * 100);
  const status = estoque <= min * 0.5 ? "danger" : estoque <= min ? "warning" : "ok";
  const statusBar =
    status === "danger" ? "bg-error" : status === "warning" ? "bg-warning" : "bg-success";
  const statusBadge =
    status === "danger"
      ? "bg-error-bg text-error"
      : status === "warning"
        ? "bg-warning-bg text-gold-dark"
        : "bg-success-bg text-success";
  const statusLabel = status === "danger" ? "Crítico" : status === "warning" ? "Acabando" : "Ok";
  const step = item.unidade === "un" || item.unidade === "lata" ? 1 : 0.1;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-warm-sm flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="font-display text-lg font-semibold text-foreground truncate">
            {item.nome}
          </div>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadge}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="text-xs text-muted-foreground font-body">
          Mín: {min} {item.unidade} · Custo médio {fmtBRL(Number(item.custo_medio))}
        </div>
        <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${statusBar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 md:gap-4 md:w-64 md:justify-end">
        <div className="text-right">
          <div className="font-display text-2xl font-bold text-foreground leading-none">
            {estoque}
            <span className="text-sm text-muted-foreground font-sans font-medium ml-1">
              {item.unidade}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onAjustar(item.id, -step)}
            className="w-10 h-10 rounded-full bg-secondary text-brown-mid hover:bg-beige-dark flex items-center justify-center"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => onAjustar(item.id, step)}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary-dark flex items-center justify-center shadow-warm-sm"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Sum({
  icon,
  tone,
  label,
  value,
  onClick,
  active,
  hint,
}: {
  icon: React.ReactNode;
  tone: "primary" | "gold" | "success" | "error";
  label: string;
  value: string;
  onClick?: () => void;
  active?: boolean;
  hint?: string;
}) {
  const iconBg =
    tone === "primary"
      ? "bg-primary-bg text-primary"
      : tone === "gold"
        ? "bg-gold-bg text-gold-dark"
        : tone === "success"
          ? "bg-success-bg text-success"
          : "bg-error-bg text-error";
  const interactive = !!onClick;
  const Comp: any = interactive ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`bg-card border rounded-2xl p-4 flex items-center gap-3 shadow-warm-sm text-left w-full ${active ? "border-primary ring-2 ring-primary/30" : "border-border"} ${interactive ? "hover:shadow-warm-md transition cursor-pointer" : ""}`}
    >
      <div className={`w-10 h-10 rounded-md flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div className="font-display text-xl font-bold text-foreground leading-tight">{value}</div>
        {hint && <div className="text-[10px] font-semibold text-primary mt-0.5">{hint}</div>}
      </div>
    </Comp>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="text-center py-12 px-6 bg-card border border-dashed border-border rounded-2xl">
      <Package className="mx-auto text-muted-foreground mb-3" size={36} />
      <p className="font-body text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}

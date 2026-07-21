import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Package,
  Cookie,
  Search,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  pesquisarMateriasPrimas,
  pesquisarProdutos,
  resumirEstoqueMateriasPrimas,
} from "@/lib/catalogo.functions";
import { fmtBRL } from "@/lib/format";
import { PageHeader } from "@/components/DesignSystem";

export const Route = createFileRoute("/estoque/consultar")({
  component: () => (
    <AppShell>
      <Estoque />
    </AppShell>
  ),
});

function Estoque() {
  const [aba, setAba] = useState<"mp" | "pf">("mp");
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [pagina, setPagina] = useState(0);
  const [soAlerta, setSoAlerta] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaDebounced(busca.trim());
      setPagina(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [busca]);

  const { data: paginaMps, isLoading: carregandoMps } = useQuery({
    queryKey: ["materia_prima", "consulta", buscaDebounced, pagina, soAlerta],
    queryFn: () =>
      pesquisarMateriasPrimas({
        data: { busca: buscaDebounced, pagina, tamanho: 20, emAlerta: soAlerta },
      }),
    enabled: aba === "mp",
    staleTime: 60_000,
    placeholderData: (anterior) => anterior,
  });
  const { data: resumoMps } = useQuery({
    queryKey: ["materia_prima", "resumo-estoque", buscaDebounced],
    queryFn: () => resumirEstoqueMateriasPrimas({ data: { busca: buscaDebounced } }),
    enabled: aba === "mp",
    staleTime: 60_000,
  });
  const { data: paginaProdutos, isLoading: carregandoProdutos } = useQuery({
    queryKey: ["produtos", "consulta", buscaDebounced, pagina],
    queryFn: () => pesquisarProdutos({ data: { busca: buscaDebounced, pagina, tamanho: 20 } }),
    enabled: aba === "pf",
    staleTime: 60_000,
    placeholderData: (anterior) => anterior,
  });
  const mps = paginaMps?.registros ?? [];
  const produtos = paginaProdutos?.registros ?? [];
  const baixos = resumoMps?.itensEmAlerta ?? 0;
  const paginaAtiva = aba === "mp" ? paginaMps : paginaProdutos;

  function abrirAlertas() {
    if (baixos === 0) return;
    setSoAlerta((v) => !v);
    setPagina(0);
  }

  function alterarAba(novaAba: "mp" | "pf") {
    setAba(novaAba);
    setPagina(0);
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center gap-3">
        <Link
          to="/estoque"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary"
          aria-label="Voltar para Estoque"
        >
          <ArrowLeft size={18} />
        </Link>
        <PageHeader title="Consultar estoque" description="Ingredientes e produtos finais." />
      </div>

      <div className="flex flex-wrap gap-2 bg-card border border-border rounded-2xl md:rounded-full p-1 shadow-warm-sm w-full md:w-fit">
        <button
          onClick={() => alterarAba("mp")}
          className={[
            "flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap",
            aba === "mp"
              ? "bg-primary text-primary-foreground shadow-warm-sm"
              : "text-muted-foreground",
          ].join(" ")}
        >
          Matéria-prima · {resumoMps?.totalItens ?? "—"}
        </button>
        <button
          onClick={() => alterarAba("pf")}
          className={[
            "flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap",
            aba === "pf"
              ? "bg-primary text-primary-foreground shadow-warm-sm"
              : "text-muted-foreground",
          ].join(" ")}
        >
          Produtos finais · {paginaProdutos?.totalRegistros ?? "—"}
        </button>
      </div>

      <div className="relative max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="ds-input ds-input-search"
          placeholder={aba === "mp" ? "Buscar matéria-prima..." : "Buscar produto final..."}
        />
      </div>

      {aba === "mp" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Sum
              icon={<Package size={18} />}
              tone="primary"
              label="Itens encontrados"
              value={String(resumoMps?.totalItens ?? 0)}
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
              label="Valor em estoque"
              value={fmtBRL(Number(resumoMps?.valorEstoque ?? 0))}
            />
          </div>

          <div className="space-y-3">
            {carregandoMps ? (
              <Empty msg="Carregando matérias-primas..." />
            ) : mps.length === 0 ? (
              <Empty
                msg={soAlerta ? "Nenhum item em alerta. 🎉" : "Nenhum ingrediente. Use uma compra."}
              />
            ) : (
              mps.map((i: any) => (
                <div key={i.id}>
                  <RowMP item={i} />
                </div>
              ))
            )}
          </div>
        </>
      )}

      {aba === "pf" && (
        <>
          <div className="space-y-3">
            {carregandoProdutos ? (
              <Empty msg="Carregando produtos..." />
            ) : produtos.length === 0 ? (
              <Empty msg="Nenhum produto cadastrado." />
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

      {paginaAtiva && paginaAtiva.totalPaginas > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Paginação do estoque">
          <button
            type="button"
            className="ds-button-secondary px-3 py-2"
            disabled={!paginaAtiva.temAnterior}
            onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            Página {paginaAtiva.paginaAtual + 1} de {paginaAtiva.totalPaginas}
          </span>
          <button
            type="button"
            className="ds-button-secondary px-3 py-2"
            disabled={!paginaAtiva.temProxima}
            onClick={() => setPagina((atual) => atual + 1)}
          >
            Próxima <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

function RowMP({ item }: { item: any }) {
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpDown,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/DesignSystem";
import { pesquisarMateriasPrimas, pesquisarProdutos } from "@/lib/catalogo.functions";
import {
  listarMovimentacoes,
  listarUsuariosMovimentacao,
  resumirMovimentacoes,
  type TipoItemEstoque,
  type TipoMovimentacaoEstoque,
} from "@/lib/estoque.functions";

export const Route = createFileRoute("/estoque/historico")({
  component: () => (
    <AppShell>
      <HistoricoEstoque />
    </AppShell>
  ),
});

type Filtros = {
  inicio: string;
  fim: string;
  usuarioId: string;
  tipo: TipoMovimentacaoEstoque | "";
  origem: string;
  item: string;
};

const filtrosIniciais: Filtros = {
  inicio: "",
  fim: "",
  usuarioId: "",
  tipo: "",
  origem: "",
  item: "",
};

function HistoricoEstoque() {
  const [filtros, setFiltros] = useState<Filtros>(filtrosIniciais);
  const [pagina, setPagina] = useState(0);
  const [ordem, setOrdem] = useState<"ASC" | "DESC">("DESC");
  const [buscaItem, setBuscaItem] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [grupoItem, setGrupoItem] = useState<TipoItemEstoque>("PRODUTO");
  const [itemSelecionado, setItemSelecionado] = useState<any | null>(null);
  const [tipoItem, itemId] = filtros.item.split(":") as [TipoItemEstoque | "", string?];

  const parametros = {
    ...filtros,
    tipoItem,
    itemId: itemId ?? "",
    pagina,
    ordem,
  };
  const parametrosResumo = {
    inicio: filtros.inicio,
    fim: filtros.fim,
    usuarioId: filtros.usuarioId,
    tipo: filtros.tipo,
    origem: filtros.origem,
    tipoItem,
    itemId: itemId ?? "",
  };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["movimentacoes_estoque", parametros],
    queryFn: () => listarMovimentacoes(parametros),
    placeholderData: (anterior) => anterior,
  });
  const { data: resumo } = useQuery({
    queryKey: ["movimentacoes_estoque_resumo", parametrosResumo],
    queryFn: () => resumirMovimentacoes(parametrosResumo),
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ["movimentacoes_estoque_usuarios"],
    queryFn: listarUsuariosMovimentacao,
    staleTime: 300_000,
  });
  useEffect(() => {
    const t = window.setTimeout(() => setBuscaDebounced(buscaItem.trim()), 300);
    return () => clearTimeout(t);
  }, [buscaItem]);
  const { data: paginaItens, isFetching: buscandoItens } = useQuery({
    queryKey: ["catalogo", "movimentacao", grupoItem, buscaDebounced],
    queryFn: () =>
      grupoItem === "PRODUTO"
        ? pesquisarProdutos({ data: { busca: buscaDebounced, pagina: 0, tamanho: 20 } })
        : pesquisarMateriasPrimas({ data: { busca: buscaDebounced, pagina: 0, tamanho: 20 } }),
    enabled: buscaDebounced.length >= 2,
    placeholderData: (anterior) => anterior,
  });

  function alterar<K extends keyof Filtros>(campo: K, valor: Filtros[K]) {
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
    setPagina(0);
  }

  function limpar() {
    setFiltros(filtrosIniciais);
    setPagina(0);
    setOrdem("DESC");
    setBuscaItem("");
    setItemSelecionado(null);
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
        <PageHeader
          title="Histórico de lançamentos"
          description="Entradas, saídas e ajustes realizados no estoque."
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResumoCard
          label="Movimentações"
          valor={resumo?.quantidadeMovimentacoes ?? 0}
          tone="text-primary"
        />
        <ResumoCard label="Entradas" valor={resumo?.entradas ?? 0} tone="text-success" />
        <ResumoCard label="Saídas" valor={resumo?.saidas ?? 0} tone="text-error" />
        <ResumoCard label="Ajustes" valor={resumo?.ajustes ?? 0} tone="text-gold-dark" />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-warm-sm md:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
          <SlidersHorizontal size={16} /> Filtros
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Campo label="Data inicial">
            <input
              type="date"
              className="ds-input"
              value={filtros.inicio}
              onChange={(event) => alterar("inicio", event.target.value)}
            />
          </Campo>
          <Campo label="Data final">
            <input
              type="date"
              className="ds-input"
              value={filtros.fim}
              onChange={(event) => alterar("fim", event.target.value)}
            />
          </Campo>
          <Campo label="Produto ou insumo">
            <div className="space-y-2">
              <div className="flex gap-1">
                {(["PRODUTO", "MATERIA_PRIMA"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGrupoItem(g);
                      setBuscaItem("");
                      setItemSelecionado(null);
                      alterar("item", "");
                    }}
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${grupoItem === g ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                  >
                    {g === "PRODUTO" ? "Produtos finais" : "Matérias-primas"}
                  </button>
                ))}
              </div>
              <input
                className="ds-input"
                value={buscaItem}
                onChange={(e) => setBuscaItem(e.target.value)}
                placeholder="Nome ou SKU..."
              />
              {(buscaDebounced.length >= 2 || itemSelecionado) && (
                <select
                  className="ds-input"
                  value={filtros.item}
                  onChange={(e) => {
                    const valor = e.target.value;
                    alterar("item", valor);
                    const id = valor.split(":")[1];
                    setItemSelecionado(
                      (paginaItens?.registros ?? []).find((item: any) => String(item.id) === id) ??
                        null,
                    );
                  }}
                >
                  <option value="">{buscandoItens ? "Pesquisando..." : "Todos"}</option>
                  {itemSelecionado &&
                    !(paginaItens?.registros ?? []).some(
                      (item: any) => String(item.id) === String(itemSelecionado.id),
                    ) && (
                      <option value={`${grupoItem}:${itemSelecionado.id}`}>
                        {itemSelecionado.nome}
                        {itemSelecionado.sku ? ` · ${itemSelecionado.sku}` : ""}
                      </option>
                    )}
                  {(paginaItens?.registros ?? []).map((item: any) => (
                    <option key={item.id} value={`${grupoItem}:${item.id}`}>
                      {item.nome}
                      {item.sku ? ` · ${item.sku}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Campo>
          <Campo label="Usuário">
            <select
              className="ds-input"
              value={filtros.usuarioId}
              onChange={(event) => alterar("usuarioId", event.target.value)}
            >
              <option value="">Todos</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Movimentação">
            <select
              className="ds-input"
              value={filtros.tipo}
              onChange={(event) => alterar("tipo", event.target.value as Filtros["tipo"])}
            >
              <option value="">Todas</option>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
              <option value="AJUSTE">Ajuste</option>
            </select>
          </Campo>
          <Campo label="Origem">
            <select
              className="ds-input"
              value={filtros.origem}
              onChange={(e) => alterar("origem", e.target.value)}
            >
              <option value="">Todas</option>
              <option value="CADASTRO">Cadastro</option>
              <option value="COMPRA">Compra</option>
              <option value="PRODUCAO">Produção</option>
              <option value="VENDA">Venda</option>
              <option value="AJUSTE_MANUAL">Ajuste manual</option>
            </select>
          </Campo>
        </div>
        <button
          type="button"
          onClick={limpar}
          className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
        >
          <RotateCcw size={14} /> Limpar filtros
        </button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data
            ? `${data.totalElements} lançamento${data.totalElements === 1 ? "" : "s"}`
            : "Carregando..."}
          {isFetching && !isLoading ? " · atualizando" : ""}
        </p>
        <button
          type="button"
          onClick={() => {
            setOrdem((atual) => (atual === "DESC" ? "ASC" : "DESC"));
            setPagina(0);
          }}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary"
        >
          <ArrowUpDown size={14} /> {ordem === "DESC" ? "Mais recentes" : "Mais antigos"}
        </button>
      </div>

      {error ? (
        <Estado mensagem={error instanceof Error ? error.message : "Erro ao carregar histórico."} />
      ) : isLoading ? (
        <Estado mensagem="Carregando movimentações..." />
      ) : !data?.content.length ? (
        <Estado mensagem="Nenhuma movimentação encontrada para os filtros selecionados." />
      ) : (
        <div className="space-y-3">
          {data.content.map((movimento) => {
            const entrada = movimento.tipoMovimentacao === "ENTRADA";
            const ajuste = movimento.tipoMovimentacao === "AJUSTE";
            const Icon = ajuste ? ArrowUpDown : entrada ? ArrowDownToLine : ArrowUpFromLine;
            const tone = ajuste
              ? "bg-warning-bg text-gold-dark"
              : entrada
                ? "bg-success-bg text-success"
                : "bg-error-bg text-error";
            return (
              <article
                key={movimento.id}
                className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-warm-sm md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-5"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-foreground">
                      {movimento.itemNome}
                    </h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
                      {rotuloTipo(movimento.tipoMovimentacao)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatarDataHora(movimento.ocorridoEm)} · {movimento.usuarioNome} ·{" "}
                    {rotuloOrigem(movimento.origem)}
                  </p>
                  {movimento.observacao && (
                    <p className="mt-2 text-sm text-brown-mid">{movimento.observacao}</p>
                  )}
                </div>
                <div className="text-left md:text-right">
                  <div
                    className={`font-display text-xl font-bold ${ajuste ? "text-gold-dark" : entrada ? "text-success" : "text-error"}`}
                  >
                    {ajuste ? "" : entrada ? "+" : "-"}
                    {Number(movimento.quantidade)} {movimento.unidadeMedida}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Saldo: {Number(movimento.saldoAnterior)} → {Number(movimento.saldoPosterior)}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Paginação do histórico">
          <button
            type="button"
            disabled={data.first}
            onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-foreground">
            Página {data.number + 1} de {data.totalPages}
          </span>
          <button
            type="button"
            disabled={data.last}
            onClick={() => setPagina((atual) => atual + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary disabled:opacity-40"
            aria-label="Próxima página"
          >
            <ChevronRight size={18} />
          </button>
        </nav>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ResumoCard({ label, valor, tone }: { label: string; valor: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-warm-sm">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl font-bold ${tone}`}>{valor}</div>
    </div>
  );
}

function Estado({ mensagem }: { mensagem: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <ClipboardList className="mx-auto mb-3 text-muted-foreground" size={36} />
      <p className="text-sm text-muted-foreground">{mensagem}</p>
    </div>
  );
}

function formatarDataHora(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor));
}

function rotuloTipo(tipo: TipoMovimentacaoEstoque) {
  return { ENTRADA: "Entrada", SAIDA: "Saída", AJUSTE: "Ajuste" }[tipo];
}

function rotuloOrigem(origem: string) {
  return {
    CADASTRO: "Cadastro",
    COMPRA: "Compra",
    PRODUCAO: "Produção",
    VENDA: "Venda",
    AJUSTE_MANUAL: "Ajuste manual",
  }[origem];
}

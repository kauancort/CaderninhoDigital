import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  HandCoins,
  RefreshCw,
  Search,
} from "lucide-react";
import { FiltrosRecolhiveis } from "@/components/FiltrosRecolhiveis";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listarCobrancas,
  resumirCobrancas,
  type Cobranca,
  type OrdenacaoCobranca,
  type SituacaoCobranca,
} from "@/lib/cobrancas.functions";
import type { FiltroParcelamento, FormaPagamentoApi } from "@/lib/vendas-modulo.functions";
import { pesquisarClientes } from "@/lib/clientes.functions";
import { pesquisarProdutos } from "@/lib/catalogo.functions";
import { fmtBRL } from "@/lib/format";
import { formatarDataCobranca } from "@/lib/cobranca-contato";
import { VendaDetalhesDialog } from "./VendaDetalhesDialog";

type Ordenacao =
  | "vencimentoAntigo"
  | "vencimentoProximo"
  | "maiorAtraso"
  | "maiorValor"
  | "menorValor"
  | "cliente";

const INICIAL = {
  busca: "",
  clienteId: "",
  produtoId: "",
  inicio: "",
  fim: "",
  situacao: "" as SituacaoCobranca | "",
  forma: "" as FormaPagamentoApi | "",
  parcelamento: "" as FiltroParcelamento,
  ordenarPor: "maiorAtraso" as Ordenacao,
};

export function AReceber() {
  const [filtros, setFiltros] = useState(INICIAL);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [selecionada, setSelecionada] = useState<number | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setBusca(filtros.busca.trim());
      setPagina(0);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [filtros.busca]);

  const comuns = { ...filtros, busca };
  const paginaQuery = useQuery({
    queryKey: ["vendas", "receber", pagina, comuns],
    queryFn: () =>
      listarCobrancas({
        ...comuns,
        ordenarPor: filtros.ordenarPor as OrdenacaoCobranca,
        pagina,
        tamanho: 12,
      }),
    placeholderData: (anterior) => anterior,
  });
  const resumoQuery = useQuery({
    queryKey: ["vendas", "receber-resumo", comuns],
    queryFn: () => resumirCobrancas(comuns),
    placeholderData: (anterior) => anterior,
  });
  const clientesQuery = useQuery({
    queryKey: ["vendas", "clientes-opcoes"],
    queryFn: () => pesquisarClientes({ data: { busca: "", pagina: 0, tamanho: 100 } }),
  });
  const produtosQuery = useQuery({
    queryKey: ["vendas", "produtos-opcoes"],
    queryFn: () => pesquisarProdutos({ data: { busca: "", pagina: 0, tamanho: 100 } }),
  });

  const ativos = Boolean(
    filtros.busca ||
    filtros.clienteId ||
    filtros.produtoId ||
    filtros.inicio ||
    filtros.fim ||
    filtros.situacao ||
    filtros.forma ||
    filtros.parcelamento,
  );
  function alterar(campo: keyof typeof filtros, valor: string) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
    if (campo !== "busca") setPagina(0);
  }

  const resumo = resumoQuery.data;
  const dados = paginaQuery.data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        {[
          ["Total a receber", fmtBRL(resumo?.totalReceber ?? 0), "text-primary"],
          ["Total vencido", fmtBRL(resumo?.totalVencido ?? 0), "text-error"],
          ["Total em dia", fmtBRL(resumo?.totalEmDia ?? 0), "text-success"],
          ["Cobranças pendentes", String(resumo?.quantidadeCobrancas ?? 0), "text-gold-dark"],
          ["Cobranças atrasadas", String(resumo?.quantidadeAtrasadas ?? 0), "text-error"],
        ].map(([label, value, classe]) => (
          <div
            key={label}
            className="flex min-h-24 flex-col justify-center rounded-2xl border border-border bg-card p-4 shadow-warm-sm md:min-h-28 md:p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:text-xs">
              {label}
            </p>
            {resumoQuery.isLoading ? (
              <Skeleton className="mt-2 h-8 w-2/3" />
            ) : (
              <p
                className={`mt-1.5 font-display text-xl font-bold leading-tight tabular-nums md:text-2xl ${classe}`}
              >
                {value}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-info/20 bg-info-bg px-4 py-3 text-xs leading-relaxed text-info">
        <strong>Modelo financeiro atual:</strong> cada venda pendente corresponde a uma cobrança.
        Quando existe parcelamento, o sistema guarda apenas a quantidade informada, sem parcelas
        individuais ou pagamentos parciais.
      </div>

      <FiltrosRecolhiveis
        titulo="Filtros de cobrança"
        ativos={ativos}
        onLimpar={() => {
          setFiltros(INICIAL);
          setBusca("");
          setPagina(0);
        }}
      >
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Situação de atraso">
          {[
            ["", "Todas"],
            ["EM_DIA", "Em dia"],
            ["ATRASO_RECENTE", "Atraso recente"],
            ["ATRASO_MEDIO", "Atraso médio"],
            ["MUITO_ATRASADO", "Muito atrasado"],
          ].map(([value, label]) => (
            <button
              key={value || "todas"}
              type="button"
              aria-pressed={filtros.situacao === value}
              onClick={() => alterar("situacao", value)}
              className={[
                "min-h-9 shrink-0 rounded-full px-3 text-xs font-bold",
                filtros.situacao === value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative self-end">
            <span className="sr-only">Buscar cobranças</span>
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              className="ds-input ds-input-search"
              placeholder="Cliente, telefone ou produto"
              value={filtros.busca}
              onChange={(event) => alterar("busca", event.target.value)}
            />
          </label>
          <Select
            label="Cliente"
            value={filtros.clienteId}
            onChange={(value) => alterar("clienteId", value)}
            options={(clientesQuery.data?.registros ?? []).map((item: any) => ({
              value: String(item.id),
              label: item.nome,
            }))}
          />
          <Select
            label="Produto"
            value={filtros.produtoId}
            onChange={(value) => alterar("produtoId", value)}
            options={(produtosQuery.data?.registros ?? []).map((item: any) => ({
              value: String(item.id),
              label: item.nome,
            }))}
          />
          <Select
            label="Forma de pagamento"
            value={filtros.forma}
            onChange={(value) => alterar("forma", value)}
            options={[
              { value: "DINHEIRO", label: "Dinheiro" },
              { value: "PIX", label: "Pix" },
              { value: "CARTAO", label: "Cartão" },
              { value: "BOLETO", label: "Boleto" },
              { value: "OUTRO", label: "Outro" },
            ]}
          />
          <Select
            label="Vendas parceladas"
            value={filtros.parcelamento}
            onChange={(value) => alterar("parcelamento", value)}
            options={[
              { value: "parceladas", label: "Parceladas" },
              { value: "nao-parceladas", label: "Não parceladas" },
            ]}
          />
          <CampoData
            label="Vencimento inicial"
            value={filtros.inicio}
            onChange={(v) => alterar("inicio", v)}
          />
          <CampoData
            label="Vencimento final"
            value={filtros.fim}
            onChange={(v) => alterar("fim", v)}
          />
          <Select
            label="Ordenar por"
            value={filtros.ordenarPor}
            allLabel=""
            onChange={(value) => alterar("ordenarPor", value)}
            options={[
              { value: "maiorAtraso", label: "Maior atraso" },
              { value: "vencimentoAntigo", label: "Vencimento mais antigo" },
              { value: "vencimentoProximo", label: "Vencimento mais próximo" },
              { value: "maiorValor", label: "Maior valor" },
              { value: "menorValor", label: "Menor valor" },
              { value: "cliente", label: "Cliente" },
            ]}
          />
        </div>
      </FiltrosRecolhiveis>

      {paginaQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : paginaQuery.isError ? (
        <div className="rounded-2xl border border-error/30 bg-error-bg/30 p-10 text-center">
          <AlertTriangle className="mx-auto text-error" />
          <p className="mt-2 font-bold">Não foi possível carregar as cobranças.</p>
          <button
            onClick={() => paginaQuery.refetch()}
            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary"
          >
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      ) : !dados?.registros.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <HandCoins className="mx-auto text-muted-foreground" size={34} />
          <p className="mt-2 font-bold">
            {ativos ? "Nenhuma cobrança encontrada" : "Nada pendente"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {dados.registros.map((cobranca) => (
            <CobrancaCard
              key={cobranca.id}
              cobranca={cobranca}
              onOpen={() => setSelecionada(cobranca.id)}
            />
          ))}
        </div>
      )}

      {(dados?.totalPaginas ?? 0) > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Paginação">
          <button
            className="ds-button-secondary px-3 py-2"
            disabled={!dados?.temAnterior}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft size={15} /> Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            Página {(dados?.paginaAtual ?? 0) + 1} de {dados?.totalPaginas}
          </span>
          <button
            className="ds-button-secondary px-3 py-2"
            disabled={!dados?.temProxima}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima <ChevronRight size={15} />
          </button>
        </nav>
      )}
      <VendaDetalhesDialog vendaId={selecionada} onClose={() => setSelecionada(null)} />
    </div>
  );
}

function CobrancaCard({ cobranca, onOpen }: { cobranca: Cobranca; onOpen: () => void }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-warm-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{cobranca.clienteNome}</h3>
          <p className="text-xs text-muted-foreground">Venda #{cobranca.id}</p>
        </div>
        <span className="rounded-full bg-warning-bg px-2 py-1 text-[10px] font-bold uppercase text-warning">
          {rotuloSituacao(cobranca.situacao)}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-1.5">
            <CalendarDays size={13} /> {formatarDataCobranca(cobranca.dataVencimento)}
          </p>
          {cobranca.diasAtraso > 0 && (
            <p className="block font-bold text-error">
              {cobranca.diasAtraso} {cobranca.diasAtraso === 1 ? "dia" : "dias"} de atraso
            </p>
          )}
          {cobranca.parcelas && cobranca.parcelas > 1 && (
            <p className="block">Parcelamento informado: {cobranca.parcelas}x</p>
          )}
        </div>
        <strong className="font-display text-xl text-primary">{fmtBRL(cobranca.valor)}</strong>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-secondary text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Eye size={15} /> Visualizar e agir
      </button>
    </article>
  );
}

function Select(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{props.label}</span>
      <select
        className="ds-input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {(props.allLabel ?? "Todos") && <option value="">{props.allLabel ?? "Todos"}</option>}
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CampoData(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{props.label}</span>
      <input
        type="date"
        className="ds-input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function rotuloSituacao(situacao: SituacaoCobranca) {
  return {
    EM_DIA: "Em dia",
    ATRASO_RECENTE: "Atraso recente",
    ATRASO_MEDIO: "Atraso médio",
    MUITO_ATRASADO: "Muito atrasado",
  }[situacao];
}

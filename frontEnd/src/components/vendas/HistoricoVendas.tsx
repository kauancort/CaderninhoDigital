import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  ReceiptText,
  RefreshCw,
  Search,
} from "lucide-react";
import { FiltrosRecolhiveis } from "@/components/FiltrosRecolhiveis";
import { Skeleton } from "@/components/ui/skeleton";
import { pesquisarClientes } from "@/lib/clientes.functions";
import { pesquisarProdutos } from "@/lib/catalogo.functions";
import {
  listarHistoricoVendas,
  resumirHistoricoVendas,
  type FiltroParcelamento,
  type FormaPagamentoApi,
  type StatusPagamentoApi,
} from "@/lib/vendas-modulo.functions";
import { fmtBRL } from "@/lib/format";
import { formatarDataCobranca } from "@/lib/cobranca-contato";
import { VendaDetalhesDialog } from "./VendaDetalhesDialog";

const INICIAL = {
  busca: "",
  clienteId: "",
  produtoId: "",
  inicio: "",
  fim: "",
  status: "" as StatusPagamentoApi | "",
  forma: "" as FormaPagamentoApi | "",
  parcelamento: "" as FiltroParcelamento,
  ordenarPor: "dataVenda" as const,
  direcao: "DESC" as const,
};

export function HistoricoVendas() {
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
    queryKey: ["vendas", "historico", pagina, comuns],
    queryFn: () =>
      listarHistoricoVendas({
        ...comuns,
        pagina,
        tamanho: 15,
      }),
    placeholderData: (anterior) => anterior,
  });

  const resumoQuery = useQuery({
    queryKey: ["vendas", "historico-resumo", comuns],
    queryFn: () => resumirHistoricoVendas(comuns),
    placeholderData: (anterior) => anterior,
  });

  const clientesQuery = useQuery({
    queryKey: ["vendas", "clientes-opcoes"],
    queryFn: () =>
      pesquisarClientes({
        data: {
          busca: "",
          pagina: 0,
          tamanho: 100,
        },
      }),
  });

  const produtosQuery = useQuery({
    queryKey: ["vendas", "produtos-opcoes"],
    queryFn: () =>
      pesquisarProdutos({
        data: {
          busca: "",
          pagina: 0,
          tamanho: 100,
        },
      }),
  });

  const ativos = Boolean(
    filtros.busca ||
      filtros.clienteId ||
      filtros.produtoId ||
      filtros.inicio ||
      filtros.fim ||
      filtros.status ||
      filtros.forma ||
      filtros.parcelamento,
  );

  function alterar(campo: keyof typeof filtros, valor: string) {
    setFiltros((atual) => ({
      ...atual,
      [campo]: valor,
    }));

    if (campo !== "busca") {
      setPagina(0);
    }
  }

  const dados = paginaQuery.data;

  return (
    <div className="space-y-6">
      <ResumoHistorico
        carregando={resumoQuery.isLoading}
        dados={resumoQuery.data}
      />

      <FiltrosRecolhiveis
        titulo="Filtros do histórico"
        ativos={ativos}
        onLimpar={() => {
          setFiltros(INICIAL);
          setBusca("");
          setPagina(0);
        }}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative self-end">
            <span className="sr-only">Buscar vendas</span>

            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              className="ds-input ds-input-search"
              placeholder="Cliente, produto ou observação"
              value={filtros.busca}
              onChange={(event) =>
                alterar("busca", event.target.value)
              }
            />
          </label>

          <Select
            label="Cliente"
            value={filtros.clienteId}
            onChange={(value) => alterar("clienteId", value)}
            options={(clientesQuery.data?.registros ?? []).map(
              (item: any) => ({
                value: String(item.id),
                label: item.nome,
              }),
            )}
          />

          <Select
            label="Produto"
            value={filtros.produtoId}
            onChange={(value) => alterar("produtoId", value)}
            options={(produtosQuery.data?.registros ?? []).map(
              (item: any) => ({
                value: String(item.id),
                label: item.nome,
              }),
            )}
          />

          <Select
            label="Status"
            value={filtros.status}
            onChange={(value) => alterar("status", value)}
            options={[
              {
                value: "PAGO",
                label: "Pago",
              },
              {
                value: "PENDENTE",
                label: "Pendente",
              },
              {
                value: "ATRASADO",
                label: "Atrasado",
              },
              {
                value: "NAO_SE_APLICA",
                label: "Não se aplica",
              },
            ]}
          />

          <Select
            label="Forma de pagamento"
            value={filtros.forma}
            onChange={(value) => alterar("forma", value)}
            options={[
              {
                value: "DINHEIRO",
                label: "Dinheiro",
              },
              {
                value: "PIX",
                label: "Pix",
              },
              {
                value: "CHEQUE",
                label: "Cheque",
              },
              {
                value: "OUTRO",
                label: "Outro",
              },
            ]}
          />

          <Select
            label="Vendas parceladas"
            value={filtros.parcelamento}
            onChange={(value) => alterar("parcelamento", value)}
            options={[
              {
                value: "parceladas",
                label: "Parceladas",
              },
              {
                value: "nao-parceladas",
                label: "Não parceladas",
              },
            ]}
          />

          <CampoData
            label="Período inicial"
            value={filtros.inicio}
            onChange={(value) => alterar("inicio", value)}
          />

          <CampoData
            label="Período final"
            value={filtros.fim}
            onChange={(value) => alterar("fim", value)}
          />

          <Select
            label="Ordenar por"
            value={filtros.ordenarPor}
            allLabel=""
            onChange={(value) => alterar("ordenarPor", value)}
            options={[
              {
                value: "dataVenda",
                label: "Data",
              },
              {
                value: "valorTotal",
                label: "Valor",
              },
              {
                value: "cliente",
                label: "Cliente",
              },
              {
                value: "statusPagamento",
                label: "Status",
              },
            ]}
          />

          <Select
            label="Direção"
            value={filtros.direcao}
            allLabel=""
            onChange={(value) => alterar("direcao", value)}
            options={[
              {
                value: "DESC",
                label: "Mais recentes/maiores",
              },
              {
                value: "ASC",
                label: "Mais antigos/menores",
              },
            ]}
          />
        </div>
      </FiltrosRecolhiveis>

      {paginaQuery.isLoading ? (
        <ListaSkeleton />
      ) : paginaQuery.isError ? (
        <EstadoErro onRetry={() => paginaQuery.refetch()} />
      ) : !dados?.registros.length ? (
        <EstadoVazio filtrado={ativos} />
      ) : (
        <>
          {/* Tabela para desktop */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-warm-sm md:block">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-secondary/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Venda / cliente</th>
                  <th className="px-4 py-3 text-right">
                    Itens
                  </th>
                  <th className="px-4 py-3">
                    Pagamento
                  </th>
                  <th className="px-4 py-3">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-right">
                    Ação
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {dados.registros.map((venda) => (
                  <tr
                    key={venda.id}
                    className="hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3">
                      {formatarDataCobranca(
                        venda.dataVenda,
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <strong className="block text-foreground">
                        Nº da venda: {venda.id}
                      </strong>

                      <span className="text-xs text-muted-foreground">
                        {venda.clienteNome}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(venda.quantidadeItens)}
                    </td>

                    <td className="px-4 py-3">
                      {rotuloForma(
                        venda.formaPagamento,
                      )}

                      {venda.parcelas &&
                      venda.parcelas > 1
                        ? ` • ${venda.parcelas}x`
                        : ""}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge
                        status={venda.statusPagamento}
                        atraso={venda.emAtraso}
                      />
                    </td>

                    <td className="px-4 py-3 text-right font-display font-bold text-primary tabular-nums">
                      {fmtBRL(venda.valorTotal)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSelecionada(venda.id)
                        }
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-secondary px-3 text-xs font-bold text-primary hover:bg-beige-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Eye size={14} />
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards para mobile */}
          <div className="grid gap-3 md:hidden">
            {dados.registros.map((venda) => (
              <article
                key={venda.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong>
                      Nº da venda: {venda.id}
                    </strong>

                    <p className="text-xs text-muted-foreground">
                      {venda.clienteNome}
                    </p>
                  </div>

                  <StatusBadge
                    status={venda.statusPagamento}
                    atraso={venda.emAtraso}
                  />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">
                      Data
                    </dt>

                    <dd>
                      {formatarDataCobranca(
                        venda.dataVenda,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">
                      Itens
                    </dt>

                    <dd>
                      {Number(
                        venda.quantidadeItens,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">
                      Pagamento
                    </dt>

                    <dd>
                      {rotuloForma(
                        venda.formaPagamento,
                      )}

                      {venda.parcelas &&
                      venda.parcelas > 1
                        ? ` • ${venda.parcelas}x`
                        : ""}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">
                      Valor
                    </dt>

                    <dd className="font-bold text-primary">
                      {fmtBRL(venda.valorTotal)}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() =>
                    setSelecionada(venda.id)
                  }
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-secondary text-sm font-bold text-primary"
                >
                  <Eye size={15} />
                  Visualizar detalhes
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      <Paginacao
        pagina={dados?.paginaAtual ?? 0}
        paginas={dados?.totalPaginas ?? 0}
        anterior={Boolean(dados?.temAnterior)}
        proxima={Boolean(dados?.temProxima)}
        onAnterior={() =>
          setPagina((valor) =>
            Math.max(0, valor - 1),
          )
        }
        onProxima={() =>
          setPagina((valor) => valor + 1)
        }
      />

      <VendaDetalhesDialog
        vendaId={selecionada}
        onClose={() => setSelecionada(null)}
      />
    </div>
  );
}

function ResumoHistorico({
  carregando,
  dados,
}: {
  carregando: boolean;
  dados?: any;
}) {
  const cards = [
    {
      label: "Faturamento no período",
      value: fmtBRL(dados?.faturamento ?? 0),
    },
    {
      label: "Quantidade de vendas",
      value: String(
        dados?.quantidadeVendas ?? 0,
      ),
    },
    {
      label: "Itens vendidos",
      value: String(
        Number(dados?.quantidadeItens ?? 0),
      ),
    },
    {
      label: "Ticket médio",
      value: fmtBRL(dados?.ticketMedio ?? 0),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-border bg-card p-3 shadow-warm-sm md:p-4"
        >
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            {card.label}
          </p>

          {carregando ? (
            <Skeleton className="mt-2 h-7 w-2/3" />
          ) : (
            <p className="mt-1 font-display text-lg font-bold text-primary tabular-nums md:text-2xl">
              {card.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  allLabel = "Todos",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
  allLabel?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>

      <select
        className="ds-input"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
      >
        {allLabel && (
          <option value="">
            {allLabel}
          </option>
        )}

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CampoData({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>

      <input
        type="date"
        className="ds-input"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

export function StatusBadge({
  status,
  atraso,
}: {
  status: string;
  atraso?: boolean;
}) {
  const label = atraso
    ? "Em atraso"
    : ({
        PAGO: "Pago",
        PENDENTE: "Pendente",
        ATRASADO: "Atrasado",
        NAO_SE_APLICA: "N/A",
      }[status] ?? status);

  const classe =
    status === "PAGO"
      ? "bg-success-bg text-success"
      : atraso || status === "ATRASADO"
        ? "bg-error-bg text-error"
        : status === "PENDENTE"
          ? "bg-warning-bg text-warning"
          : "bg-secondary text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${classe}`}
    >
      {(atraso ||
        status === "ATRASADO") && (
        <AlertTriangle size={10} />
      )}{" "}
      {label}
    </span>
  );
}

function Paginacao(props: {
  pagina: number;
  paginas: number;
  anterior: boolean;
  proxima: boolean;
  onAnterior: () => void;
  onProxima: () => void;
}) {
  if (props.paginas <= 1) {
    return null;
  }

  return (
    <nav
      className="flex items-center justify-center gap-3"
      aria-label="Paginação"
    >
      <button
        className="ds-button-secondary px-3 py-2"
        disabled={!props.anterior}
        onClick={props.onAnterior}
      >
        <ChevronLeft size={15} />
        Anterior
      </button>

      <span className="text-sm text-muted-foreground">
        Página {props.pagina + 1} de{" "}
        {props.paginas}
      </span>

      <button
        className="ds-button-secondary px-3 py-2"
        disabled={!props.proxima}
        onClick={props.onProxima}
      >
        Próxima
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}

function ListaSkeleton() {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
      {Array.from({ length: 6 }).map(
        (_, index) => (
          <Skeleton
            key={index}
            className="h-14 w-full"
          />
        ),
      )}
    </div>
  );
}

function EstadoErro({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-error/30 bg-error-bg/30 p-10 text-center">
      <AlertTriangle
        className="mx-auto text-error"
        size={32}
      />

      <p className="mt-2 font-bold">
        Não foi possível carregar o histórico.
      </p>

      <button
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary"
      >
        <RefreshCw size={14} />
        Tentar novamente
      </button>
    </div>
  );
}

function EstadoVazio({
  filtrado,
}: {
  filtrado: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <ReceiptText
        className="mx-auto text-muted-foreground"
        size={34}
      />

      <p className="mt-2 font-bold">
        {filtrado
          ? "Nenhuma venda encontrada"
          : "Nenhuma venda registrada"}
      </p>

      <p className="text-sm text-muted-foreground">
        {filtrado
          ? "Revise ou limpe os filtros selecionados."
          : "As novas vendas aparecerão aqui."}
      </p>
    </div>
  );
}

function rotuloForma(forma: string | null) {
  return (
    {
      DINHEIRO: "Dinheiro",
      PIX: "Pix",
      CHEQUE: "Cheque",
      CARTAO: "Cartão",
      BOLETO: "Boleto",
      OUTRO: "Outro",
    }[forma ?? ""] ?? "Não informada"
  );
}
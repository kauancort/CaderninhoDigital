import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  AlertTriangle,
  Check,
  PackageCheck,
  RefreshCw,
  Truck,
} from "lucide-react";

import { useState } from "react";

import {
  atualizarDespachoVenda,
  listarVendasParaTransporte,
  type SituacaoDespachoApi,
  type VendaTransporte,
} from "@/lib/vendas.functions";

import { fmtBRL } from "@/lib/format";

const STATUS: Record<SituacaoDespachoApi, string> = {
  NAO_APLICAVEL: "Não se aplica",
  AGUARDANDO_DESPACHO: "Aguardando despacho",
  DESPACHADO: "Despachado",
  ENTREGUE: "Entregue",
};

export function TransporteVendas() {
  const queryClient = useQueryClient();

  const [rastreamento, setRastreamento] = useState<
    Record<number, string>
  >({});

  const query = useQuery<VendaTransporte[]>({
    queryKey: ["vendas", "transporte"],
    queryFn: listarVendasParaTransporte,
  });

  const mutation = useMutation({
    mutationFn: (dados: {
      vendaId: number;
      situacao: SituacaoDespachoApi;
      codigo?: string | null;
    }) =>
      atualizarDespachoVenda(
        dados.vendaId,
        dados.situacao,
        dados.codigo,
      ),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["vendas", "transporte"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["vendas"],
        }),
      ]);
    },
  });

  if (query.isLoading) {
    return (
      <Estado mensagem="Carregando vendas para transporte..." />
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-error/30 bg-error-bg/30 p-10 text-center">
        <AlertTriangle
          className="mx-auto text-error"
          size={32}
        />

        <p className="mt-2 font-bold">
          Não foi possível carregar o transporte.
        </p>

        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary"
        >
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      </div>
    );
  }

  const vendas: VendaTransporte[] = query.data ?? [];

  const proprias: VendaTransporte[] = vendas.filter(
    (venda: VendaTransporte) => venda.formaEnvio === "PROPRIO",
  );

  const transportadoras: VendaTransporte[] = vendas.filter(
    (venda: VendaTransporte) =>
      venda.formaEnvio === "TRANSPORTADORA",
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">
          Transporte
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe as vendas que precisam sair para entrega e
          registre o despacho ou a conclusão.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ResumoCard
          titulo="Entrega própria"
          quantidade={proprias.length}
          icon={<Truck size={18} />}
        />

        <ResumoCard
          titulo="Transportadora"
          quantidade={transportadoras.length}
          icon={<PackageCheck size={18} />}
        />
      </div>

      {vendas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <PackageCheck
            className="mx-auto text-muted-foreground"
            size={36}
          />

          <p className="mt-3 font-bold">
            Nenhuma entrega pendente.
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            As vendas com entrega aparecerão aqui até serem
            marcadas como entregues.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {vendas.map((venda: VendaTransporte) => (
            <TransporteCard
              key={venda.id}
              venda={venda}
              rastreamento={
                rastreamento[venda.id] ??
                venda.codigoRastreamento ??
                ""
              }
              setRastreamento={(valor: string) =>
                setRastreamento((atual) => ({
                  ...atual,
                  [venda.id]: valor,
                }))
              }
              salvando={
                mutation.isPending &&
                mutation.variables?.vendaId === venda.id
              }
              onDespachar={() =>
                mutation.mutate({
                  vendaId: venda.id,
                  situacao: "DESPACHADO",
                  codigo:
                    rastreamento[venda.id] ||
                    venda.codigoRastreamento ||
                    null,
                })
              }
              onEntregar={() =>
                mutation.mutate({
                  vendaId: venda.id,
                  situacao: "ENTREGUE",
                })
              }
            />
          ))}
        </div>
      )}

      {mutation.isError && (
        <p className="text-sm font-semibold text-error">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Não foi possível atualizar o despacho."}
        </p>
      )}
    </div>
  );
}

function TransporteCard({
  venda,
  rastreamento,
  setRastreamento,
  salvando,
  onDespachar,
  onEntregar,
}: {
  venda: VendaTransporte;
  rastreamento: string;
  setRastreamento: (valor: string) => void;
  salvando: boolean;
  onDespachar: () => void;
  onEntregar: () => void;
}) {
  const transportadora =
    venda.formaEnvio === "TRANSPORTADORA";

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-warm-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Venda #{venda.id}
          </p>

          <h3 className="mt-1 font-display text-lg font-bold text-foreground">
            {venda.clienteNome}
          </h3>
        </div>

        <span
          className={[
            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
            venda.situacaoDespacho === "ENTREGUE"
              ? "bg-success-bg text-success"
              : venda.situacaoDespacho === "DESPACHADO"
                ? "bg-info-bg text-info"
                : "bg-warning-bg text-warning",
          ].join(" ")}
        >
          {STATUS[venda.situacaoDespacho]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Info
          label="Tipo"
          value={
            transportadora
              ? "Transportadora"
              : "Entrega própria"
          }
        />

        <Info
          label="Valor da venda"
          value={fmtBRL(venda.valorTotal)}
        />
      </div>

      {transportadora && (
        <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-3">
          <label className="text-xs font-semibold text-muted-foreground">
            Código de rastreamento
          </label>

          <input
            className="ds-input mt-1"
            value={rastreamento}
            onChange={(event) =>
              setRastreamento(event.target.value)
            }
            placeholder="Informe ao despachar, se houver"
            disabled={
              salvando ||
              venda.situacaoDespacho === "ENTREGUE"
            }
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {venda.situacaoDespacho ===
          "AGUARDANDO_DESPACHO" && (
          <button
            type="button"
            onClick={onDespachar}
            disabled={salvando}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <Truck size={15} />

            {salvando
              ? "Atualizando..."
              : "Marcar como despachado"}
          </button>
        )}

        {venda.situacaoDespacho === "DESPACHADO" && (
          <button
            type="button"
            onClick={onEntregar}
            disabled={salvando}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-success px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            <Check size={15} />

            {salvando
              ? "Atualizando..."
              : "Marcar como entregue"}
          </button>
        )}
      </div>
    </article>
  );
}

function ResumoCard({
  titulo,
  quantidade,
  icon,
}: {
  titulo: string;
  quantidade: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-warm-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-bold">
          {icon}

          {titulo}
        </div>

        <span className="text-2xl font-bold text-primary">
          {quantidade}
        </span>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>

      <p className="text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function Estado({
  mensagem,
}: {
  mensagem: string;
}) {
  return (
    <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
      <RefreshCw
        className="mr-2 animate-spin"
        size={16}
      />

      {mensagem}
    </div>
  );
}
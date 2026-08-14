import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, PackageSearch, Pencil, ShoppingBasket } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buscarCompraMateriaPrima,
  listarMovimentacoes,
  removerMateriaPrima,
  removerProduto,
  type TipoItemEstoque,
} from "@/lib/estoque.functions";
import { fmtBRL } from "@/lib/format";

export type ItemConsultaEstoque = {
  id: string;
  nome: string;
  tipo: TipoItemEstoque;
  unidade: string;
  quantidade: number;
  custoMedio?: number;
  precoVenda?: number;
  estoqueMinimo?: number;
  sku?: string;
};

export function EstoqueItemDetalhesDialog({
  item,
  onClose,
  onEdit,
}: {
  item: ItemConsultaEstoque | null;
  onClose: () => void;
  onEdit: (item: ItemConsultaEstoque) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [entradaSelecionadaId, setEntradaSelecionadaId] = useState<number | null>(null);
  const materiaPrima = item?.tipo === "MATERIA_PRIMA";

  useEffect(() => {
    setEntradaSelecionadaId(null);
  }, [item?.id]);

  const movimentoQuery = useQuery({
    queryKey: ["estoque", "ultima-entrada", item?.tipo, item?.id],
    queryFn: () =>
      listarMovimentacoes({
        tipoItem: item!.tipo,
        itemId: item!.id,
        tipo: "ENTRADA",
        origem: materiaPrima ? "COMPRA" : "PRODUCAO",
        pagina: 0,
        ordem: "DESC",
      }),
    enabled: item !== null,
  });
  const entradasRecentes = movimentoQuery.data?.content.slice(0, 5) ?? [];
  const entradaSelecionada =
    entradasRecentes.find((movimento) => movimento.id === entradaSelecionadaId) ??
    entradasRecentes[0] ??
    null;
  const origemIdValida =
    typeof entradaSelecionada?.origemId === "number" &&
    Number.isFinite(entradaSelecionada.origemId);

  const compraQuery = useQuery({
    queryKey: ["compras-materias-primas", entradaSelecionada?.origemId],
    queryFn: () => buscarCompraMateriaPrima(entradaSelecionada!.origemId!),
    enabled: materiaPrima && entradaSelecionada?.origem === "COMPRA" && origemIdValida,
  });
  const compra = compraQuery.data;
  const itemCompra = compra?.itens.find((registro) => String(registro.materiaPrimaId) === item?.id);

  const remocao = useMutation({
    mutationFn: () =>
      materiaPrima
        ? removerMateriaPrima(Number(item!.id), motivo)
        : removerProduto(Number(item!.id), motivo),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [materiaPrima ? "materia_prima" : "produtos"],
        }),
        queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] }),
        queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque_resumo"] }),
      ]);
      toast.success(
        `“${item?.nome}” foi removido dos novos lançamentos. O histórico foi preservado.`,
      );
      setConfirmandoRemocao(false);
      setMotivo("");
      onClose();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : `Não foi possível remover ${materiaPrima ? "a matéria-prima" : "o produto"}.`,
      ),
  });

  return (
    <>
      <Dialog
        open={item !== null}
        onOpenChange={(open) => {
          if (!open && !remocao.isPending) onClose();
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border-border bg-card">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-bg text-primary">
              <PackageSearch size={22} />
            </div>
            <DialogTitle className="font-display text-2xl text-foreground">
              {item?.nome ?? "Detalhes do estoque"}
            </DialogTitle>
            <DialogDescription>
              {materiaPrima
                ? "Saldo atual e últimos lançamentos de compra."
                : "Saldo atual e últimas produções registradas."}
            </DialogDescription>
          </DialogHeader>

          {item && (
            <div className="space-y-5">
              <button
                type="button"
                className="ds-button-secondary min-h-11 w-full justify-center gap-2 sm:w-auto"
                onClick={() => onEdit(item)}
              >
                <Pencil size={17} /> Editar cadastro
              </button>

              <section className="rounded-2xl border border-border bg-secondary/35 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Quantidade atual
                </p>
                <p className="mt-1 font-display text-3xl font-bold text-foreground">
                  {numero(item.quantidade)}{" "}
                  <span className="text-base font-medium text-muted-foreground">
                    {item.unidade}
                  </span>
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {item.custoMedio !== undefined && (
                    <Info
                      label={`Custo médio por ${item.unidade}`}
                      value={fmtBRL(item.custoMedio)}
                    />
                  )}
                  {item.precoVenda !== undefined && (
                    <Info label="Preço de venda" value={fmtBRL(item.precoVenda)} />
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="flex items-center gap-2 font-display text-lg font-bold text-primary">
                  {materiaPrima ? <ShoppingBasket size={18} /> : <CalendarDays size={18} />}
                  {materiaPrima ? "Últimos lançamentos" : "Últimas produções"}
                </h3>

                {movimentoQuery.isLoading || compraQuery.isLoading ? (
                  <Estado texto="Carregando os detalhes..." />
                ) : movimentoQuery.isError || compraQuery.isError ? (
                  <Estado texto="Não foi possível carregar a última entrada." erro />
                ) : !entradaSelecionada ? (
                  <Estado
                    texto={
                      materiaPrima
                        ? "Nenhuma compra registrada para este item."
                        : "Nenhuma produção registrada para este produto."
                    }
                  />
                ) : (
                  <div className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2">
                    <Info
                      label={materiaPrima ? "Data da compra" : "Data da entrada"}
                      value={
                        compra?.dataCompra
                          ? data(compra.dataCompra)
                          : dataHora(entradaSelecionada.ocorridoEm)
                      }
                    />
                    <Info
                      label="Quantidade da entrada"
                      value={`${numero(itemCompra?.quantidade ?? entradaSelecionada.quantidade)} ${item.unidade}`}
                    />
                    {itemCompra?.valorTotal !== undefined && (
                      <Info label="Valor deste item" value={fmtBRL(itemCompra.valorTotal)} />
                    )}
                    {itemCompra?.valorUnitario !== undefined && (
                      <Info
                        label={`Valor por ${item.unidade}`}
                        value={fmtBRL(itemCompra.valorUnitario)}
                      />
                    )}
                    {compra?.fornecedorNome && (
                      <Info label="Fornecedor ou local" value={compra.fornecedorNome} />
                    )}
                    {compra?.formaPagamento && (
                      <Info label="Forma de pagamento" value={pagamento(compra.formaPagamento)} />
                    )}
                    <Info label="Responsável" value={entradaSelecionada.usuarioNome} />
                    <Info
                      label="Lançado em"
                      value={dataHora(compra?.criadoEm ?? entradaSelecionada.ocorridoEm)}
                    />
                    {compra?.observacao?.trim() && (
                      <div className="sm:col-span-2">
                        <Info label="Observação" value={compra.observacao} />
                      </div>
                    )}
                    {!materiaPrima && origemIdValida && (
                      <Link
                        to="/producao/$id"
                        params={{ id: String(entradaSelecionada.origemId) }}
                        className="ds-button-secondary min-h-11 justify-center sm:col-span-2"
                        onClick={onClose}
                      >
                        Ver produção responsável
                      </Link>
                    )}
                    {!origemIdValida && (
                      <div className="sm:col-span-2">
                        <Estado texto="Este registro antigo não possui uma operação vinculada com segurança. Os dados da entrada continuam disponíveis." />
                      </div>
                    )}
                  </div>
                )}

                {entradasRecentes.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Selecione um registro
                    </p>
                    {entradasRecentes.map((movimento, indice) => {
                      const selecionado = movimento.id === entradaSelecionada?.id;
                      const possuiOrigem =
                        typeof movimento.origemId === "number" &&
                        Number.isFinite(movimento.origemId);
                      if (!materiaPrima && possuiOrigem) {
                        return (
                          <Link
                            key={movimento.id}
                            to="/producao/$id"
                            params={{ id: String(movimento.origemId) }}
                            className="flex min-h-12 items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/40 hover:bg-primary-bg/40"
                            onClick={onClose}
                          >
                            <span>Produção {indice + 1}</span>
                            <span className="text-xs text-muted-foreground">
                              {dataHora(movimento.ocorridoEm)}
                            </span>
                          </Link>
                        );
                      }
                      return (
                        <button
                          key={movimento.id}
                          type="button"
                          className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                            selecionado
                              ? "border-primary bg-primary-bg text-primary"
                              : "border-border bg-card text-foreground hover:border-primary/40"
                          }`}
                          onClick={() => setEntradaSelecionadaId(movimento.id)}
                        >
                          <span>
                            {materiaPrima ? `Lançamento ${indice + 1}` : `Produção ${indice + 1}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {dataHora(movimento.ocorridoEm)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className="border-t border-border pt-5">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-error/40 bg-card px-4 text-sm font-bold text-error hover:bg-error-bg"
                  onClick={() => setConfirmandoRemocao(true)}
                >
                  {materiaPrima ? "Remover matéria-prima" : "Remover produto"}
                </button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Use esta ação somente quando o item não será mais utilizado.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmandoRemocao} onOpenChange={setConfirmandoRemocao}>
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja remover “{item?.nome}” do estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              O item não poderá mais ser utilizado em novos lançamentos, mas seu histórico será
              preservado. O saldo atual será registrado como saída manual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="space-y-1.5 text-sm font-semibold text-foreground">
            <span>Motivo (opcional)</span>
            <textarea
              className="ds-input min-h-24 resize-y"
              maxLength={500}
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder={`Ex.: ${materiaPrima ? "ingrediente" : "produto"} não será mais utilizado`}
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remocao.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-white hover:bg-error/90"
              disabled={remocao.isPending}
              onClick={(event) => {
                event.preventDefault();
                remocao.mutate();
              }}
            >
              {remocao.isPending
                ? "Removendo..."
                : materiaPrima
                  ? "Remover matéria-prima"
                  : "Remover produto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Estado({ texto, erro = false }: { texto: string; erro?: boolean }) {
  return (
    <p
      className={`rounded-2xl border border-dashed p-5 text-sm ${erro ? "border-error/30 text-error" : "border-border text-muted-foreground"}`}
    >
      {texto}
    </p>
  );
}

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(valor));
}

function data(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(`${valor}T12:00:00`),
  );
}

function dataHora(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

function pagamento(valor: string) {
  return (
    {
      DINHEIRO: "Dinheiro",
      PIX: "Pix",
      CARTAO: "Cartão",
      BOLETO: "Boleto",
      CHEQUE: "Cheque",
      OUTRO: "Outro",
    }[valor] ?? valor
  );
}

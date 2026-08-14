import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buscarCompraMateriaPrima, type MovimentacaoEstoque } from "@/lib/estoque.functions";
import { fmtBRL } from "@/lib/format";

export function OrigemMovimentacaoDialog({
  movimento,
  onClose,
}: {
  movimento: MovimentacaoEstoque | null;
  onClose: () => void;
}) {
  const origemIdValida =
    typeof movimento?.origemId === "number" && Number.isFinite(movimento.origemId);
  const compraQuery = useQuery({
    queryKey: ["compras-materias-primas", movimento?.origemId],
    queryFn: () => buscarCompraMateriaPrima(movimento!.origemId!),
    enabled: movimento?.origem === "COMPRA" && origemIdValida,
  });
  const compra = compraQuery.data;
  const itemCompra = compra?.itens.find((item) => item.materiaPrimaId === movimento?.itemId);

  return (
    <Dialog open={movimento !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-border bg-card">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-bg text-primary">
            <ClipboardList size={21} />
          </div>
          <DialogTitle className="font-display text-2xl text-foreground">
            {movimento ? titulo(movimento) : "Detalhes da movimentação"}
          </DialogTitle>
          <DialogDescription>Informações registradas no histórico de estoque.</DialogDescription>
        </DialogHeader>

        {movimento && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-border bg-secondary/30 p-4 sm:grid-cols-2">
              <Info label="Data" value={dataHora(movimento.ocorridoEm)} />
              <Info label="Responsável" value={movimento.usuarioNome} />
              <Info
                label={
                  movimento.tipoMovimentacao === "SAIDA" ? "Quantidade retirada" : "Quantidade"
                }
                value={`${numero(movimento.quantidade)} ${movimento.unidadeMedida}`}
              />
              <Info
                label="Saldo"
                value={`${numero(movimento.saldoAnterior)} → ${numero(movimento.saldoPosterior)} ${movimento.unidadeMedida}`}
              />
              {movimento.observacao?.trim() && (
                <div className="sm:col-span-2">
                  <Info
                    label={movimento.origem === "REMOCAO_MANUAL" ? "Motivo" : "Observação"}
                    value={movimento.observacao}
                  />
                </div>
              )}
            </div>

            {movimento.origem === "COMPRA" && origemIdValida && (
              <section className="space-y-3">
                <h3 className="font-display text-lg font-bold text-primary">Compra de origem</h3>
                {compraQuery.isLoading ? (
                  <Estado texto="Carregando a compra..." />
                ) : compraQuery.isError ? (
                  <Estado texto="Não foi possível carregar a compra vinculada." erro />
                ) : compra ? (
                  <div className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2">
                    <Info label="Compra" value={`#${compra.id}`} />
                    <Info label="Data da compra" value={data(compra.dataCompra)} />
                    {itemCompra && (
                      <>
                        <Info
                          label="Valor deste item"
                          value={fmtBRL(Number(itemCompra.valorTotal))}
                        />
                        <Info
                          label={`Valor por ${movimento.unidadeMedida}`}
                          value={fmtBRL(Number(itemCompra.valorUnitario))}
                        />
                      </>
                    )}
                    {compra.fornecedorNome && (
                      <Info label="Fornecedor ou local" value={compra.fornecedorNome} />
                    )}
                    {compra.formaPagamento && (
                      <Info label="Forma de pagamento" value={pagamento(compra.formaPagamento)} />
                    )}
                    <Info label="Lançada em" value={dataHora(compra.criadoEm)} />
                    {compra.observacao?.trim() && (
                      <div className="sm:col-span-2">
                        <Info label="Observação da compra" value={compra.observacao} />
                      </div>
                    )}
                  </div>
                ) : (
                  <Estado texto="Este registro antigo não possui uma compra vinculada com segurança." />
                )}
              </section>
            )}

            {movimento.origem === "COMPRA" && !origemIdValida && (
              <Estado texto="Este registro antigo não possui uma compra vinculada com segurança. Os dados auditáveis da movimentação continuam disponíveis acima." />
            )}

            {["PRODUCAO", "VENDA"].includes(movimento.origem) && !movimento.origemId && (
              <Estado texto="A operação antiga não pôde ser vinculada com segurança. Os dados auditáveis da movimentação continuam disponíveis acima." />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function titulo(movimento: MovimentacaoEstoque) {
  if (movimento.origem === "REMOCAO_MANUAL") return `Remoção manual de ${movimento.itemNome}`;
  if (movimento.origem === "AJUSTE_MANUAL") return `Ajuste manual de ${movimento.itemNome}`;
  if (movimento.origem === "COMPRA") return `Entrada de ${movimento.itemNome}`;
  if (movimento.origem === "CADASTRO") return `Cadastro de ${movimento.itemNome}`;
  return `${movimento.tipoMovimentacao === "ENTRADA" ? "Entrada" : "Saída"} de ${movimento.itemNome}`;
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
      className={`rounded-xl p-3 text-sm ${erro ? "bg-error-bg text-error" : "bg-secondary text-muted-foreground"}`}
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  Mail,
  Package,
  Phone,
  RefreshCw,
  Send,
  UserRound,
} from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adicionarContatoVenda, prepararDuplicacaoVenda } from "@/lib/vendas.functions";
import { useApiFn } from "@/lib/api-function";
import { setPrefill } from "@/lib/voz-prefill";
import { confirmarPagamentoCobranca } from "@/lib/cobrancas.functions";
import { buscarVendaDetalhes } from "@/lib/vendas-modulo.functions";
import { criarLinkEmail, criarLinkWhatsApp, formatarDataCobranca } from "@/lib/cobranca-contato";
import { fmtBRL, fmtDateTime } from "@/lib/format";

export function VendaDetalhesDialog({
  vendaId,
  onClose,
}: {
  vendaId: number | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fnContato = useApiFn(adicionarContatoVenda);
  const fnDuplicar = useApiFn(prepararDuplicacaoVenda);
  const [confirmando, setConfirmando] = useState(false);
  const [tipoContato, setTipoContato] = useState("WhatsApp");
  const [resposta, setResposta] = useState("");

  const detalhesQuery = useQuery({
    queryKey: ["vendas", "detalhes", vendaId],
    queryFn: () => buscarVendaDetalhes(vendaId!),
    enabled: vendaId !== null,
  });
  const venda = detalhesQuery.data;

  const contatoMutation = useMutation({
    mutationFn: () =>
      fnContato({
        data: {
          venda_id: vendaId!,
          tipo: tipoContato,
          resposta: resposta.trim() || null,
        },
      }),
    onSuccess: async () => {
      toast.success("Contato registrado.");
      setResposta("");
      await queryClient.invalidateQueries({ queryKey: ["vendas", "detalhes", vendaId] });
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível registrar o contato."),
  });

  const pagamentoMutation = useMutation({
    mutationFn: () => confirmarPagamentoCobranca(vendaId!),
    onSuccess: async () => {
      toast.success("Pagamento confirmado.");
      setConfirmando(false);
      onClose();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cobrancas"] }),
        queryClient.invalidateQueries({ queryKey: ["vendas"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível confirmar o pagamento."),
  });

  const duplicarMutation = useMutation({
    mutationFn: () => fnDuplicar({ data: { id: vendaId! } }),
    onSuccess: (dados: any) => {
      setPrefill("venda", {
        comprador: dados.clienteNome,
        cliente_id: String(dados.clienteId),
        avisos: dados.avisos,
        itens: dados.itens.map((item: any) => ({
          produto_final_id: String(item.produtoId),
          quantidade: Number(item.quantidade),
          preco_unitario: Number(item.precoAtual),
          tipo: "pote",
        })),
      });
      onClose();
      navigate({ to: "/registrar/venda" });
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível duplicar a venda."),
  });

  async function copiar(valor: string, rotulo: string) {
    try {
      await navigator.clipboard.writeText(valor);
      toast.success(`${rotulo} copiado.`);
    } catch {
      toast.error(`Não foi possível copiar ${rotulo.toLowerCase()}.`);
    }
  }

  const mensagem = venda?.dataVencimento
    ? {
        clienteNome: venda.clienteNome,
        dataVencimento: venda.dataVencimento,
        valor: venda.valorTotal,
      }
    : null;
  const whatsapp = venda && mensagem ? criarLinkWhatsApp(venda.clienteTelefone, mensagem) : null;
  const pendente = venda?.statusPagamento === "PENDENTE" || venda?.statusPagamento === "ATRASADO";
  const ocupada =
    contatoMutation.isPending || pagamentoMutation.isPending || duplicarMutation.isPending;

  return (
    <>
      <Dialog open={vendaId !== null} onOpenChange={(open) => !open && !ocupada && onClose()}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border-border bg-card p-0">
          <DialogHeader className="border-b border-border bg-secondary/40 px-5 py-5 pr-12 md:px-6">
            <DialogTitle className="font-display text-2xl text-foreground">
              {venda ? `Venda #${venda.id}` : "Detalhes da venda"}
            </DialogTitle>
            <DialogDescription>
              Cliente, produtos, pagamento, contatos e ações relacionadas.
            </DialogDescription>
          </DialogHeader>

          {detalhesQuery.isLoading ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
              <RefreshCw className="mr-2 animate-spin" size={16} /> Carregando detalhes...
            </div>
          ) : detalhesQuery.isError || !venda ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm text-error">Não foi possível carregar os detalhes da venda.</p>
              <button
                type="button"
                onClick={() => detalhesQuery.refetch()}
                className="mt-3 text-sm font-bold text-primary hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-6 px-5 py-5 md:px-6">
                <Secao titulo="Cliente">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info icon={<UserRound size={14} />} label="Nome" value={venda.clienteNome} />
                    {venda.clienteDocumento && (
                      <Info
                        icon={<Clipboard size={14} />}
                        label="CPF ou CNPJ"
                        value={venda.clienteDocumento}
                      />
                    )}
                  </div>
                  {venda.clienteTelefone && (
                    <LinhaContato
                      icon={<Phone size={15} />}
                      value={venda.clienteTelefone}
                      onCopy={() => copiar(venda.clienteTelefone!, "Telefone")}
                      action={
                        whatsapp ? (
                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-success px-3 text-xs font-bold text-white"
                          >
                            WhatsApp <ExternalLink size={12} />
                          </a>
                        ) : null
                      }
                    />
                  )}
                  {venda.clienteEmail && (
                    <LinhaContato
                      icon={<Mail size={15} />}
                      value={venda.clienteEmail}
                      onCopy={() => copiar(venda.clienteEmail!, "E-mail")}
                      action={
                        mensagem ? (
                          <a
                            href={criarLinkEmail(venda.clienteEmail, mensagem)}
                            className="ds-button-secondary min-h-9 px-3 text-xs"
                          >
                            Escrever <ExternalLink size={12} />
                          </a>
                        ) : null
                      }
                    />
                  )}
                </Secao>

                <Secao titulo="Produtos">
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {venda.itens.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 p-3 text-sm"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Package size={14} className="shrink-0 text-primary" />
                          <span className="truncate">
                            {Number(item.quantidade)}× {item.produtoNome}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {fmtBRL(item.valorTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Secao>

                <Secao titulo="Venda e pagamento">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Info
                      icon={<CalendarDays size={14} />}
                      label="Data da venda"
                      value={formatarDataCobranca(venda.dataVenda)}
                    />
                    <Info label="Valor total" value={fmtBRL(venda.valorTotal)} />
                    <Info label="Forma" value={venda.formaPagamento ?? "Não informada"} />
                    <Info
                      label="Status"
                      value={rotuloStatus(venda.statusPagamento, venda.emAtraso)}
                    />
                  </div>
                  {venda.parcelas && venda.parcelas > 1 && (
                    <div className="rounded-xl border border-info/20 bg-info-bg p-3 text-sm text-info">
                      Parcelamento informado em <strong>{venda.parcelas} vezes</strong>. O modelo
                      atual não registra parcelas individuais, vencimentos separados ou progresso
                      parcial de pagamento.
                    </div>
                  )}
                  {venda.dataVencimento && (
                    <Info
                      label="Vencimento da cobrança"
                      value={formatarDataCobranca(venda.dataVencimento)}
                    />
                  )}
                  {venda.observacao?.trim() && (
                    <Info label="Observações" value={venda.observacao} />
                  )}
                  {venda.gestorNome && <Info label="Gestor responsável" value={venda.gestorNome} />}
                </Secao>

                <Secao titulo="Histórico de contatos">
                  {venda.contatos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum contato registrado.</p>
                  ) : (
                    <ul className="space-y-2">
                      {venda.contatos
                        .slice()
                        .reverse()
                        .map((contato, index) => (
                          <li key={index} className="rounded-xl bg-secondary/50 p-3 text-sm">
                            <div className="flex justify-between gap-3">
                              <strong>{contato.tipo}</strong>
                              <span className="text-xs text-muted-foreground">
                                {fmtDateTime(contato.data)}
                              </span>
                            </div>
                            {contato.resposta && <p className="mt-1">{contato.resposta}</p>}
                          </li>
                        ))}
                    </ul>
                  )}
                  {pendente && (
                    <form
                      className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[10rem_1fr_auto]"
                      onSubmit={(event) => {
                        event.preventDefault();
                        contatoMutation.mutate();
                      }}
                    >
                      <label>
                        <span className="sr-only">Tipo de contato</span>
                        <select
                          className="ds-input"
                          value={tipoContato}
                          onChange={(event) => setTipoContato(event.target.value)}
                        >
                          <option>WhatsApp</option>
                          <option>Ligação</option>
                          <option>Mensagem/SMS</option>
                          <option>Presencial</option>
                          <option>Outro</option>
                        </select>
                      </label>
                      <label>
                        <span className="sr-only">Resposta do cliente</span>
                        <input
                          className="ds-input"
                          value={resposta}
                          onChange={(event) => setResposta(event.target.value)}
                          placeholder="Resposta do cliente (opcional)"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={ocupada}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-secondary px-4 text-sm font-bold text-primary disabled:opacity-60"
                      >
                        <Send size={14} /> Registrar
                      </button>
                    </form>
                  )}
                </Secao>
              </div>

              <DialogFooter className="gap-2 border-t border-border bg-secondary/30 px-5 py-4 md:px-6">
                <button
                  type="button"
                  onClick={() => duplicarMutation.mutate()}
                  disabled={ocupada}
                  className="ds-button-secondary min-h-11 px-4"
                >
                  <Copy size={15} /> Duplicar venda
                </button>
                {pendente && (
                  <button
                    type="button"
                    onClick={() => setConfirmando(true)}
                    disabled={ocupada}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                  >
                    <Check size={15} /> Confirmar pagamento
                  </button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmando}
        onOpenChange={(open) => !open && !pagamentoMutation.isPending && setConfirmando(false)}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação altera o estado financeiro da venda
              {venda ? ` no valor de ${fmtBRL(venda.valorTotal)}` : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pagamentoMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pagamentoMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                pagamentoMutation.mutate();
              }}
            >
              {pagamentoMutation.isPending ? "Confirmando..." : "Sim, confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

function Info({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <div className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="break-words text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function LinhaContato({
  icon,
  value,
  onCopy,
  action,
}: {
  icon: React.ReactNode;
  value: string;
  onCopy: () => void;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 p-3">
      <span className="inline-flex min-w-0 items-center gap-2 text-sm">
        {icon} <span className="truncate">{value}</span>
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={onCopy} className="ds-button-secondary min-h-9 px-3 text-xs">
          <Clipboard size={13} /> Copiar
        </button>
        {action}
      </div>
    </div>
  );
}

function rotuloStatus(status: string, emAtraso: boolean) {
  if (emAtraso) return "Pendente e em atraso";
  return (
    {
      PAGO: "Pago",
      PENDENTE: "Pendente",
      ATRASADO: "Atrasado",
      NAO_SE_APLICA: "Não se aplica",
    }[status] ?? status
  );
}

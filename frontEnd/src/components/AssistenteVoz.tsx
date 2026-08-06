import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import { Mic, Square, Loader2, Check, Pencil, X, Sparkles } from "lucide-react";
import { listarProdutos, listarMateriaPrima } from "@/lib/catalogo.functions";
import { interpretarVoz, type VozResultado } from "@/lib/voz.functions";
import { registrarCompra } from "@/lib/compras.functions";
import { registrarProducao } from "@/lib/producoes.functions";
import { registrarGasto } from "@/lib/gastos.functions";
import { setPrefill } from "@/lib/voz-prefill";
import { fmtBRL, hojeISO } from "@/lib/format";

type Props = { open: boolean; onClose: () => void };

type Status = "idle" | "gravando" | "processando" | "revisar" | "salvando" | "erro" | "sucesso";

const POTES_POR_CAIXA = 6;

export function AssistenteVoz({ open, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => listarProdutos(),
  });
  const { data: mps = [] } = useQuery({
    queryKey: ["materia_prima"],
    queryFn: () => listarMateriaPrima(),
  });

  const fnInterpretar = useApiFn(interpretarVoz);
  const fnCompra = useApiFn(registrarCompra);
  const fnProducao = useApiFn(registrarProducao);
  const fnGasto = useApiFn(registrarGasto);

  const [status, setStatus] = useState<Status>("idle");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<VozResultado | null>(null);
  const [conversa, setConversa] = useState<string>("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const nativeTranscriptRef = useRef<string>("");

  useEffect(() => {
    if (!open) {
      resetAll();
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetAll() {
    stopStream();
    setStatus("idle");
    setErro(null);
    setResultado(null);
    setConversa("");
    chunksRef.current = [];
    nativeTranscriptRef.current = "";
  }

  function stopStream() {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // O reconhecimento pode já ter sido encerrado pelo navegador.
      }
      recognitionRef.current = null;
    }
  }

  async function iniciarGravacao() {
    setErro(null);
    nativeTranscriptRef.current = "";
    try {
      // Inicia SpeechRecognition nativo do navegador
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "pt-BR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          console.log("Transcrição nativa detectada:", text);
          nativeTranscriptRef.current = text;
        };

        recognition.onerror = (event: any) => {
          console.error("Erro no reconhecimento de fala nativo:", event.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime =
        ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
          (window as any).MediaRecorder?.isTypeSupported?.(t),
        ) || "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        stopStream();
        // Pequena pausa para garantir que o evento onresult do reconhecimento nativo seja processado
        await new Promise((resolve) => setTimeout(resolve, 400));

        if (blob.size < 1024) {
          setStatus("erro");
          setErro("Gravação muito curta. Tente novamente segurando o microfone enquanto fala.");
          return;
        }
        await enviarAudio(nativeTranscriptRef.current);
      };
      rec.start();
      setStatus("gravando");
    } catch (e) {
      setStatus("erro");
      setErro("Não consegui acessar o microfone. Verifique as permissões.");
    }
  }

  function pararGravacao() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      setStatus("processando");
    }
  }

  async function enviarAudio(texto?: string) {
    try {
      setStatus("processando");
      if (!texto?.trim()) {
        throw new Error(
          "Não consegui transcrever o áudio neste navegador. Tente novamente usando Chrome ou Edge.",
        );
      }
      const res = await fnInterpretar({
        data: {
          texto: texto.trim(),
          produtos: (produtos as any[]).map((p) => ({ id: p.id, nome: p.nome })),
          materiasPrimas: (mps as any[]).map((m) => ({ id: m.id, nome: m.nome })),
          conversaPrevia: conversa || null,
        },
      });
      setConversa((c) => (c ? c + "\n" : "") + `Usuário: ${res.transcricao}`);
      setResultado(res);
      setStatus("revisar");
    } catch (e) {
      setStatus("erro");
      setErro(e instanceof Error ? e.message : "Erro ao processar áudio");
    }
  }

  async function confirmar() {
    if (!resultado) return;
    setStatus("salvando");
    setErro(null);
    try {
      if (resultado.tipo === "venda" && resultado.venda) {
        throw new Error("Selecione o cliente na opção Editar antes de registrar a venda.");
      } else if (resultado.tipo === "compra" && resultado.compras) {
        const items = resultado.compras.filter(
          (c) => c.materia_prima_id && (c.valor_total ?? 0) > 0 && c.quantidade > 0,
        );
        if (items.length === 0)
          throw new Error(
            "Compra sem ingrediente do estoque. Use Editar para selecionar ou criar.",
          );
        for (const c of items) {
          await fnCompra({
            data: {
              materia_prima_id: c.materia_prima_id!,
              quantidade: c.quantidade,
              valor_total: Number(c.valor_total),
              data_compra: hojeISO(),
              forma_pagamento: "PIX",
              status_pagamento: "PAGO",
              observacao: "Registro realizado pela assistente de voz",
              fornecedor: c.fornecedor,
              categoria: c.categoria,
            },
          });
        }
        qc.invalidateQueries({ queryKey: ["materia_prima"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      } else if (resultado.tipo === "producao" && resultado.producao) {
        const p = resultado.producao;
        if (!p.produto_final_id || !p.potes || !p.unidade)
          throw new Error("Produção incompleta. Use Editar.");
        await fnProducao({
          data: {
            produto_final_id: p.produto_final_id,
            quantidade_produzida: p.potes,
            data_producao: hojeISO(),
            potes: p.potes,
            unidade: p.unidade,
            observacoes: p.observacoes,
            ingredientes: [],
          },
        });
        qc.invalidateQueries({ queryKey: ["producoes"] });
        qc.invalidateQueries({ queryKey: ["produtos"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      } else if (resultado.tipo === "gasto" && resultado.gasto) {
        const g = resultado.gasto;
        if (!g.valor || !g.descricao) throw new Error("Gasto incompleto. Use Editar.");
        await fnGasto({
          data: {
            descricao: g.descricao,
            categoria: g.categoria,
            valor: Number(g.valor),
            data_lancamento: hojeISO(),
            data_vencimento: null,
            forma_pagamento: "PIX",
            status_pagamento: "PAGO",
            observacao: "Registro realizado pela assistente de voz",
          },
        });
        qc.invalidateQueries({ queryKey: ["gastos"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      } else {
        throw new Error("Não entendi o tipo de registro. Tente novamente.");
      }
      setStatus("sucesso");
      setTimeout(() => {
        onClose();
        const dest =
          resultado.tipo === "venda"
            ? "/vendas"
            : resultado.tipo === "compra"
              ? "/estoque"
              : resultado.tipo === "producao"
                ? "/producao"
                : "/gastos";
        navigate({ to: dest });
      }, 900);
    } catch (e) {
      setStatus("erro");
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  function editar() {
    if (!resultado) return;
    if (resultado.tipo === "venda" && resultado.venda) {
      setPrefill("venda", resultado.venda);
      onClose();
      navigate({ to: "/registrar/venda" });
    } else if (resultado.tipo === "compra" && resultado.compras?.[0]) {
      setPrefill("compra", resultado.compras[0]);
      onClose();
      navigate({ to: "/registrar/compra" });
    } else if (resultado.tipo === "producao" && resultado.producao) {
      setPrefill("producao", resultado.producao);
      onClose();
      navigate({ to: "/registrar/producao" });
    } else if (resultado.tipo === "gasto" && resultado.gasto) {
      setPrefill("gasto", resultado.gasto);
      onClose();
      navigate({ to: "/registrar/gastos" });
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-brown/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => status !== "salvando" && status !== "gravando" && onClose()}
    >
      <div
        className="bg-card rounded-t-2xl sm:rounded-2xl shadow-warm-lg w-full sm:max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vovo-gradient pt-6 pb-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-gold shadow-warm-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="font-display text-lg font-bold text-primary leading-tight">
                Assistente da Vovó
              </div>
              <div className="text-[11px] text-brown-mid">Fale e eu registro pra você</div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={status === "salvando" || status === "gravando"}
            className="w-9 h-9 rounded-full bg-card/70 hover:bg-card text-brown-mid flex items-center justify-center disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {(status === "idle" || status === "erro") && (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Toque no microfone e diga, por exemplo:
                <br />
                <em>"Vendi 2 caixas de biriba pra dona Maria"</em>,{" "}
                <em>"Comprei 100kg de açúcar por R$450"</em> ou <em>"Paguei R$120 de energia"</em>.
              </p>
              <button
                onClick={iniciarGravacao}
                className="mx-auto w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-warm-md hover:bg-primary-dark transition"
              >
                <Mic size={32} />
              </button>
              {erro && (
                <div className="bg-error-bg border-l-4 border-error text-error rounded-md px-3 py-2 text-xs text-left">
                  {erro}
                </div>
              )}
            </div>
          )}

          {status === "gravando" && (
            <div className="text-center space-y-3">
              <div className="text-sm font-semibold text-primary">Estou ouvindo...</div>
              <button
                onClick={pararGravacao}
                className="mx-auto w-20 h-20 rounded-full bg-error text-white flex items-center justify-center shadow-warm-md animate-pulse"
              >
                <Square size={28} fill="currentColor" />
              </button>
              <div className="text-xs text-muted-foreground">Toque para parar quando terminar.</div>
            </div>
          )}

          {status === "processando" && (
            <div className="text-center space-y-3 py-4">
              <Loader2 className="mx-auto animate-spin text-primary" size={36} />
              <div className="text-sm text-muted-foreground">Entendendo o que você disse...</div>
            </div>
          )}

          {status === "revisar" && resultado && <RevisaoCard resultado={resultado} />}

          {status === "revisar" && resultado?.perguntaProximo && (
            <div className="bg-gold-bg/60 border border-gold-light/40 rounded-lg p-3 text-sm">
              <strong className="text-primary">Vovó pergunta:</strong> {resultado.perguntaProximo}
              <div className="mt-2">
                <button
                  onClick={iniciarGravacao}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                >
                  <Mic size={12} /> Responder por voz
                </button>
              </div>
            </div>
          )}

          {status === "salvando" && (
            <div className="text-center py-4">
              <Loader2 className="mx-auto animate-spin text-primary" size={28} />
              <div className="text-xs mt-2 text-muted-foreground">Salvando...</div>
            </div>
          )}

          {status === "sucesso" && (
            <div className="text-center py-4 space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-success/15 text-success flex items-center justify-center">
                <Check size={28} />
              </div>
              <div className="text-sm font-semibold text-foreground">Registrado com sucesso!</div>
            </div>
          )}

          {erro && status !== "idle" && status !== "erro" && (
            <div className="bg-error-bg border-l-4 border-error text-error rounded-md px-3 py-2 text-xs">
              {erro}
            </div>
          )}
        </div>

        {status === "revisar" && resultado && resultado.tipo !== "desconhecido" && (
          <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-full border border-border text-brown-mid font-bold text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={editar}
              className="flex-1 px-4 py-3 rounded-full border-2 border-primary text-primary font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              <Pencil size={14} /> Editar
            </button>
            <button
              onClick={resultado.tipo === "venda" ? editar : confirmar}
              className="flex-1 px-4 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              <Check size={14} /> {resultado.tipo === "venda" ? "Selecionar cliente" : "Confirmar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RevisaoCard({ resultado }: { resultado: VozResultado }) {
  const tipoLabel: Record<string, string> = {
    venda: "Venda",
    compra: "Compra de produto",
    producao: "Produção",
    gasto: "Gasto geral",
    desconhecido: "Não identificado",
  };
  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground">
        Você disse
      </div>
      <div className="bg-secondary/60 rounded-md p-3 text-sm italic">"{resultado.transcricao}"</div>

      <div className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground mt-2">
        Revisar registro
      </div>
      <div className="bg-card border border-border rounded-lg p-3 space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Tipo:</span>{" "}
          <strong className="text-primary">{tipoLabel[resultado.tipo]}</strong>
        </div>

        {resultado.tipo === "venda" && resultado.venda && (
          <>
            {resultado.venda.itens.map((it, idx) => (
              <div key={idx} className="border-t pt-2">
                <div>
                  <span className="text-muted-foreground">Produto:</span> {it.produto_nome ?? "—"}{" "}
                  {!it.produto_final_id && (
                    <span className="text-warning text-xs">(não está no estoque)</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Quantidade:</span> {it.quantidade}{" "}
                  {it.tipo === "caixa"
                    ? `caixa(s) = ${it.quantidade * POTES_POR_CAIXA} potes`
                    : "pote(s)"}
                </div>
                <div>
                  <span className="text-muted-foreground">Preço/pote:</span>{" "}
                  {it.preco_unitario != null ? fmtBRL(it.preco_unitario) : "—"}
                </div>
              </div>
            ))}
            <div className="border-t pt-2 text-xs">
              <span className="text-muted-foreground">Pagamento:</span>{" "}
              {resultado.venda.forma_pagamento}
              {resultado.venda.comprador ? ` · Cliente: ${resultado.venda.comprador}` : ""}
            </div>
          </>
        )}

        {resultado.tipo === "compra" &&
          resultado.compras &&
          resultado.compras.map((c, idx) => (
            <div key={idx} className="border-t pt-2">
              <div>
                <span className="text-muted-foreground">Produto:</span> {c.produto_nome ?? "—"}{" "}
                {!c.materia_prima_id && (
                  <span className="text-warning text-xs">(não está no estoque)</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Quantidade:</span> {c.quantidade}{" "}
                {c.unidade}
              </div>
              <div>
                <span className="text-muted-foreground">Valor total:</span>{" "}
                {c.valor_total != null ? fmtBRL(c.valor_total) : "—"}
              </div>
              {c.fornecedor && (
                <div>
                  <span className="text-muted-foreground">Fornecedor:</span> {c.fornecedor}
                </div>
              )}
            </div>
          ))}

        {resultado.tipo === "producao" && resultado.producao && (
          <>
            <div>
              <span className="text-muted-foreground">Produto:</span>{" "}
              {resultado.producao.produto_nome ?? "—"}{" "}
              {!resultado.producao.produto_final_id && (
                <span className="text-warning text-xs">(não está no catálogo)</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Potes:</span>{" "}
              {resultado.producao.potes ?? "—"} × {resultado.producao.unidade ?? "—"} uni.
            </div>
            {resultado.producao.observacoes && (
              <div>
                <span className="text-muted-foreground">Obs:</span> {resultado.producao.observacoes}
              </div>
            )}
          </>
        )}

        {resultado.tipo === "gasto" && resultado.gasto && (
          <>
            <div>
              <span className="text-muted-foreground">Descrição:</span> {resultado.gasto.descricao}
            </div>
            <div>
              <span className="text-muted-foreground">Categoria:</span> {resultado.gasto.categoria}
            </div>
            <div>
              <span className="text-muted-foreground">Valor:</span>{" "}
              {resultado.gasto.valor != null ? fmtBRL(resultado.gasto.valor) : "—"}
            </div>
          </>
        )}

        {resultado.faltando.length > 0 && (
          <div className="border-t pt-2 text-xs text-warning">
            <strong>Faltando:</strong> {resultado.faltando.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Bot, Mic, Package, Send, X } from "lucide-react";
import { conversarComAssistente, type MensagemConversa } from "@/lib/assistente.functions";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenVoice: () => void;
};

const sugestoes = [
  { texto: "Ver estoque crítico", acaoRapida: "VERIFICAR_ESTOQUE" as const, icon: Package },
];

export function AssistenteChat({ open, onClose, onOpenVoice }: Props) {
  const [mensagens, setMensagens] = useState<MensagemConversa[]>([
    {
      autor: "assistente",
      texto: "Oi! Eu sou a Vovó AI. Como posso ajudar com o seu negócio hoje?",
    },
  ]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando]);

  if (!open) return null;

  async function enviar(mensagem = texto, acaoRapida?: "VERIFICAR_ESTOQUE") {
    const limpa = mensagem.trim();
    if (!limpa || enviando) return;

    const historico = mensagens.slice(-20);
    setMensagens((atual) => [...atual, { autor: "usuario", texto: limpa }]);
    setTexto("");
    setEnviando(true);

    try {
      const resultado = await conversarComAssistente({
        ...(acaoRapida ? { acaoRapida } : { mensagem: limpa }),
        historico,
      });
      setMensagens((atual) => [...atual, { autor: "assistente", texto: resultado.resposta }]);
    } catch (error) {
      setMensagens((atual) => [
        ...atual,
        {
          autor: "assistente",
          texto:
            error instanceof Error
              ? error.message
              : "Não consegui responder agora. Tente novamente em instantes.",
        },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 md:left-60 z-50 bg-background/95 backdrop-blur-sm p-3 sm:p-5 md:p-8">
      <section className="h-full max-w-6xl mx-auto bg-card border border-border rounded-2xl shadow-warm-lg overflow-hidden flex flex-col">
        <header className="px-5 sm:px-7 py-5 border-b border-border bg-secondary/40 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Bot size={23} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold text-foreground">Vovó AI</h2>
            <p className="text-sm text-muted-foreground truncate">
              Sua assistente carinhosa para os negócios
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Fechar conversa"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-6 space-y-5">
          {mensagens.map((mensagem, index) => (
            <div
              key={`${mensagem.autor}-${index}`}
              className={[
                "flex items-end gap-3",
                mensagem.autor === "usuario" ? "justify-end" : "justify-start",
              ].join(" ")}
            >
              {mensagem.autor === "assistente" && (
                <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Bot size={15} />
                </span>
              )}
              <div
                className={[
                  "max-w-[85%] sm:max-w-[70%] rounded-2xl px-5 py-3 text-sm sm:text-base leading-relaxed shadow-warm-sm whitespace-pre-wrap",
                  mensagem.autor === "usuario"
                    ? "bg-brown-mid text-white rounded-br-md"
                    : "bg-primary-bg text-foreground rounded-bl-md",
                ].join(" ")}
              >
                {mensagem.texto}
              </div>
            </div>
          ))}
          {enviando && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Bot size={15} />
              </span>
              Consultando o caderninho...
            </div>
          )}
          <div ref={fimRef} />
        </div>

        <footer className="border-t border-border bg-secondary/30 p-4 sm:p-5 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sugestoes.map(({ texto: sugestao, acaoRapida, icon: Icon }) => (
              <button
                key={sugestao}
                type="button"
                onClick={() => enviar(sugestao, acaoRapida)}
                disabled={enviando}
                className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-xs sm:text-sm font-medium flex items-center gap-2 hover:border-primary disabled:opacity-50"
              >
                <Icon size={15} /> {sugestao}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              enviar();
            }}
            className="rounded-full border-2 border-primary/20 bg-card p-1.5 pl-5 flex items-center gap-2 focus-within:border-primary/50"
          >
            <input
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Pergunte à Vovó AI..."
              maxLength={2000}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm sm:text-base"
            />
            <button
              type="button"
              onClick={onOpenVoice}
              className="w-10 h-10 rounded-full bg-secondary text-brown-mid flex items-center justify-center hover:bg-primary hover:text-primary-foreground"
              aria-label="Conversar por voz"
            >
              <Mic size={18} />
            </button>
            <button
              type="submit"
              disabled={!texto.trim() || enviando}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
              aria-label="Enviar mensagem"
            >
              <Send size={17} />
            </button>
          </form>
        </footer>
      </section>
    </div>
  );
}

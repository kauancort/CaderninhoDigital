import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Bot,
  CircleDollarSign,
  Mic,
  Package,
  ReceiptText,
  Send,
  WalletCards,
  X,
} from "lucide-react";
import {
  conversarComAssistente,
  mensagemErroAssistente,
  mensagemProgressoAssistente,
  type AcaoRapidaAssistente,
  type AssistenteResposta,
  type MensagemConversa,
} from "@/lib/assistente.functions";

type Props = { open: boolean; onClose: () => void; onOpenVoice: () => void };
type MensagemUi = MensagemConversa & { resultado?: AssistenteResposta; erro?: boolean };

const sugestoes: Array<{ texto: string; acaoRapida: AcaoRapidaAssistente; icon: typeof Package }> =
  [
    { texto: "Estoque crítico", acaoRapida: "VERIFICAR_ESTOQUE", icon: Package },
    { texto: "Resumo de vendas", acaoRapida: "RESUMIR_VENDAS", icon: CircleDollarSign },
    { texto: "Resumo de gastos", acaoRapida: "RESUMIR_GASTOS", icon: ReceiptText },
    { texto: "Contas a receber", acaoRapida: "VERIFICAR_RECEBIVEIS", icon: WalletCards },
  ];

function dataBr(valor?: string | null) {
  if (!valor) return null;
  const [ano, mes, dia] = valor.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function atualizadoBr(valor?: string | null) {
  return valor
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(valor),
      )
    : null;
}

function formatarMoeda(valor: unknown) {
  return typeof valor === "number"
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)
    : "Não informado";
}

function formatarNumero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

function quantidadeComUnidade(valor: number | null, unidade: string) {
  return valor === null ? unidade : `${formatarNumero(valor)} ${unidade}`;
}

function CardsValores({ itens }: { itens: Array<{ rotulo: string; valor: string }> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {itens.map((item) => (
        <div key={item.rotulo} className="rounded-xl border border-border bg-card px-4 py-3">
          <dt className="text-sm font-semibold text-muted-foreground">{item.rotulo}</dt>
          <dd className="mt-1 text-xl font-bold text-foreground">{item.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function DadosResultado({ dados }: { dados: NonNullable<AssistenteResposta["dados"]> }) {
  switch (dados.tipo) {
    case "VENDAS":
      return <CardsValores itens={[
        { rotulo: "Total de vendas", valor: formatarMoeda(dados.valorTotalValido) },
        { rotulo: "Quantidade de vendas", valor: formatarNumero(dados.quantidadeVendas) },
        { rotulo: "Valor médio por venda", valor: formatarMoeda(dados.ticketMedio) },
        { rotulo: "Itens vendidos", valor: formatarNumero(dados.quantidadeItens) },
      ]} />;
    case "GASTOS":
      return <CardsValores itens={[
        { rotulo: "Total de gastos", valor: formatarMoeda(dados.totalGastos) },
        { rotulo: "Lançamentos", valor: formatarNumero(dados.quantidadeLancamentos) },
      ]} />;
    case "RECEBIVEIS":
      return <CardsValores itens={[
        { rotulo: "Total em aberto", valor: formatarMoeda(dados.totalEmAberto) },
        { rotulo: "Total vencido", valor: formatarMoeda(dados.totalVencido) },
        { rotulo: "Total a vencer", valor: formatarMoeda(dados.totalAVencer) },
        { rotulo: "Cobranças", valor: formatarNumero(dados.quantidadeCobrancas) },
      ]} />;
    case "ESTOQUE":
      return <>
        <CardsValores itens={[
          { rotulo: "Itens críticos", valor: formatarNumero(dados.itensCriticos) },
          { rotulo: "Itens avaliados", valor: formatarNumero(dados.itensAvaliados) },
        ]} />
        {dados.itens.length > 0 && <details className="rounded-xl border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer font-semibold min-h-11 flex items-center">Ver itens críticos</summary>
          <ul className="mt-2 space-y-2">{dados.itens.map((item) => <li key={`${item.nome}-${item.unidade}`}>
            <strong>{item.nome}</strong>: {formatarNumero(item.quantidadeAtual)} {item.unidade}
            <span className="text-muted-foreground"> (mínimo: {formatarNumero(item.estoqueMinimo)})</span>
          </li>)}</ul>
        </details>}
      </>;
    case "COMPARACAO_VENDAS_GASTOS":
      return <>
        <CardsValores itens={[
          { rotulo: "Vendas", valor: formatarMoeda(dados.comparacao.vendas) },
          { rotulo: "Gastos", valor: formatarMoeda(dados.comparacao.gastos) },
          { rotulo: "Diferença", valor: formatarMoeda(dados.comparacao.diferenca) },
        ]} />
        <p className="font-semibold">{dados.comparacao.diferenca >= 0 ? "As vendas ficaram acima dos gastos." : "Os gastos ficaram acima das vendas."}</p>
        <p className="text-muted-foreground">A diferença não representa necessariamente lucro líquido.</p>
      </>;
    case "COMPARACAO_VENDAS_PERIODOS":
      return <>
        <CardsValores itens={[
          { rotulo: `Período anterior (${dados.comparacao.diasPeriodoAnterior} dias)`, valor: formatarMoeda(dados.comparacao.vendasPeriodoAnterior) },
          { rotulo: `Período atual (${dados.comparacao.diasPeriodoAtual} dias)`, valor: formatarMoeda(dados.comparacao.vendasPeriodoAtual) },
          { rotulo: "Diferença", valor: formatarMoeda(dados.comparacao.diferenca) },
        ]} />
        <p className="font-semibold">{dados.comparacao.diferenca >= 0 ? "As vendas aumentaram." : "As vendas diminuíram."}</p>
      </>;
    case "CUSTO_PRODUTO":
      return <CardsValores itens={[
        { rotulo: "Custo atual conhecido", valor: formatarMoeda(dados.custoAtualConhecido) },
        { rotulo: "Custo pela ficha", valor: formatarMoeda(dados.custoUnitarioFicha) },
        { rotulo: "Componentes sem custo", valor: formatarNumero(dados.componentesSemCusto) },
      ]} />;
    case "MARGEM_PRODUTO":
      return <>
        <CardsValores itens={[
          { rotulo: "Custo conhecido por unidade", valor: formatarMoeda(dados.custoUnitarioConhecido) },
          { rotulo: "Preço médio de venda", valor: formatarMoeda(dados.precoMedioVenda) },
          { rotulo: "Margem bruta conhecida", valor: formatarMoeda(dados.margemBrutaConhecidaUnitaria) },
        ]} />
        <p className="font-semibold">{dados.situacao === "MARGEM_CONHECIDA_NEGATIVA"
          ? "Os custos cadastrados estão acima do preço médio de venda."
          : dados.situacao === "INSUFICIENTE" ? "Ainda faltam dados para calcular a margem conhecida."
            : "O preço médio está acima dos custos cadastrados."}</p>
        <p className="text-muted-foreground">Isso não é lucro líquido. Custos não cadastrados: {dados.custosNaoModelados.join(", ")}.</p>
        {dados.componentes.length > 0 && <details className="rounded-xl border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer font-semibold min-h-11 flex items-center">Ver o que mais pesa no custo</summary>
          <ul className="mt-2 space-y-2">{dados.componentes.map((item) => <li key={item.nome}>
            <strong>{item.nome}</strong>: {formatarMoeda(item.custoConhecido)}
            {item.participacaoPercentual !== null && <span className="text-muted-foreground"> ({formatarNumero(item.participacaoPercentual)}%)</span>}
          </li>)}</ul>
        </details>}
      </>;
    case "ANALISE_COMPOSTA":
      return <p className="rounded-xl border border-border bg-card px-4 py-3 text-muted-foreground">
        A explicação acima reúne os dados confirmados das áreas consultadas.
      </p>;
    case "COMPRAS_INSUMO":
      return <>
        <CardsValores itens={[
          { rotulo: "Total comprado", valor: formatarMoeda(dados.valorTotal) },
          { rotulo: "Insumos analisados", valor: formatarNumero(dados.insumosAnalisados) },
          { rotulo: "Economia comprovada", valor: dados.simulacaoMensal.economiaComprovavel
            ? formatarMoeda(dados.simulacaoMensal.economiaComprovada) : "Ainda não calculável" },
        ]} />
        <p className="text-muted-foreground">{dados.simulacaoMensal.limitacao}</p>
        {dados.itens.length > 0 && <details className="rounded-xl border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer font-semibold min-h-11 flex items-center">Ver padrão das compras</summary>
          <ul className="mt-2 space-y-3">{dados.itens.map((item) => <li key={item.materiaPrimaId}
            className="rounded-lg bg-secondary/30 p-3">
            <strong>Insumo {item.materiaPrimaId}</strong>
            <span className="block">{formatarNumero(item.quantidadeCompras)} compras · frequência {item.frequenciaObservada.toLowerCase()}</span>
            <span className="block text-muted-foreground">Preço médio: {formatarMoeda(item.precoMedioPonderado)} por {item.unidade}</span>
          </li>)}</ul>
        </details>}
      </>;
    case "COMPARACAO_MERCADO":
      return <>
        <p className="font-semibold">Comparação de preço: {dados.materiaPrima}</p>
        {dados.metricasHistoricas && <CardsValores itens={[
          { rotulo: "Última compra por unidade", valor: formatarMoeda(dados.metricasHistoricas.ultimaCompraPreco) },
          { rotulo: "Média dos últimos 30 dias", valor: formatarMoeda(dados.metricasHistoricas.media30Dias) },
          { rotulo: "Média dos últimos 90 dias", valor: formatarMoeda(dados.metricasHistoricas.media90Dias) },
        ]} />}
        <div className="rounded-xl border-2 border-primary bg-primary-bg p-4" role="status">
          <p className="text-lg font-bold">{dados.situacao === "CUSTO_INTERNO_MENOR"
            ? `Seu custo atual é menor por ${formatarMoeda(dados.diferencaExternaMenosInterna)}.`
            : dados.situacao === "OFERTA_EXTERNA_MENOR"
              ? `Existe economia potencial de ${formatarMoeda(dados.economiaEstimada)}.`
              : dados.situacao === "EQUIVALENTE" ? "Os custos são equivalentes."
                : dados.situacao === "SOMENTE_PEDIDO_MINIMO_MAIOR"
                  ? "Encontrei ofertas, mas todas exigem uma compra maior."
                  : "Não há ofertas comparáveis suficientes."}</p>
          {dados.percentualDiferenca !== null && <p className="mt-1 text-muted-foreground">
            Diferença de {formatarNumero(dados.percentualDiferenca)}% para a quantidade pesquisada.
          </p>}
        </div>
        <CardsValores itens={[
          { rotulo: `Seu custo atual (${quantidadeComUnidade(dados.quantidadeAlvo, dados.unidade)})`, valor: formatarMoeda(dados.custoInternoComparavel) },
          { rotulo: `Melhor oferta externa (${quantidadeComUnidade(dados.quantidadeAlvo, dados.unidade)})`, valor: formatarMoeda(dados.menorCustoExterno) },
          { rotulo: dados.situacao === "CUSTO_INTERNO_MENOR" ? "Seu custo é menor por" : "Economia potencial", valor: dados.situacao === "CUSTO_INTERNO_MENOR" ? formatarMoeda(dados.diferencaExternaMenosInterna) : formatarMoeda(dados.economiaEstimada) },
        ]} />
        {(dados.fontes.length > 0 || dados.ofertas.length > 0) && <details className="rounded-xl border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer font-semibold min-h-11 flex items-center">Ver fontes pesquisadas</summary>
          {dados.fontes.length > 0 && <ul className="mt-2 space-y-3">{dados.fontes.map((fonte) => <li key={fonte.fonteId} className="rounded-lg border border-border p-3">
            <a href={fonte.url} target="_blank" rel="noreferrer" className="font-semibold underline">{fonte.titulo}</a>
            <span className="block text-muted-foreground">{fonte.status === "VALIDADA" ? "Fonte validada" : fonte.status === "REJEITADA" ? "Fonte rejeitada" : "Validação não concluída"}</span>
            {fonte.motivo && <span className="block text-muted-foreground">{fonte.motivo}</span>}
          </li>)}</ul>}
          {dados.ofertas.length > 0 && <>
            <p className="mt-4 font-semibold">{dados.situacao === "INSUFICIENTE" ? "Ofertas estruturadas (sem conclusão)" : "Ofertas validadas"}</p>
            <ul className="mt-2 space-y-3">{dados.ofertas.map((oferta, indice) => <li key={`${oferta.url}-${indice}`} className="rounded-lg border border-border p-3">
              {indice === 0 && oferta.compativelQuantidadeAlvo && <span className="mb-1 inline-block rounded-full bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">Melhor oferta compatível</span>}
              <a href={oferta.url} target="_blank" rel="noreferrer" className="font-semibold underline">
                {oferta.titulo}
              </a>
              <span className="block">Preço convertido: {formatarMoeda(oferta.precoUnitario)} por {dados.unidade}</span>
              <span className="block">Total para {formatarNumero(oferta.quantidadeCalculada)} {dados.unidade}: {formatarMoeda(oferta.custoTotal)}</span>
              {oferta.localizacao && <span className="block">Localização: {oferta.localizacao}</span>}
              {oferta.pedidoMinimo !== null && <span className="block font-medium">Pedido mínimo: {formatarNumero(oferta.pedidoMinimo)} {dados.unidade}</span>}
              {oferta.mesesCoberturaPedidoMinimo !== null && <span className="block">Esse mínimo cobre aproximadamente {formatarNumero(oferta.mesesCoberturaPedidoMinimo)} mês(es) de consumo.</span>}
              {oferta.status.includes("ESTOQUE_EXCESSIVO_PROVAVEL") && <span className="block font-semibold text-warning-foreground">Pode gerar estoque excessivo para o consumo atual.</span>}
              {oferta.status.includes("PEDIDO_MINIMO_ACIMA_DA_QUANTIDADE") && <span className="block font-semibold text-warning-foreground">Exige comprar mais do que a quantidade consultada.</span>}
              <span className="block text-muted-foreground">Evidência: “{oferta.evidenciaPreco}”</span>
              <span className="block text-muted-foreground">{oferta.freteIncluido ? "Frete identificado e incluído." : "Frete não informado na fonte."}</span>
            </li>)}</ul>
          </>}
          {dados.ofertas.length === 0 && <p className="mt-2 text-muted-foreground">Nenhuma oferta foi validada; os links acima mostram as fontes consultadas.</p>}
        </details>}
      </>;
  }
}

function DetalhesResposta({ resultado }: { resultado: AssistenteResposta }) {
  const parcial = resultado.qualidade === "PARCIAL" || resultado.avisos.length > 0;
  const inicio = dataBr(resultado.periodoInicio);
  const fim = dataBr(resultado.periodoFim);
  const atualizado = atualizadoBr(resultado.atualizadoEm);
  const semDados = !resultado.dados;
  return (
    <div className="mt-3 border-t border-border/70 pt-3 space-y-2 text-sm">
      {semDados && <p className="font-medium">Nenhum dado foi encontrado para apresentar.</p>}
      <p className="text-muted-foreground">
        <strong className="text-foreground">Origem:</strong> dados do sistema
      </p>
      {(inicio || fim) && (
        <p className="text-muted-foreground">
          <strong className="text-foreground">Período:</strong> {inicio}
          {fim && fim !== inicio ? ` até ${fim}` : ""}
        </p>
      )}
      {atualizado && (
        <p className="text-muted-foreground">
          <strong className="text-foreground">Atualizado:</strong> {atualizado}
        </p>
      )}
      {parcial && (
        <div
          className="rounded-xl border border-warning bg-warning-bg p-3"
          role="note"
          aria-label="Avisos da consulta"
        >
          <p className="font-semibold text-foreground">Resultado com observações</p>
          {resultado.avisos.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 space-y-1">
              {resultado.avisos.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">Alguns dados podem estar incompletos.</p>
          )}
        </div>
      )}
      {resultado.dados && <section className="space-y-3" aria-label="Valores da consulta"><DadosResultado dados={resultado.dados} /></section>}
    </div>
  );
}

export function AssistenteChat({ open, onClose, onOpenVoice }: Props) {
  const [mensagens, setMensagens] = useState<MensagemUi[]>([
    {
      autor: "assistente",
      texto:
        "Olá! Posso consultar os dados do negócio. Escolha uma opção abaixo ou faça uma pergunta.",
    },
  ]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [segundosEspera, setSegundosEspera] = useState(0);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focoAnteriorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    focoAnteriorRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => focoAnteriorRef.current?.focus();
  }, [open]);
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando]);
  useEffect(() => {
    if (!enviando) { setSegundosEspera(0); return; }
    const inicio = Date.now();
    const timer = window.setInterval(() => setSegundosEspera(
      Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [enviando]);

  async function enviar(mensagem = texto, acaoRapida?: AcaoRapidaAssistente) {
    const limpa = mensagem.trim();
    if (!limpa || enviando) return;
    const historico = mensagens
      .slice(-10)
      .map(({ autor, texto: conteudo }) => ({ autor, texto: conteudo }));
    setMensagens((atual) => [...atual, { autor: "usuario", texto: limpa }]);
    setTexto("");
    setEnviando(true);
    try {
      const resultado = await conversarComAssistente({
        ...(acaoRapida ? { acaoRapida } : { mensagem: limpa }),
        historico,
      });
      setMensagens((atual) => [
        ...atual,
        { autor: "assistente", texto: resultado.resposta, resultado },
      ]);
    } catch (error) {
      setMensagens((atual) => [
        ...atual,
        { autor: "assistente", texto: mensagemErroAssistente(error), erro: true },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm md:left-60" />
        <Dialog.Content
          className="fixed inset-3 sm:inset-5 md:left-[calc(15rem+2rem)] md:inset-y-8 md:right-8 z-50 max-w-6xl md:mx-auto bg-card border border-border rounded-2xl shadow-warm-lg overflow-hidden flex flex-col focus:outline-none"
          aria-describedby="assistente-descricao"
        >
          <header className="px-4 sm:px-7 py-4 border-b border-border bg-secondary/40 flex items-center gap-3">
            <span
              className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <Bot size={23} />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-2xl font-bold">Vovó AI</Dialog.Title>
              <Dialog.Description
                id="assistente-descricao"
                className="text-sm text-muted-foreground"
              >
                Consultas simples com dados do sistema
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="w-12 h-12 rounded-full border border-border bg-card flex items-center justify-center hover:bg-secondary"
              aria-label="Fechar conversa"
            >
              <X size={20} />
            </Dialog.Close>
          </header>

          <div
            className="flex-1 overflow-y-auto px-4 sm:px-7 py-5 space-y-5"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {mensagens.map((mensagem, index) => (
              <div
                key={`${mensagem.autor}-${index}`}
                className={`flex items-end gap-3 ${mensagem.autor === "usuario" ? "justify-end" : "justify-start"}`}
              >
                {mensagem.autor === "assistente" && (
                  <span
                    className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <Bot size={15} />
                  </span>
                )}
                <article
                  className={`max-w-[92%] sm:max-w-[75%] rounded-2xl px-4 sm:px-5 py-3 text-base leading-relaxed shadow-warm-sm whitespace-pre-wrap ${mensagem.autor === "usuario" ? "bg-brown-mid text-white rounded-br-md" : mensagem.erro ? "bg-error-bg border border-error text-foreground rounded-bl-md" : "bg-primary-bg text-foreground rounded-bl-md"}`}
                >
                  <p>{mensagem.texto}</p>
                  {mensagem.resultado && <DetalhesResposta resultado={mensagem.resultado} />}
                </article>
              </div>
            ))}
            {enviando && (
              <div
                className="flex items-center gap-3 text-base text-muted-foreground"
                role="status"
              >
                <span
                  className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Bot size={15} />
                </span>
                <span>{mensagemProgressoAssistente(segundosEspera)}</span>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <footer className="border-t border-border bg-secondary/30 p-3 sm:p-5 space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Consultas rápidas">
              {sugestoes.map(({ texto: sugestao, acaoRapida, icon: Icon }) => (
                <button
                  key={acaoRapida}
                  type="button"
                  onClick={() => enviar(sugestao, acaoRapida)}
                  disabled={enviando}
                  className="shrink-0 min-h-12 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold flex items-center gap-2 hover:border-primary disabled:opacity-50"
                >
                  <Icon size={18} aria-hidden="true" />
                  {sugestao}
                </button>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                enviar();
              }}
              className="rounded-2xl border-2 border-primary/30 bg-card p-1.5 pl-4 flex items-center gap-2 focus-within:border-primary"
            >
              <label htmlFor="pergunta-assistente" className="sr-only">
                Escreva sua pergunta
              </label>
              <input
                ref={inputRef}
                id="pergunta-assistente"
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                placeholder="Escreva sua pergunta..."
                maxLength={2000}
                disabled={enviando}
                className="flex-1 min-w-0 min-h-11 bg-transparent outline-none text-base"
              />
              <button
                type="button"
                onClick={onOpenVoice}
                disabled={enviando}
                className="w-11 h-11 rounded-full bg-secondary text-brown-mid flex items-center justify-center hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                aria-label="Abrir lançamento por voz"
              >
                <Mic size={19} />
              </button>
              <button
                type="submit"
                disabled={!texto.trim() || enviando}
                className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                aria-label="Enviar pergunta"
              >
                <Send size={18} />
              </button>
            </form>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

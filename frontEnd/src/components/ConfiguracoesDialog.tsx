import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  FileSearch,
  Save,
  Settings,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { atualizarMeuPerfil } from "@/lib/auth.functions";
import {
  auditarDadosLegados,
  importarContatosDadosLegados,
  importarCatalogoDadosLegados,
  simularImportacaoDadosLegados,
  tratarCatalogoDadosLegados,
  verificarContatosDadosLegados,
  validarHistoricosDadosLegados,
  validarDecisoesCatalogoDadosLegados,
  type LegacyCatalogDecision,
  type LegacyCatalogDecisionResponse,
  type LegacyCatalogImportResponse,
  type LegacyContactImportResponse,
  type LegacyContactPreviewResponse,
  type LegacyAuditResponse,
  type LegacyCatalogTreatmentResponse,
  type LegacyImportSimulationResponse,
  type LegacyHistoricalTreatmentResponse,
} from "@/lib/legacy-data.functions";
import { updateSessionUser, type User } from "@/lib/user-session";

type DecisionDraft = Pick<LegacyCatalogDecision, "classificacaoFinal" | "observacao">;
type ConfiguracoesSecao = "menu" | "perfil" | "dados";
type EtapaImportacao = 1 | 2 | 3 | 4;

export function ConfiguracoesDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}) {
  const [nome, setNome] = useState(user.nome);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [secao, setSecao] = useState<ConfiguracoesSecao>("menu");
  const [etapaAberta, setEtapaAberta] = useState<EtapaImportacao | null>(null);
  const [arquivosLegados, setArquivosLegados] = useState<File[]>([]);
  const [auditoriaLegados, setAuditoriaLegados] = useState<LegacyAuditResponse | null>(null);
  const [tratamentoLegados, setTratamentoLegados] = useState<LegacyCatalogTreatmentResponse | null>(
    null,
  );
  const [simulacaoLegados, setSimulacaoLegados] = useState<LegacyImportSimulationResponse | null>(
    null,
  );
  const [historicosLegados, setHistoricosLegados] =
    useState<LegacyHistoricalTreatmentResponse | null>(null);
  const [decisoesLegados, setDecisoesLegados] = useState<Record<string, DecisionDraft>>({});
  const [resultadoDecisoes, setResultadoDecisoes] = useState<LegacyCatalogDecisionResponse | null>(
    null,
  );
  const [resultadoImportacao, setResultadoImportacao] =
    useState<LegacyCatalogImportResponse | null>(null);
  const [resultadoContatos, setResultadoContatos] = useState<LegacyContactImportResponse | null>(
    null,
  );
  const [previsualizacaoContatos, setPrevisualizacaoContatos] =
    useState<LegacyContactPreviewResponse | null>(null);

  useEffect(() => {
    if (open) {
      setSecao("menu");
      setEtapaAberta(null);
      setNome(user.nome);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
      setArquivosLegados([]);
      setAuditoriaLegados(null);
      setTratamentoLegados(null);
      setSimulacaoLegados(null);
      setHistoricosLegados(null);
      setDecisoesLegados({});
      setResultadoDecisoes(null);
      setResultadoImportacao(null);
      setResultadoContatos(null);
      setPrevisualizacaoContatos(null);
    }
  }, [open, user.nome]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!nome.trim()) throw new Error("Informe o seu nome.");
      if (novaSenha && novaSenha !== confirmacao) {
        throw new Error("A confirmação da nova senha não coincide.");
      }
      if (novaSenha && !senhaAtual) {
        throw new Error("Informe a senha atual para definir uma nova senha.");
      }
      return atualizarMeuPerfil({ nome, senhaAtual, novaSenha });
    },
    onSuccess: (usuario) => {
      updateSessionUser(usuario);
      toast.success("Configurações atualizadas.");
      onOpenChange(false);
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível atualizar o perfil."),
  });

  const auditoriaMutation = useMutation({
    mutationFn: () => auditarDadosLegados(arquivosLegados),
    onSuccess: (resultado) => {
      setAuditoriaLegados(resultado);
      toast.success("Prévia dos dados legados gerada.");
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível analisar os arquivos."),
  });

  const tratamentoMutation = useMutation({
    mutationFn: () => tratarCatalogoDadosLegados(arquivosLegados),
    onSuccess: (resultado) => {
      setTratamentoLegados(resultado);
      toast.success("Tratamento preliminar do catálogo gerado.");
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível tratar o catálogo."),
  });

  const simulacaoMutation = useMutation({
    mutationFn: () => simularImportacaoDadosLegados(arquivosLegados),
    onSuccess: (resultado) => {
      setSimulacaoLegados(resultado);
      toast.success("Simulação da importação concluída.");
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível simular a importação."),
  });

  const historicosMutation = useMutation({
    mutationFn: () => validarHistoricosDadosLegados(arquivosLegados),
    onSuccess: (resultado) => {
      setHistoricosLegados(resultado);
      toast.success("Prévia dos históricos gerada.");
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível validar os históricos."),
  });

  const montarDecisoes = (): LegacyCatalogDecision[] =>
    tratamentoLegados?.itens.flatMap((item) => {
      const draft = decisoesLegados[chaveItem(item)];
      if (!draft?.classificacaoFinal) return [];
      return [
        {
          arquivo: item.arquivo,
          linha: item.linha,
          codigoLegado: item.codigoLegado,
          classificacaoFinal: draft.classificacaoFinal,
          observacao: draft.observacao,
        },
      ];
    }) ?? [];

  const importacaoMutation = useMutation({
    mutationFn: async () => {
      if (!tratamentoLegados) {
        throw new Error("Gere a organização dos produtos primeiro.");
      }
      const tratamentoLiberado = tratamentoLegados && tratamentoLegados.itensParaRevisao === 0;
      if (!tratamentoLiberado) {
        const resultado = await validarDecisoesCatalogoDadosLegados(
          arquivosLegados,
          montarDecisoes(),
        );
        setResultadoDecisoes(resultado);
        if (!resultado.prontoParaImportacao) {
          throw new Error("Revise os casos pendentes antes de salvar os dados.");
        }
      }
      return importarCatalogoDadosLegados(arquivosLegados, montarDecisoes());
    },
    onSuccess: (resultado) => {
      setResultadoImportacao(resultado);
      toast.success("Catálogo legado importado com idempotência.");
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível importar o catálogo."),
  });

  const contatosMutation = useMutation({
    mutationFn: () => importarContatosDadosLegados(arquivosLegados),
    onSuccess: (resultado) => {
      setResultadoContatos(resultado);
      toast.success("Contatos compatíveis importados com idempotência.");
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível importar os contatos."),
  });

  const contatosPreviewMutation = useMutation({
    mutationFn: () => verificarContatosDadosLegados(arquivosLegados),
    onSuccess: (resultado) => {
      setPrevisualizacaoContatos(resultado);
      toast.success("Conferência dos contatos concluída.");
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível verificar os contatos."),
  });

  const abrirEtapa = (etapa: EtapaImportacao, executar: () => void) => {
    if (etapaAberta === etapa) {
      setEtapaAberta(null);
      return;
    }
    setEtapaAberta(etapa);
    executar();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) =>
        !mutation.isPending &&
        !auditoriaMutation.isPending &&
        !tratamentoMutation.isPending &&
        !simulacaoMutation.isPending &&
        !historicosMutation.isPending &&
        !importacaoMutation.isPending &&
        !contatosMutation.isPending &&
        !contatosPreviewMutation.isPending &&
        onOpenChange(value)
      }
    >
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2 font-display text-2xl">
            <Settings size={20} className="text-primary" /> Configurações
          </DialogTitle>
          <DialogDescription>
            {secao === "menu"
              ? "Escolha o que deseja fazer."
              : secao === "perfil"
                ? "Atualize seus dados pessoais e sua senha."
                : "Analise, trate e importe dados legados com segurança."}
          </DialogDescription>
        </DialogHeader>

        {secao === "menu" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSecao("perfil")}
              className="group rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRound size={22} />
                </span>
                <ChevronRight
                  size={18}
                  className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </div>
              <p className="mt-4 text-base font-bold">Alterar dados pessoais</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Atualize seu nome, sua senha e as informações de acesso.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSecao("dados")}
              className="group rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Upload size={22} />
                </span>
                <ChevronRight
                  size={18}
                  className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </div>
              <p className="mt-4 text-base font-bold">Importar/exportar dados</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Analise arquivos legados, revise pendências e acompanhe a importação.
              </p>
            </button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (secao === "perfil" && !mutation.isPending) mutation.mutate();
            }}
          >
            <button
              type="button"
              onClick={() => setSecao("menu")}
              className="inline-flex items-center gap-1 text-sm font-bold text-primary"
            >
              <ArrowLeft size={16} /> Voltar para configurações
            </button>

            <div className={secao === "dados" ? "hidden" : "space-y-4"}>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Nome</span>
                <input
                  className="ds-input"
                  value={nome}
                  maxLength={120}
                  onChange={(event) => setNome(event.target.value)}
                  autoComplete="name"
                />
              </label>

              <div className="border-t border-border pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold">Alterar senha</h3>
                  <button
                    type="button"
                    onClick={() => setMostrarSenhas((atual) => !atual)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                  >
                    {mostrarSenhas ? <EyeOff size={14} /> : <Eye size={14} />}
                    {mostrarSenhas ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <div className="space-y-3">
                  <CampoSenha
                    label="Senha atual"
                    value={senhaAtual}
                    onChange={setSenhaAtual}
                    visivel={mostrarSenhas}
                    autoComplete="current-password"
                  />
                  <CampoSenha
                    label="Nova senha"
                    value={novaSenha}
                    onChange={setNovaSenha}
                    visivel={mostrarSenhas}
                    autoComplete="new-password"
                  />
                  <CampoSenha
                    label="Confirmar nova senha"
                    value={confirmacao}
                    onChange={setConfirmacao}
                    visivel={mostrarSenhas}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe os campos de senha vazios para alterar somente o nome. A nova senha deve
                    ter entre 6 e 72 caracteres, com ao menos uma letra e um número.
                  </p>
                </div>
              </div>
            </div>

            <div className={secao === "perfil" ? "hidden" : "border-t border-border pt-4"}>
              <div className="mb-3 flex items-start gap-3">
                <FileSearch size={20} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-lg font-bold">Importar dados do sistema antigo</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Siga os passos abaixo. Primeiro conferimos os arquivos; somente depois de
                    revisar o resultado será possível salvar os dados.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-bold">Como funciona</p>
                <ol className="mt-2 space-y-1 text-sm leading-relaxed text-muted-foreground">
                  <li>1. Conferir os arquivos enviados.</li>
                  <li>2. Organizar produtos e matérias-primas.</li>
                  <li>3. Ver o resultado antes de salvar.</li>
                  <li>4. Conferir compras, vendas e produção antigas.</li>
                </ol>
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-bold">Selecione os arquivos do sistema antigo</span>
                <span className="block text-sm leading-relaxed text-muted-foreground">
                  Para organizar o catálogo, inclua o `produtos.xls`. Para contatos, selecione
                  `contatos.xls` e, se possível, também `vendas.xls` e `compras.xls`.
                </span>
                <input
                  type="file"
                  multiple
                  accept=".xls"
                  aria-label="Selecionar arquivos do sistema antigo"
                  className="block min-h-12 w-full rounded-xl border-2 border-dashed border-border bg-card px-3 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-bold file:text-primary-foreground"
                  onChange={(event) => {
                    setArquivosLegados(Array.from(event.currentTarget.files ?? []));
                    setAuditoriaLegados(null);
                    setTratamentoLegados(null);
                    setSimulacaoLegados(null);
                    setHistoricosLegados(null);
                    setDecisoesLegados({});
                    setResultadoDecisoes(null);
                    setResultadoImportacao(null);
                    setResultadoContatos(null);
                    setPrevisualizacaoContatos(null);
                  }}
                />
              </label>

              <div className="mt-3 space-y-3">
                <span className="block text-sm font-bold">
                  {arquivosLegados.length === 0
                    ? "Catálogo: produtos.xls · Contatos: contatos.xls"
                    : `${arquivosLegados.length} arquivo(s) selecionado(s)`}
                </span>
                <div className="rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="flex items-start gap-3">
                    <UserRound size={22} className="mt-0.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-base font-bold">Importar clientes e fornecedores</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Esta ação é independente dos produtos. Use `contatos.xls`; `vendas.xls` e
                        `compras.xls` ajudam o sistema a identificar cada contato.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={
                        arquivosLegados.length === 0 ||
                        auditoriaMutation.isPending ||
                        tratamentoMutation.isPending ||
                        simulacaoMutation.isPending ||
                        historicosMutation.isPending ||
                        importacaoMutation.isPending ||
                        contatosMutation.isPending ||
                        contatosPreviewMutation.isPending
                      }
                      onClick={() => contatosPreviewMutation.mutate()}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FileSearch size={17} />
                      {contatosPreviewMutation.isPending
                        ? "Verificando contatos..."
                        : "Verificar contatos"}
                    </button>
                    <button
                      type="button"
                      disabled={!previsualizacaoContatos || contatosMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Confirmar o salvamento dos clientes e fornecedores verificados?",
                          )
                        ) {
                          contatosMutation.mutate();
                        }
                      }}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary px-4 text-sm font-bold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Upload size={17} />
                      {contatosMutation.isPending
                        ? "Salvando contatos..."
                        : "Salvar contatos verificados"}
                    </button>
                  </div>
                  {contatosPreviewMutation.isPending ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      A validação é automática e não altera o sistema.
                    </p>
                  ) : null}
                  {previsualizacaoContatos ? (
                    <ResumoContatosPreview resultado={previsualizacaoContatos} />
                  ) : null}
                  {resultadoContatos ? <ResumoContatos resultado={resultadoContatos} /> : null}
                </div>
                <div className="grid gap-3">
                  <button
                    type="button"
                    disabled={
                      arquivosLegados.length === 0 ||
                      auditoriaMutation.isPending ||
                      tratamentoMutation.isPending ||
                      simulacaoMutation.isPending ||
                      historicosMutation.isPending ||
                      importacaoMutation.isPending ||
                      contatosMutation.isPending
                    }
                    onClick={() =>
                      abrirEtapa(1, () => {
                        if (!auditoriaLegados && !auditoriaMutation.isPending) {
                          auditoriaMutation.mutate();
                        }
                      })
                    }
                    aria-expanded={etapaAberta === 1}
                    aria-controls="importacao-etapa-1"
                    className="flex min-h-16 w-full items-center gap-3 rounded-xl bg-primary px-4 py-3 text-left text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileSearch size={22} className="shrink-0" />
                    <span className="flex-1">
                      <span className="block text-base font-bold">
                        {auditoriaMutation.isPending
                          ? "Conferindo arquivos..."
                          : "1. Conferir arquivos"}
                      </span>
                      <span className="mt-0.5 block text-sm text-primary-foreground/80">
                        Verifica se os arquivos podem ser lidos. Nada é salvo nesta etapa.
                      </span>
                    </span>
                    <ChevronRight size={20} className="shrink-0" />
                  </button>
                  {etapaAberta === 1 ? (
                    <div
                      id="importacao-etapa-1"
                      className="rounded-xl border border-primary/20 bg-primary/5 p-3"
                    >
                      {auditoriaMutation.isPending ? (
                        <p className="text-sm text-muted-foreground">
                          Conferindo os arquivos automaticamente...
                        </p>
                      ) : auditoriaLegados ? (
                        <ResumoAuditoria resultado={auditoriaLegados} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Selecione os arquivos e clique novamente para iniciar a conferência.
                        </p>
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      arquivosLegados.length === 0 ||
                      !auditoriaLegados ||
                      auditoriaMutation.isPending ||
                      tratamentoMutation.isPending ||
                      simulacaoMutation.isPending ||
                      historicosMutation.isPending ||
                      importacaoMutation.isPending ||
                      contatosMutation.isPending
                    }
                    onClick={() =>
                      abrirEtapa(2, () => {
                        if (!tratamentoLegados && !tratamentoMutation.isPending) {
                          tratamentoMutation.mutate();
                        }
                      })
                    }
                    aria-expanded={etapaAberta === 2}
                    aria-controls="importacao-etapa-2"
                    className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-primary bg-card px-4 py-3 text-left text-foreground transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 size={22} className="shrink-0 text-primary" />
                    <span className="flex-1">
                      <span className="block text-base font-bold">
                        {tratamentoMutation.isPending
                          ? "Organizando catálogo..."
                          : "2. Organizar produtos e matérias-primas"}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        Separa os itens e mostra o que precisa de uma decisão.
                      </span>
                    </span>
                    <ChevronRight size={20} className="shrink-0 text-muted-foreground" />
                  </button>
                  {etapaAberta === 2 ? (
                    <div id="importacao-etapa-2">
                      {tratamentoMutation.isPending ? (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                          <p className="text-sm text-muted-foreground">
                            Organizando os produtos automaticamente...
                          </p>
                        </div>
                      ) : tratamentoLegados ? (
                        <>
                          <ResumoTratamento
                            resultado={tratamentoLegados}
                            decisoes={decisoesLegados}
                            onDecisionChange={(item, draft) => {
                              setDecisoesLegados((atual) => ({
                                ...atual,
                                [chaveItem(item)]: draft,
                              }));
                              setResultadoDecisoes(null);
                            }}
                          />
                          {resultadoDecisoes ? (
                            <ResumoDecisoes resultado={resultadoDecisoes} />
                          ) : null}
                          {tratamentoLegados && tratamentoLegados ? (
                            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                              <p className="text-base font-bold">
                                Produtos e matérias-primas prontos para salvar
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                A validação final será automática ao salvar. Revise os itens acima e
                                confirme apenas quando estiver tudo correto.
                              </p>
                              <button
                                type="button"
                                disabled={importacaoMutation.isPending}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Confirmar o salvamento dos produtos e matérias-primas?",
                                    )
                                  ) {
                                    importacaoMutation.mutate();
                                  }
                                }}
                                className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Upload size={17} />
                                {importacaoMutation.isPending
                                  ? "Salvando produtos..."
                                  : "Salvar produtos e matérias-primas aprovados"}
                              </button>
                            </div>
                          ) : null}
                          {resultadoImportacao ? (
                            <ResumoImportacao resultado={resultadoImportacao} />
                          ) : null}
                        </>
                      ) : (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                          <p className="text-sm text-muted-foreground">
                            Primeiro clique em “Conferir arquivos”. Depois, esta etapa será
                            executada automaticamente.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      arquivosLegados.length === 0 ||
                      !tratamentoLegados ||
                      auditoriaMutation.isPending ||
                      tratamentoMutation.isPending ||
                      simulacaoMutation.isPending ||
                      historicosMutation.isPending ||
                      importacaoMutation.isPending ||
                      contatosMutation.isPending
                    }
                    onClick={() =>
                      abrirEtapa(3, () => {
                        if (!simulacaoLegados && !simulacaoMutation.isPending) {
                          simulacaoMutation.mutate();
                        }
                      })
                    }
                    aria-expanded={etapaAberta === 3}
                    aria-controls="importacao-etapa-3"
                    className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-foreground transition hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <AlertTriangle size={22} className="shrink-0 text-primary" />
                    <span className="flex-1">
                      <span className="block text-base font-bold">
                        {simulacaoMutation.isPending
                          ? "Preparando simulação..."
                          : "3. Ver o resultado antes de salvar"}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        Mostra o que será importado e os problemas encontrados.
                      </span>
                    </span>
                    <ChevronRight size={20} className="shrink-0 text-muted-foreground" />
                  </button>
                  {etapaAberta === 3 ? (
                    <div
                      id="importacao-etapa-3"
                      className="rounded-xl border border-primary/20 bg-primary/5 p-3"
                    >
                      {simulacaoMutation.isPending ? (
                        <p className="text-sm text-muted-foreground">
                          Preparando a simulação automaticamente...
                        </p>
                      ) : simulacaoLegados ? (
                        <ResumoSimulacao resultado={simulacaoLegados} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Primeiro organize os produtos. Depois, esta simulação mostrará o resultado
                          antes de salvar.
                        </p>
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      arquivosLegados.length === 0 ||
                      !auditoriaLegados ||
                      auditoriaMutation.isPending ||
                      tratamentoMutation.isPending ||
                      simulacaoMutation.isPending ||
                      historicosMutation.isPending ||
                      importacaoMutation.isPending ||
                      contatosMutation.isPending
                    }
                    onClick={() =>
                      abrirEtapa(4, () => {
                        if (!historicosLegados && !historicosMutation.isPending) {
                          historicosMutation.mutate();
                        }
                      })
                    }
                    aria-expanded={etapaAberta === 4}
                    aria-controls="importacao-etapa-4"
                    className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-foreground transition hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileSearch size={22} className="shrink-0 text-primary" />
                    <span className="flex-1">
                      <span className="block text-base font-bold">
                        {historicosMutation.isPending
                          ? "Conferindo históricos..."
                          : "4. Conferir compras, vendas e produção"}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        Aponta pendências dos registros antigos. Nada é salvo aqui.
                      </span>
                    </span>
                    <ChevronRight size={20} className="shrink-0 text-muted-foreground" />
                  </button>
                  {etapaAberta === 4 ? (
                    <div
                      id="importacao-etapa-4"
                      className="rounded-xl border border-primary/20 bg-primary/5 p-3"
                    >
                      {historicosMutation.isPending ? (
                        <p className="text-sm text-muted-foreground">
                          Conferindo os históricos automaticamente...
                        </p>
                      ) : historicosLegados ? (
                        <ResumoHistoricos resultado={historicosLegados} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Esta conferência verifica compras, vendas e produção antigas sem salvar
                          nada.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <DialogFooter className={secao === "dados" ? "hidden" : undefined}>
              <button
                type="button"
                disabled={
                  mutation.isPending ||
                  auditoriaMutation.isPending ||
                  tratamentoMutation.isPending ||
                  simulacaoMutation.isPending ||
                  historicosMutation.isPending ||
                  importacaoMutation.isPending ||
                  contatosMutation.isPending
                }
                onClick={() => onOpenChange(false)}
                className="ds-button-secondary min-h-11 px-4"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  mutation.isPending ||
                  auditoriaMutation.isPending ||
                  tratamentoMutation.isPending ||
                  simulacaoMutation.isPending ||
                  historicosMutation.isPending ||
                  importacaoMutation.isPending ||
                  contatosMutation.isPending
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                <Save size={15} />
                {mutation.isPending ? "Salvando..." : "Salvar alterações"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResumoAuditoria({ resultado }: { resultado: LegacyAuditResponse }) {
  const revisoes = resultado.classificacoes.REVISAR ?? 0;
  const classes = Object.entries(resultado.classificacoes)
    .map(([nome, quantidade]) => `${nome}: ${quantidade}`)
    .join(" · ");

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-bold">Prévia concluída — nenhum dado foi salvo</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {resultado.arquivosAnalisados} arquivo(s), {resultado.registrosAnalisados} registro(s) e
            classificação principal em <code>{resultado.arquivoPrincipal}</code>.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <ResumoNumero label="Para revisar" value={revisoes} />
        <ResumoNumero label="Linhas com alertas" value={resultado.registrosComAlertas} />
        <ResumoNumero label="Quantidades exorbitantes" value={resultado.quantidadesExorbitantes} />
      </div>

      <p className="text-xs text-muted-foreground">
        {classes || "Nenhuma classificação encontrada."}
      </p>

      {resultado.alertasQuantidade.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold">Alertas de quantidade</p>
          <div className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {resultado.alertasQuantidade.slice(0, 12).map((alerta) => (
              <p key={`${alerta.arquivo}-${alerta.linha}-${alerta.coluna}`}>
                <strong className="text-foreground">
                  {alerta.arquivo}, linha {alerta.linha}
                </strong>{" "}
                · {alerta.coluna} {alerta.valor ?? " inválido"}: {alerta.mensagem}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {resultado.itensParaRevisao.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold">Itens que precisam de decisão</p>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {resultado.itensParaRevisao.slice(0, 20).map((item) => (
              <div
                key={`${item.arquivo}-${item.linha}`}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{item.nome || `Código ${item.codigoLegado || "sem código"}`}</strong>
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-bold">
                    {item.classificacaoSugerida}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Código legado: {item.codigoLegado || "não informado"} · linha {item.linha}
                </p>
                {item.alertas.length > 0 ? (
                  <p className="mt-1 text-destructive">{item.alertas.join(" ")}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResumoNumero({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-primary">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function ResumoTratamento({
  resultado,
  decisoes,
  onDecisionChange,
}: {
  resultado: LegacyCatalogTreatmentResponse;
  decisoes: Record<string, DecisionDraft>;
  onDecisionChange: (
    item: LegacyCatalogTreatmentResponse["itens"][number],
    draft: DecisionDraft,
  ) => void;
}) {
  const classes = Object.entries(resultado.classificacoes)
    .map(([nome, quantidade]) => `${nome}: ${quantidade}`)
    .join(" · ");
  const revisoes = resultado.itens.filter((item) => item.status === "PENDENTE_REVISAO");

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-bold">Tratamento preliminar concluído</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A validação foi feita automaticamente. Revise somente os casos pendentes; o sistema
            manterá o arquivo e a linha de origem.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <ResumoNumero label="Itens prontos" value={resultado.itensProntos} />
        <ResumoNumero label="Pendentes de revisão" value={resultado.itensParaRevisao} />
        <ResumoNumero label="Itens do catálogo" value={resultado.itens.length} />
      </div>

      <p className="text-xs text-muted-foreground">{classes}</p>

      {revisoes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold">Pendências do tratamento</p>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {revisoes.map((item) => {
              const draft = decisoes[chaveItem(item)] ?? {
                classificacaoFinal: "",
                observacao: "",
              };
              return (
                <div
                  key={`${item.arquivo}-${item.linha}`}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{item.nome || `Código ${item.codigoLegado || "sem código"}`}</strong>
                    <span className="rounded-full bg-secondary px-2 py-0.5 font-bold">
                      {item.classificacaoSugerida}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {item.arquivo}, linha {item.linha} · código legado:{" "}
                    {item.codigoLegado || "não informado"}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="font-semibold text-muted-foreground">Decisão final</span>
                      <select
                        className="ds-input"
                        value={draft.classificacaoFinal}
                        onChange={(event) =>
                          onDecisionChange(item, {
                            ...draft,
                            classificacaoFinal: event.target.value,
                          })
                        }
                      >
                        <option value="">Selecione uma decisão</option>
                        <option value="PRODUTO_FINAL">Produto final</option>
                        <option value="MATERIA_PRIMA">Matéria-prima</option>
                        <option value="GASTO_OPERACIONAL">Gasto operacional</option>
                        <option value="NAO_IMPORTAR">Não importar</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="font-semibold text-muted-foreground">Observação</span>
                      <input
                        className="ds-input"
                        value={draft.observacao}
                        maxLength={500}
                        onChange={(event) =>
                          onDecisionChange(item, {
                            ...draft,
                            observacao: event.target.value,
                          })
                        }
                        placeholder="Obrigatória para não importar"
                      />
                    </label>
                  </div>
                  {item.alertas.length > 0 ? (
                    <p className="mt-1 text-destructive">{item.alertas.join(" ")}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function chaveItem(item: { arquivo: string; linha: number; codigoLegado: string }) {
  return `${item.arquivo}:${item.linha}:${item.codigoLegado}`;
}

function ResumoDecisoes({ resultado }: { resultado: LegacyCatalogDecisionResponse }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
      <p className="text-sm font-bold">
        {resultado.prontoParaImportacao
          ? "Decisões manuais aprovadas para a próxima etapa"
          : "Decisões manuais ainda possuem bloqueios"}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <ResumoNumero label="Aprovados" value={resultado.itensAprovados} />
        <ResumoNumero label="Não importar" value={resultado.itensNaoImportados} />
        <ResumoNumero label="Pendentes" value={resultado.itensPendentes} />
      </div>
      {resultado.bloqueios.length > 0 ? (
        <div className="space-y-1 text-xs text-destructive">
          {resultado.bloqueios.map((bloqueio) => (
            <p key={bloqueio}>• {bloqueio}</p>
          ))}
        </div>
      ) : null}
      {resultado.rejeicoes.length > 0 ? (
        <div className="max-h-48 space-y-1 overflow-y-auto text-xs text-destructive">
          {resultado.rejeicoes.slice(0, 20).map((rejeicao) => (
            <p key={`${rejeicao.arquivo}-${rejeicao.linha}-${rejeicao.tipo}`}>
              {rejeicao.arquivo}, linha {rejeicao.linha}: {rejeicao.tipo} — {rejeicao.mensagem}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResumoSimulacao({ resultado }: { resultado: LegacyImportSimulationResponse }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-bold">
            {resultado.prontoParaImportacao
              ? "Simulação sem bloqueios no catálogo"
              : "Importação bloqueada pela simulação"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta etapa apenas valida o tratamento e não grava dados no sistema.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <ResumoNumero label="Itens prontos" value={resultado.itensProntos} />
        <ResumoNumero label="Itens pendentes" value={resultado.itensPendentes} />
        <ResumoNumero label="Rejeições" value={resultado.rejeicoes.length} />
      </div>

      {resultado.bloqueios.length > 0 ? (
        <div className="space-y-1 text-xs text-destructive">
          {resultado.bloqueios.map((bloqueio) => (
            <p key={bloqueio}>• {bloqueio}</p>
          ))}
        </div>
      ) : null}

      {resultado.rejeicoes.length > 0 ? (
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {resultado.rejeicoes.slice(0, 20).map((rejeicao) => (
            <div
              key={`${rejeicao.arquivo}-${rejeicao.linha}-${rejeicao.tipo}`}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
            >
              <strong>{rejeicao.nome || `Código ${rejeicao.codigoLegado || "sem código"}`}</strong>
              <p className="mt-1 text-muted-foreground">
                {rejeicao.arquivo}, linha {rejeicao.linha} · {rejeicao.tipo}
              </p>
              <p className="mt-1 text-destructive">{rejeicao.mensagem}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResumoHistoricos({ resultado }: { resultado: LegacyHistoricalTreatmentResponse }) {
  const dominios = Object.entries(resultado.registrosPorDominio)
    .map(([nome, quantidade]) => `${nome}: ${quantidade}`)
    .join(" · ");

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-start gap-2">
        <FileSearch size={17} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-bold">Prévia histórica concluída — nenhum dado foi salvo</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {resultado.arquivosAnalisados} arquivo(s), {resultado.registrosAnalisados} registro(s)
            analisado(s) a partir de <code>{resultado.arquivoPrincipal}</code>.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <ResumoNumero label="Linhas prontas" value={resultado.registrosProntos} />
        <ResumoNumero label="Linhas bloqueadas" value={resultado.registrosBloqueados} />
        <ResumoNumero label="Pendências" value={resultado.pendencias.length} />
      </div>
      <p className="text-xs text-muted-foreground">
        {dominios || "Nenhum domínio histórico encontrado."}
      </p>
      {resultado.pendencias.length > 0 ? (
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {resultado.pendencias.slice(0, 20).map((pendencia) => (
            <div
              key={`${pendencia.arquivo}-${pendencia.linha}-${pendencia.tipo}`}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
            >
              <strong>
                {pendencia.arquivo}, linha {pendencia.linha} · {pendencia.dominio}
              </strong>
              <p className="mt-1 text-destructive">
                {pendencia.tipo}: {pendencia.mensagem}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        O financeiro permanece bloqueado até confirmar a natureza de cada lançamento. Compras,
        vendas e produções serão importadas sem replay dos serviços de estoque.
      </p>
    </div>
  );
}

function ResumoImportacao({ resultado }: { resultado: LegacyCatalogImportResponse }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <p className="text-sm font-bold">Importação do catálogo concluída</p>
      <p className="text-xs text-muted-foreground">
        Execução #{resultado.importacaoId} · status {resultado.status} · origem{" "}
        {resultado.arquivoPrincipal}
      </p>
      <div className="grid gap-2 sm:grid-cols-4">
        <ResumoNumero label="Produtos" value={resultado.produtosImportados} />
        <ResumoNumero label="Matérias-primas" value={resultado.materiasPrimasImportadas} />
        <ResumoNumero label="Já processados" value={resultado.jaProcessados} />
        <ResumoNumero label="Aguardando histórico" value={resultado.aguardandoHistorico} />
      </div>
      <p className="text-xs text-muted-foreground">
        Os lançamentos históricos e os gastos operacionais foram preservados para a próxima etapa;
        nenhum registro financeiro foi inventado a partir do catálogo.
      </p>
    </div>
  );
}

function ResumoContatosPreview({ resultado }: { resultado: LegacyContactPreviewResponse }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        <FileSearch size={17} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-bold">Conferência concluída — nada foi salvo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Revise os números abaixo. O botão de salvar só fica disponível depois desta conferência.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <ResumoNumero label="Clientes identificados" value={resultado.clientesIdentificados} />
        <ResumoNumero
          label="Fornecedores identificados"
          value={resultado.fornecedoresIdentificados}
        />
        <ResumoNumero label="Pendentes para revisar" value={resultado.pendentes} />
      </div>
      {resultado.pendencias.length > 0 ? (
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {resultado.pendencias.slice(0, 20).map((pendencia) => (
            <div
              key={pendencia.linha + "-" + pendencia.tipo}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <strong>
                {pendencia.arquivo}, linha {pendencia.linha} · código{" "}
                {pendencia.codigoLegado || "não informado"}
              </strong>
              <p className="mt-1 text-destructive">
                {pendencia.tipo}: {pendencia.mensagem}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-emerald-700">
          Todos os contatos foram identificados.
        </p>
      )}
    </div>
  );
}

function ResumoContatos({ resultado }: { resultado: LegacyContactImportResponse }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
      <p className="text-sm font-bold">Importação de contatos concluída</p>
      <p className="text-xs text-muted-foreground">
        Execução #{resultado.importacaoId} · {resultado.arquivoPrincipal} · status{" "}
        {resultado.status}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <ResumoNumero label="Clientes" value={resultado.clientesImportados} />
        <ResumoNumero label="Fornecedores" value={resultado.fornecedoresImportados} />
        <ResumoNumero label="Pendentes" value={resultado.pendentes} />
      </div>
      {resultado.rejeicoes.length > 0 ? (
        <div className="max-h-48 space-y-1 overflow-y-auto text-xs text-destructive">
          {resultado.rejeicoes.slice(0, 20).map((rejeicao) => (
            <p key={`${rejeicao.arquivo}-${rejeicao.linha}-${rejeicao.tipo}`}>
              {rejeicao.arquivo}, linha {rejeicao.linha}: {rejeicao.tipo} — {rejeicao.mensagem}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CampoSenha({
  label,
  value,
  onChange,
  visivel,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visivel: boolean;
  autoComplete: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type={visivel ? "text" : "password"}
        className="ds-input"
        value={value}
        maxLength={72}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
      />
    </label>
  );
}

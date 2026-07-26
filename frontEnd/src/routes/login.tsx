import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Cookie, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import {
  login,
  obterBootstrapStatus,
  primeiroAcesso,
  redefinirSenha,
  solicitarRecuperacaoSenha,
  verificarCodigoRecuperacao,
} from "@/lib/auth.functions";
import { getUserSession, saveUserSession } from "@/lib/user-session";
import voCidaImg from "@/assets/vo-cida.png";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [emailPrimeiroAcesso, setEmailPrimeiroAcesso] = useState<string | null>(null);
  const [senhaTemporaria, setSenhaTemporaria] = useState("");
  const [bootstrapDisponivel, setBootstrapDisponivel] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recuperacaoAtiva, setRecuperacaoAtiva] = useState(false);

  useEffect(() => {
    if (getUserSession()) navigate({ to: "/" });
    obterBootstrapStatus()
      .then((status) => setBootstrapDisponivel(status.available))
      .catch(() => undefined);
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const result = await login({ data: { email, senha } });
      if (result.requiresPasswordChange === true) {
        setEmailPrimeiroAcesso(result.email);
        setSenhaTemporaria(senha);
        return;
      }
      saveUserSession(result);
      navigate({ to: "/" });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function concluirPrimeiroAcesso(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha !== confirmacao) return setErro("As senhas não coincidem.");
    setLoading(true);
    try {
      const session = await primeiroAcesso({
        data: { email: emailPrimeiroAcesso, senhaAtual: senhaTemporaria, novaSenha },
      });
      saveUserSession(session);
      navigate({ to: "/" });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function usarContaInicial() {
    setEmail("adm@gmail.com");
    setSenha("123");
    setErro(null);
    setLoading(true);
    try {
      const result = await login({ data: { email: "adm@gmail.com", senha: "123" } });
      if (result.requiresPasswordChange === true) {
        setEmailPrimeiroAcesso(result.email);
        setSenhaTemporaria("123");
      } else {
        saveUserSession(result);
        navigate({ to: "/" });
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível usar a conta inicial.");
    } finally {
      setLoading(false);
    }
  }

  const primeiroAcessoAtivo = emailPrimeiroAcesso !== null;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-card overflow-hidden flex items-center justify-center mb-3 shadow-warm-sm">
            <img src={voCidaImg} alt="Vó Cida" className="w-full h-full object-contain" />
          </div>
          <div className="font-display text-2xl font-bold text-primary">Doces da Vó Cida</div>
          <div className="text-xs text-muted-foreground">Caderninho Digital</div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-warm-md overflow-hidden p-6">
          {recuperacaoAtiva ? (
            <RecuperacaoSenha
              emailInicial={email}
              onVoltar={() => {
                setRecuperacaoAtiva(false);
                setErro(null);
              }}
            />
          ) : (
            <>
              <h1 className="font-display text-xl font-bold text-foreground">
                {primeiroAcessoAtivo ? "Defina sua nova senha" : "Entrar no sistema"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {primeiroAcessoAtivo
                  ? "A senha temporária precisa ser substituída antes de continuar."
                  : "Use as credenciais fornecidas pelo administrador."}
              </p>

              <form
                onSubmit={primeiroAcessoAtivo ? concluirPrimeiroAcesso : entrar}
                className="mt-6 space-y-4"
              >
                {!primeiroAcessoAtivo ? (
                  <>
                    <Campo label="E-mail">
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="ds-input"
                      />
                    </Campo>
                    <Campo label="Senha">
                      <SenhaInput
                        value={senha}
                        onChange={setSenha}
                        mostrar={mostrarSenha}
                        setMostrar={setMostrarSenha}
                        autoComplete="current-password"
                      />
                    </Campo>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-foreground">
                      {emailPrimeiroAcesso}
                    </div>
                    <Campo label="Nova senha">
                      <SenhaInput
                        value={novaSenha}
                        onChange={setNovaSenha}
                        mostrar={mostrarSenha}
                        setMostrar={setMostrarSenha}
                        autoComplete="new-password"
                      />
                    </Campo>
                    <Campo label="Confirmar nova senha">
                      <input
                        type={mostrarSenha ? "text" : "password"}
                        required
                        minLength={6}
                        maxLength={72}
                        value={confirmacao}
                        onChange={(e) => setConfirmacao(e.target.value)}
                        autoComplete="new-password"
                        className="ds-input"
                      />
                    </Campo>
                    <p className="text-xs text-muted-foreground">
                      Use de 6 a 72 caracteres, incluindo pelo menos uma letra e um número.
                    </p>
                  </>
                )}

                {erro && (
                  <div className="bg-error-bg border-l-4 border-error text-error rounded-md px-4 py-3 text-sm font-medium">
                    {erro}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 rounded-md font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary-dark shadow-warm-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {primeiroAcessoAtivo ? <KeyRound size={16} /> : <Cookie size={16} />}
                  {loading
                    ? "Aguarde..."
                    : primeiroAcessoAtivo
                      ? "Salvar senha e entrar"
                      : "Entrar"}
                </button>
              </form>

              {!primeiroAcessoAtivo && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setErro(null);
                    setRecuperacaoAtiva(true);
                  }}
                  className="mt-3 w-full text-center text-sm font-semibold text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              )}

              {bootstrapDisponivel && !primeiroAcessoAtivo && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={usarContaInicial}
                  className="w-full mt-3 px-6 py-2.5 rounded-md font-semibold text-xs border border-dashed border-primary text-primary hover:bg-primary/5"
                >
                  Entrar com a primeira conta do sistema
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type EtapaRecuperacao = "email" | "codigo" | "senha" | "sucesso";

function RecuperacaoSenha({
  emailInicial,
  onVoltar,
}: {
  emailInicial: string;
  onVoltar: () => void;
}) {
  const [etapa, setEtapa] = useState<EtapaRecuperacao>("email");
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState("");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((valor) => Math.max(0, valor - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (etapa !== "sucesso") return;
    const timer = window.setTimeout(onVoltar, 2500);
    return () => window.clearTimeout(timer);
  }, [etapa, onVoltar]);

  async function solicitar(event?: React.FormEvent) {
    event?.preventDefault();
    setErro(null);
    setMensagem(null);
    setLoading(true);
    try {
      const resposta = await solicitarRecuperacaoSenha(email);
      setMensagem(resposta.message);
      setCooldown(60);
      setEtapa("codigo");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível solicitar a recuperação.");
    } finally {
      setLoading(false);
    }
  }

  async function verificar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const resposta = await verificarCodigoRecuperacao(email, codigo);
      setRecoveryToken(resposta.recoveryToken);
      setEtapa("senha");
      setMensagem(null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível validar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function redefinir(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    if (novaSenha !== confirmacao) {
      setErro("A confirmação da senha não coincide.");
      return;
    }
    if (!recoveryToken) {
      setErro("A autorização expirou. Solicite um novo código.");
      return;
    }
    setLoading(true);
    try {
      await redefinirSenha(recoveryToken, novaSenha, confirmacao);
      setRecoveryToken(null);
      setCodigo("");
      setNovaSenha("");
      setConfirmacao("");
      setEtapa("sucesso");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  if (etapa === "sucesso") {
    return (
      <div className="py-4 text-center" role="status">
        <CheckCircle2 className="mx-auto mb-3 text-success" size={42} />
        <h1 className="font-display text-xl font-bold">Senha redefinida</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua senha foi alterada. Você será direcionado para o login.
        </p>
        <button type="button" onClick={onVoltar} className="ds-button-secondary mt-5 px-5 py-2.5">
          Voltar agora
        </button>
      </div>
    );
  }

  const titulos = {
    email: ["Recuperar senha", "Informe o e-mail cadastrado para receber um código."],
    codigo: ["Informe o código", "Digite o código de 6 dígitos enviado para o e-mail informado."],
    senha: ["Defina a nova senha", "Crie uma senha segura para voltar a acessar o sistema."],
  } as const;

  return (
    <>
      <button
        type="button"
        onClick={
          etapa === "email"
            ? onVoltar
            : () => {
                setEtapa("email");
                setRecoveryToken(null);
                setErro(null);
                setMensagem(null);
              }
        }
        disabled={loading}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
      >
        <ArrowLeft size={16} /> Voltar
      </button>
      <h1 className="font-display text-xl font-bold text-foreground">{titulos[etapa][0]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{titulos[etapa][1]}</p>

      {etapa === "email" && (
        <form onSubmit={solicitar} className="mt-6 space-y-4">
          <Campo label="E-mail">
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={160}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="ds-input"
              autoFocus
            />
          </Campo>
          <BotaoRecuperacao loading={loading} texto="Enviar código" />
        </form>
      )}

      {etapa === "codigo" && (
        <form onSubmit={verificar} className="mt-6 space-y-4">
          <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-foreground">{email}</div>
          <Campo label="Código de recuperação">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="\d{6}"
              maxLength={6}
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="ds-input text-center text-lg tracking-[0.35em]"
              autoFocus
            />
          </Campo>
          <BotaoRecuperacao loading={loading} texto="Validar código" />
          <button
            type="button"
            disabled={loading || cooldown > 0}
            onClick={() => solicitar()}
            className="w-full text-sm font-semibold text-primary disabled:text-muted-foreground"
          >
            {cooldown > 0 ? `Reenviar código em ${cooldown}s` : "Reenviar código"}
          </button>
        </form>
      )}

      {etapa === "senha" && (
        <form onSubmit={redefinir} className="mt-6 space-y-4">
          <Campo label="Nova senha">
            <SenhaInput
              value={novaSenha}
              onChange={setNovaSenha}
              mostrar={mostrarSenha}
              setMostrar={setMostrarSenha}
              autoComplete="new-password"
            />
          </Campo>
          <Campo label="Confirmar nova senha">
            <input
              type={mostrarSenha ? "text" : "password"}
              required
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              className="ds-input"
            />
          </Campo>
          <p className="text-xs text-muted-foreground">
            Use de 6 a 72 caracteres, incluindo pelo menos uma letra e um número.
          </p>
          <BotaoRecuperacao loading={loading} texto="Redefinir senha" />
        </form>
      )}

      {mensagem && (
        <div
          className="mt-4 rounded-md border-l-4 border-primary bg-secondary px-4 py-3 text-sm"
          role="status"
        >
          {mensagem}
        </div>
      )}
      {erro && (
        <div
          className="mt-4 rounded-md border-l-4 border-error bg-error-bg px-4 py-3 text-sm font-medium text-error"
          role="alert"
        >
          {erro}
        </div>
      )}
    </>
  );
}

function BotaoRecuperacao({ loading, texto }: { loading: boolean; texto: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-warm-sm disabled:opacity-60"
    >
      <Mail size={16} />
      {loading ? "Aguarde..." : texto}
    </button>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function SenhaInput({
  value,
  onChange,
  mostrar,
  setMostrar,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  mostrar: boolean;
  setMostrar: (value: boolean) => void;
  autoComplete: string;
}) {
  return (
    <div className="relative">
      <input
        type={mostrar ? "text" : "password"}
        required
        maxLength={72}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="ds-input pr-10"
      />
      <button
        type="button"
        onClick={() => setMostrar(!mostrar)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
      >
        {mostrar ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cookie, Eye, EyeOff, KeyRound } from "lucide-react";
import { login, obterBootstrapStatus, primeiroAcesso } from "@/lib/auth.functions";
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
      if ("requiresPasswordChange" in result) {
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
      if ("requiresPasswordChange" in result) {
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
              {loading ? "Aguarde..." : primeiroAcessoAtivo ? "Salvar senha e entrar" : "Entrar"}
            </button>
          </form>

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
        </div>
      </div>
    </div>
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

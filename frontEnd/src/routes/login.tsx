import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cookie, Sparkles, Eye, EyeOff } from "lucide-react";
import { useApiFn } from "@/lib/api-function";
import { login, cadastro } from "@/lib/auth.functions";
import { notifyAuthChange } from "@/hooks/use-auth";
import voCidaImg from "@/assets/vo-cida.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const permitirPularLogin =
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_LOGIN === "true";
  const navigate = useNavigate();
  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cargoFuncao, setCargoFuncao] = useState("");
  const [perfil, setPerfil] = useState<"GESTOR" | "FUNCIONARIO">("GESTOR");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fnLogin = useApiFn(login);
  const fnCadastro = useApiFn(cadastro);

  useEffect(() => {
    const stored = localStorage.getItem("vovo_user");
    if (stored) {
      navigate({ to: "/" });
    }
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setLoading(true);
    try {
      if (modo === "login") {
        const res = await fnLogin({ data: { email, senha } });
        localStorage.setItem("vovo_user", JSON.stringify(res));
        notifyAuthChange();
        navigate({ to: "/" });
      } else {
        await fnCadastro({
          data: {
            nome,
            email,
            senha,
            cargoFuncao,
            perfil,
          },
        });
        if (perfil === "FUNCIONARIO") {
          setSucesso("Conta de funcionário criada com sucesso.");
          setModo("login");
          return;
        }
        const loginRes = await fnLogin({ data: { email, senha } });
        localStorage.setItem("vovo_user", JSON.stringify(loginRes));
        notifyAuthChange();
        navigate({ to: "/" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      setErro(traduzir(msg));
    } finally {
      setLoading(false);
    }
  }

  function pularLogin() {
    const devUser = {
      usuarioId: 1,
      nome: "Vó Cida (Desenvolvimento)",
      email: "vocida.dev@email.com",
      cargoFuncao: "Gestora",
      perfil: "GESTOR" as const,
    };
    localStorage.setItem("vovo_user", JSON.stringify(devUser));
    notifyAuthChange();
    navigate({ to: "/" });
  }

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

        <div className="bg-card border border-border rounded-2xl shadow-warm-md overflow-hidden">
          <div className="grid grid-cols-2 bg-secondary">
            {(["login", "cadastro"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setModo(m);
                  setErro(null);
                  setSucesso(null);
                }}
                className={[
                  "py-3 text-sm font-bold uppercase tracking-wider transition-colors",
                  modo === m
                    ? "bg-card text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="p-6 space-y-4">
            {modo === "cadastro" && (
              <>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={120}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Maria Silva"
                    className="ds-input"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">
                    Cargo ou função
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={cargoFuncao}
                    onChange={(e) => setCargoFuncao(e.target.value)}
                    placeholder="Ex.: Gestora, confeiteira"
                    className="ds-input"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">
                    Perfil de acesso
                  </label>
                  <select
                    required
                    value={perfil}
                    onChange={(e) => setPerfil(e.target.value as "GESTOR" | "FUNCIONARIO")}
                    className="ds-input"
                  >
                    <option value="GESTOR">Gestor</option>
                    <option value="FUNCIONARIO">Funcionário</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">E-mail</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vocida@email.com"
                className="ds-input"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete={modo === "login" ? "current-password" : "new-password"}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{3}"
                  minLength={3}
                  maxLength={3}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="ds-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {erro && (
              <div className="bg-error-bg border-l-4 border-error text-error rounded-md px-4 py-3 text-sm font-medium">
                {erro}
              </div>
            )}

            {sucesso && (
              <div className="bg-success-bg border-l-4 border-success text-success rounded-md px-4 py-3 text-sm font-medium">
                {sucesso}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-md font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary-dark shadow-warm-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <>Aguarde...</>
              ) : modo === "login" ? (
                <>
                  <Cookie size={16} /> Entrar
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Criar minha conta
                </>
              )}
            </button>

            {permitirPularLogin && (
              <>
                <button
                  type="button"
                  onClick={pularLogin}
                  className="w-full mt-2 px-6 py-2.5 rounded-md font-semibold text-xs border border-dashed border-primary text-primary hover:bg-primary/5 inline-flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} /> Pular login
                </button>

                <p className="-mt-2 text-center text-[11px] text-muted-foreground">
                  Acesso temporário para testes, sem informar e-mail e senha.
                </p>
              </>
            )}

            <p className="text-xs text-center text-muted-foreground">
              {modo === "login"
                ? "Primeira vez? Clique em Criar conta acima."
                : "Já tem conta? Clique em Entrar acima."}
            </p>
          </form>
        </div>
      </div>

      <style>{`
        .ds-input {
          width: 100%;
          font-family: var(--font-sans);
          font-size: 1rem;
          color: var(--color-foreground);
          background: var(--color-card);
          border: 1.5px solid var(--color-border);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          min-height: 48px;
          outline: none;
          transition: all 150ms ease;
        }
        .ds-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px oklch(0.48 0.19 27 / 0.12);
        }
      `}</style>
    </div>
  );
}

function traduzir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/user already registered/i.test(msg)) return "Esse e-mail já tem conta. Tente entrar.";
  return msg;
}

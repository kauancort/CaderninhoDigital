import {
  cloneElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useQuery } from "@tanstack/react-query";

import {
  Check,
  FileText,
  MapPin,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";

import {
  buscarTransportadoraCliente,
  clienteSchema,
  pesquisarClientes,
} from "@/lib/clientes.functions";

import {
  mascararDocumento,
  somenteDigitos,
  validarCnpj,
  validarCpf,
  type TipoDocumento,
} from "@/lib/documento-fiscal";

import {
  apenasDigitosCep,
  consultarCep,
  mascararCep,
} from "@/lib/viacep";

import {
  clienteFormVazio,
  UFS_BRASIL,
  type ClienteFormData,
} from "@/lib/cliente-form";

function mascararTelefone(valor: string) {
  const d = somenteDigitos(valor).slice(0, 11);

  if (d.length <= 2) {
    return d ? `(${d}` : "";
  }

  if (d.length <= 7) {
    return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  }

  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type Props = {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  inicial?: ClienteFormData;
  clienteId?: string | number | null;
  salvando: boolean;
  erroGeral?: string | null;
  onClose: () => void;
  onSubmit: (
    data: ClienteFormData,
  ) => void | Promise<void>;
};

type TransportadoraBusca = {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  observacao?: string;
};

export function ClienteFormModal({
  aberto,
  titulo,
  descricao,
  inicial = clienteFormVazio,
  clienteId,
  salvando,
  erroGeral,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] =
    useState<ClienteFormData>(inicial);

  const [tipo, setTipo] = useState<TipoDocumento>(
    somenteDigitos(inicial.documento).length > 11
      ? "CNPJ"
      : "CPF",
  );

  const [erros, setErros] = useState<
    Record<string, string>
  >({});

  const [statusCep, setStatusCep] =
    useState<string | null>(null);

  const [
    statusTransportadora,
    setStatusTransportadora,
  ] = useState<string | null>(null);

  const [buscaTransportadora, setBuscaTransportadora] = useState("");
  const [transportadoraSelecionada, setTransportadoraSelecionada] =
    useState<TransportadoraBusca | null>(null);
  const [cadastrandoNovaTransportadora, setCadastrandoNovaTransportadora] =
    useState(false);

  const formRef =
    useRef<HTMLFormElement>(null);

  const numeroRef =
    useRef<HTMLInputElement>(null);

  const consultaRef =
    useRef<AbortController | null>(null);

  const consultaTransportadoraCepRef =
    useRef<AbortController | null>(null);

  const ultimoCep = useRef(
    apenasDigitosCep(inicial.cep) || null,
  );

  const ultimoAutomatico = useRef({
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
  });

  const ultimoTransportadoraCep = useRef<
    string | null
  >(null);

  const ultimoTransportadoraAutomatico = useRef({
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
  });

  const envioTravado = useRef(false);

  const termoBuscaTransportadora = buscaTransportadora.trim();
  const documentoBuscaTransportadora = somenteDigitos(
    termoBuscaTransportadora,
  );
  const termoApiTransportadora =
    documentoBuscaTransportadora.length >= 8
      ? documentoBuscaTransportadora
      : termoBuscaTransportadora;

  const { data: paginaTransportadoras, isFetching: buscandoTransportadoras } =
    useQuery({
      queryKey: ["transportadoras", "pesquisa", termoApiTransportadora],
      queryFn: () =>
        pesquisarClientes({
          data: {
            busca: termoApiTransportadora,
            pagina: 0,
            tamanho: 10,
          },
        }),
      enabled:
        form.usaTransportadora &&
        !transportadoraSelecionada &&
        termoApiTransportadora.length >= 2,
      placeholderData: (anterior) => anterior,
    });

  const transportadorasEncontradas = useMemo(
    () =>
      (paginaTransportadoras?.registros ?? []).filter(
        (registro: any) => registro.tipo === "TRANSPORTADORA",
      ) as TransportadoraBusca[],
    [paginaTransportadoras?.registros],
  );

  function preencherTransportadora(transportadora: TransportadoraBusca) {
    setTransportadoraSelecionada(transportadora);
    setCadastrandoNovaTransportadora(false);
    setBuscaTransportadora(transportadora.nome);
    setForm((atual) => ({
      ...atual,
      usaTransportadora: true,
      transportadoraNome: transportadora.nome || "",
      transportadoraCnpj: transportadora.documento || "",
      transportadoraTelefone: transportadora.telefone || "",
      transportadoraEmail: transportadora.email || "",
      transportadoraCep: mascararCep(transportadora.cep || ""),
      transportadoraEndereco: transportadora.endereco || "",
      transportadoraNumero: transportadora.numero || "",
      transportadoraComplemento: transportadora.complemento || "",
      transportadoraBairro: transportadora.bairro || "",
      transportadoraCidade: transportadora.cidade || "",
      transportadoraEstado: transportadora.estado || "",
      transportadoraObservacao: transportadora.observacao || "",
    }));
    setStatusTransportadora("Transportadora selecionada.");
  }

  function limparDadosTransportadora(atual: ClienteFormData) {
    return {
      ...atual,
      transportadoraNome: "",
      transportadoraCnpj: "",
      transportadoraTelefone: "",
      transportadoraEmail: "",
      transportadoraCep: "",
      transportadoraEndereco: "",
      transportadoraNumero: "",
      transportadoraComplemento: "",
      transportadoraBairro: "",
      transportadoraCidade: "",
      transportadoraEstado: "",
      transportadoraObservacao: "",
    };
  }

  function iniciarCadastroNovaTransportadora() {
    setTransportadoraSelecionada(null);
    setBuscaTransportadora("");
    setCadastrandoNovaTransportadora(true);
    setStatusTransportadora(null);
    setForm((atual) => ({
      ...limparDadosTransportadora(atual),
      usaTransportadora: true,
    }));
  }

  useEffect(() => {
    if (!aberto) return;

    setForm(inicial);

    setTipo(
      somenteDigitos(inicial.documento).length > 11
        ? "CNPJ"
        : "CPF",
    );

    setErros({});
    setStatusCep(null);
    setStatusTransportadora(null);
    setBuscaTransportadora("");
    setTransportadoraSelecionada(null);
    setCadastrandoNovaTransportadora(false);

    ultimoCep.current =
      apenasDigitosCep(inicial.cep) || null;

    ultimoTransportadoraCep.current =
      apenasDigitosCep(
        inicial.transportadoraCep,
      ) || null;
  }, [aberto, inicial]);

  useEffect(() => {
    if (!aberto) return;

    if (!clienteId) {
      setForm((atual) => ({
        ...atual,
        usaTransportadora: false,
      }));

      return;
    }

    let ativo = true;

    setStatusTransportadora(
      "Verificando transportadora cadastrada...",
    );

    buscarTransportadoraCliente(clienteId)
      .then((transportadora) => {
        if (!ativo) return;

        if (!transportadora) {
          setForm((atual) => ({
            ...atual,
            usaTransportadora: false,
          }));

          setStatusTransportadora(
            "Este cliente ainda não possui transportadora cadastrada.",
          );

          return;
        }

        setForm((atual) => ({
          ...atual,

          usaTransportadora: true,

          transportadoraNome:
            transportadora.nome || "",

          transportadoraCnpj:
            transportadora.cnpj || "",

          transportadoraTelefone:
            transportadora.telefone || "",

          transportadoraEmail:
            transportadora.email || "",

          transportadoraCep:
            mascararCep(
              transportadora.cep || "",
            ),

          transportadoraEndereco:
            transportadora.endereco || "",

          transportadoraNumero:
            transportadora.numero || "",

          transportadoraComplemento:
            transportadora.complemento || "",

          transportadoraBairro:
            transportadora.bairro || "",

          transportadoraCidade:
            transportadora.cidade || "",

          transportadoraEstado:
            transportadora.estado || "",

          transportadoraObservacao:
            transportadora.observacao || "",
        }));

        setTransportadoraSelecionada({
          id: String(transportadora.id),
          nome: transportadora.nome || "",
          documento: transportadora.cnpj || "",
          telefone: transportadora.telefone || "",
          email: transportadora.email || "",
          cep: transportadora.cep || "",
          endereco: transportadora.endereco || "",
          numero: transportadora.numero || "",
          complemento: transportadora.complemento || "",
          bairro: transportadora.bairro || "",
          cidade: transportadora.cidade || "",
          estado: transportadora.estado || "",
          observacao: transportadora.observacao || "",
        });
        setBuscaTransportadora(transportadora.nome || "");
        setCadastrandoNovaTransportadora(false);

        setStatusTransportadora(
          "Transportadora cadastrada para este cliente.",
        );
      })
      .catch((err) => {
        if (!ativo) return;

        setStatusTransportadora(
          err instanceof Error
            ? err.message
            : "Não foi possível consultar a transportadora.",
        );
      });

    return () => {
      ativo = false;
    };
  }, [aberto, clienteId]);

  useEffect(() => {
    return () => {
      consultaRef.current?.abort();
      consultaTransportadoraCepRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!salvando) {
      envioTravado.current = false;
    }
  }, [salvando]);

  if (!aberto) return null;

  const cadastroAtual = form.tipo ?? "CLIENTE";

  const alterar = (
    campo: keyof ClienteFormData,
    valor: string | boolean,
  ) => {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));

    setErros((atual) => ({
      ...atual,
      [campo]: "",
    }));
  };

  async function buscarCep() {
    const cep = apenasDigitosCep(form.cep);

    if (
      !cep ||
      cep.length !== 8 ||
      cep === ultimoCep.current
    ) {
      return;
    }

    consultaRef.current?.abort();

    const controller = new AbortController();

    consultaRef.current = controller;
    ultimoCep.current = cep;

    setStatusCep("Buscando endereço...");

    try {
      const encontrado = await consultarCep(
        cep,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      if (!encontrado) {
        setStatusCep(
          "CEP não encontrado. Preencha o endereço manualmente.",
        );

        return;
      }

      setForm((atual) => {
        if (
          apenasDigitosCep(atual.cep) !== cep
        ) {
          return atual;
        }

        const podePreencher = (
          campo:
            | "endereco"
            | "bairro"
            | "cidade"
            | "estado",
        ) =>
          !atual[campo] ||
          atual[campo] ===
            ultimoAutomatico.current[campo];

        const proximo = {
          ...atual,

          endereco: podePreencher("endereco")
            ? encontrado.endereco
            : atual.endereco,

          bairro: podePreencher("bairro")
            ? encontrado.bairro
            : atual.bairro,

          cidade: podePreencher("cidade")
            ? encontrado.cidade
            : atual.cidade,

          estado: podePreencher("estado")
            ? encontrado.estado
            : atual.estado,
        };

        ultimoAutomatico.current = encontrado;

        return proximo;
      });

      setStatusCep(
        "Endereço encontrado. Confira os dados abaixo.",
      );

      numeroRef.current?.focus();
    } catch {
      if (!controller.signal.aborted) {
        setStatusCep(
          "Não foi possível consultar o CEP. Preencha o endereço manualmente.",
        );
      }
    }
  }

  async function buscarCepTransportadora() {
    const cep = apenasDigitosCep(
      form.transportadoraCep,
    );

    if (
      !cep ||
      cep.length !== 8 ||
      cep === ultimoTransportadoraCep.current
    ) {
      return;
    }

    consultaTransportadoraCepRef.current?.abort();

    const controller = new AbortController();

    consultaTransportadoraCepRef.current =
      controller;

    ultimoTransportadoraCep.current = cep;

    setStatusTransportadora(
      "Buscando endereço da transportadora...",
    );

    try {
      const encontrado = await consultarCep(
        cep,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      if (!encontrado) {
        setStatusTransportadora(
          "CEP da transportadora não encontrado. Preencha o endereço manualmente.",
        );

        return;
      }

      setForm((atual) => {
        if (
          apenasDigitosCep(
            atual.transportadoraCep,
          ) !== cep
        ) {
          return atual;
        }

        const podePreencher = (
          campo:
            | "endereco"
            | "bairro"
            | "cidade"
            | "estado",
        ) =>
          !atual[
            `transportadora${campo
              .charAt(0)
              .toUpperCase()}${campo.slice(1)}` as keyof ClienteFormData
          ] ||
          atual[
            `transportadora${campo
              .charAt(0)
              .toUpperCase()}${campo.slice(1)}` as keyof ClienteFormData
          ] ===
            ultimoTransportadoraAutomatico.current[
              campo
            ];

        const proximo = {
          ...atual,

          transportadoraEndereco:
            podePreencher("endereco")
              ? encontrado.endereco
              : atual.transportadoraEndereco,

          transportadoraBairro:
            podePreencher("bairro")
              ? encontrado.bairro
              : atual.transportadoraBairro,

          transportadoraCidade:
            podePreencher("cidade")
              ? encontrado.cidade
              : atual.transportadoraCidade,

          transportadoraEstado:
            podePreencher("estado")
              ? encontrado.estado
              : atual.transportadoraEstado,
        };

        ultimoTransportadoraAutomatico.current =
          encontrado;

        return proximo;
      });

      setStatusTransportadora(
        "Endereço da transportadora encontrado. Confira os dados.",
      );
    } catch {
      if (!controller.signal.aborted) {
        setStatusTransportadora(
          "Não foi possível consultar o CEP da transportadora.",
        );
      }
    }
  }

  async function enviar(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (
      salvando ||
      envioTravado.current
    ) {
      return;
    }

    const normalizado: ClienteFormData = {
      ...form,

      cep: apenasDigitosCep(form.cep),

      documento: somenteDigitos(
        form.documento,
      ),

      transportadoraCep:
        apenasDigitosCep(
          form.transportadoraCep,
        ),

      transportadoraCnpj:
        somenteDigitos(
          form.transportadoraCnpj,
        ),
    };

    const resultado =
      clienteSchema.safeParse(
        normalizado,
      );

    const novosErros: Record<
      string,
      string
    > = {};

    if (!resultado.success) {
      for (const issue of resultado.error
        .issues) {
        const campo = String(
          issue.path[0],
        );

        if (!novosErros[campo]) {
          novosErros[campo] =
            issue.message;
        }
      }
    }

    if (
      form.cep &&
      apenasDigitosCep(form.cep)
        .length !== 8
    ) {
      novosErros.cep =
        "Informe um CEP válido com 8 dígitos.";
    }

    if (
      cadastroAtual !== "TRANSPORTADORA" &&
      tipo === "CPF" &&
      !validarCpf(form.documento)
    ) {
      novosErros.documento =
        "O CPF informado não é válido.";
    }

    if (
      cadastroAtual !== "TRANSPORTADORA" &&
      tipo === "CNPJ" &&
      !validarCnpj(form.documento)
    ) {
      novosErros.documento =
        "O CNPJ informado não é válido.";
    }

    if (
      form.usaTransportadora &&
      !form.transportadoraNome.trim()
    ) {
      novosErros.transportadoraNome =
        "Informe o nome da transportadora.";
    }

    if (
      form.usaTransportadora &&
      form.transportadoraEmail.trim()
    ) {
      const emailValido =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          form.transportadoraEmail.trim(),
        );

      if (!emailValido) {
        novosErros.transportadoraEmail =
          "Informe um e-mail válido.";
      }
    }

    if (
      form.usaTransportadora &&
      form.transportadoraCep &&
      apenasDigitosCep(
        form.transportadoraCep,
      ).length !== 8
    ) {
      novosErros.transportadoraCep =
        "Informe um CEP válido com 8 dígitos.";
    }

    setErros(novosErros);

    const primeiro =
      Object.keys(novosErros)[0];

    if (primeiro) {
      formRef.current
        ?.querySelector<HTMLElement>(
          `[data-field="${primeiro}"]`,
        )
        ?.focus();

      return;
    }

    envioTravado.current = true;

    await onSubmit(normalizado);
  }

  const nomeCadastro =
    cadastroAtual === "TRANSPORTADORA"
      ? "transportadora"
      : cadastroAtual === "LOJISTA"
        ? "lojista"
        : "cliente";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm md:items-center md:p-4"
      onMouseDown={(e) =>
        e.target === e.currentTarget &&
        !salvando &&
        onClose()
      }
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cliente-modal-title"
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-card shadow-warm-lg md:max-h-[88vh] md:max-w-3xl md:rounded-3xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3 md:px-6">
          <div>
            <h2
              id="cliente-modal-title"
              className="font-display text-xl font-bold text-primary"
            >
              {titulo}
            </h2>

            {descricao && (
              <p className="mt-1 text-sm text-muted-foreground">
                {descricao}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={salvando}
            onClick={onClose}
            aria-label="Fechar cadastro de cliente"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-full hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={22} />
          </button>
        </header>

        <form
          ref={formRef}
          onSubmit={enviar}
          noValidate
          aria-busy={salvando}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-background/40 px-4 py-4 md:px-6">
            <Secao
              icon={<UserRound size={20} />}
              titulo="Dados principais"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Campo
                  campo="nome"
                  label={
                    cadastroAtual === "TRANSPORTADORA"
                      ? "Nome da transportadora"
                      : "Nome completo ou razão social"
                  }
                  erro={erros.nome}
                  className="md:col-span-2"
                >
                  <input
                    autoFocus
                    data-field="nome"
                    value={form.nome}
                    onChange={(e) =>
                      alterar(
                        "nome",
                        e.target.value,
                      )
                    }
                    className="ds-input min-h-10 text-sm"
                    placeholder={
                      cadastroAtual === "TRANSPORTADORA"
                        ? "Ex.: Jadlog"
                        : "Ex.: Maria da Silva ou Mercado da Maria"
                    }
                  />
                </Campo>

                {cadastroAtual !== "TRANSPORTADORA" && (
                  <>
                    <Campo
                      campo="telefone"
                      label="Telefone"
                      erro={erros.telefone}
                    >
                      <input
                        data-field="telefone"
                        type="tel"
                        inputMode="numeric"
                        value={form.telefone}
                        onChange={(e) =>
                          alterar(
                            "telefone",
                            mascararTelefone(
                              e.target.value,
                            ),
                          )
                        }
                        className="ds-input min-h-10 text-sm"
                        placeholder="(00) 00000-0000"
                      />
                    </Campo>

                    <Campo
                      campo="email"
                      label="E-mail (opcional)"
                      erro={erros.email}
                    >
                      <input
                        data-field="email"
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          alterar(
                            "email",
                            e.target.value,
                          )
                        }
                        className="ds-input min-h-10 text-sm"
                        placeholder="cliente@email.com"
                      />
                    </Campo>
                  </>
                )}
              </div>
            </Secao>

            {cadastroAtual !== "TRANSPORTADORA" && (
              <Secao
                icon={<FileText size={20} />}
                titulo="Documento"
              >
              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-foreground">
                  Tipo de documento
                </legend>

                <div className="grid grid-cols-2 gap-3">
                  {(
                    ["CPF", "CNPJ"] as const
                  ).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={
                        tipo === item
                      }
                      onClick={() => {
                        setTipo(item);
                        alterar(
                          "documento",
                          "",
                        );
                      }}
                      className={`min-h-10 rounded-xl border-2 px-3 text-sm font-bold ${
                        tipo === item
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-secondary"
                      }`}
                    >
                      {item === "CPF"
                        ? "Pessoa física — CPF"
                        : "Pessoa jurídica — CNPJ"}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div
                className={`mt-4 grid gap-4 ${
                  tipo === "CNPJ"
                    ? "md:grid-cols-2"
                    : ""
                }`}
              >
                <Campo
                  campo="documento"
                  label={tipo}
                  erro={erros.documento}
                >
                  <input
                    data-field="documento"
                    inputMode="numeric"
                    value={form.documento}
                    onChange={(e) =>
                      alterar(
                        "documento",
                        mascararDocumento(
                          e.target.value,
                          tipo,
                        ),
                      )
                    }
                    className="ds-input min-h-10 text-sm"
                    placeholder={
                      tipo === "CPF"
                        ? "000.000.000-00"
                        : "00.000.000/0000-00"
                    }
                  />
                </Campo>

                {tipo === "CNPJ" && (
                  <Campo
                    campo="inscricaoEstadual"
                    label="Inscrição estadual (opcional)"
                    erro={
                      erros.inscricaoEstadual
                    }
                  >
                    <input
                      data-field="inscricaoEstadual"
                      value={
                        form.inscricaoEstadual
                      }
                      onChange={(e) =>
                        alterar(
                          "inscricaoEstadual",
                          e.target.value,
                        )
                      }
                      className="ds-input min-h-10 text-sm"
                      placeholder="Número ou ISENTO"
                    />
                  </Campo>
                )}
              </div>
              </Secao>
            )}

            {cadastroAtual !== "TRANSPORTADORA" && (
              <Secao
                icon={<MapPin size={20} />}
                titulo="Endereço"
              >
              <div className="grid gap-4 md:grid-cols-6">
                <Campo
                  campo="cep"
                  label="CEP (opcional)"
                  erro={erros.cep}
                  className="md:col-span-2"
                >
                  <input
                    data-field="cep"
                    inputMode="numeric"
                    value={form.cep}
                    onChange={(e) => {
                      const cep =
                        mascararCep(
                          e.target.value,
                        );

                      if (
                        apenasDigitosCep(
                          cep,
                        ) !==
                        ultimoCep.current
                      ) {
                        consultaRef.current?.abort();
                      }

                      alterar("cep", cep);
                      setStatusCep(null);

                      if (
                        apenasDigitosCep(
                          cep,
                        ).length !== 8
                      ) {
                        ultimoCep.current =
                          null;
                      }
                    }}
                    onBlur={buscarCep}
                    className="ds-input min-h-10 text-sm"
                    placeholder="00000-000"
                    aria-describedby="cep-status"
                  />
                </Campo>

                <div
                  id="cep-status"
                  role="status"
                  className="flex min-h-10 items-end pb-2 text-sm font-medium text-muted-foreground md:col-span-4"
                >
                  {statusCep}
                </div>

                <Campo
                  campo="endereco"
                  label="Rua ou logradouro"
                  erro={erros.endereco}
                  className="md:col-span-5"
                >
                  <input
                    data-field="endereco"
                    value={form.endereco}
                    onChange={(e) =>
                      alterar(
                        "endereco",
                        e.target.value,
                      )
                    }
                    className="ds-input min-h-10 text-sm"
                    placeholder="Ex.: Rua das Flores"
                  />
                </Campo>

                <Campo
                  campo="numero"
                  label="Número"
                  erro={erros.numero}
                  className="md:col-span-1"
                >
                  <input
                    ref={numeroRef}
                    data-field="numero"
                    value={form.numero}
                    onChange={(e) =>
                      alterar(
                        "numero",
                        e.target.value,
                      )
                    }
                    className="ds-input min-h-10 text-sm"
                    placeholder="123"
                  />
                </Campo>

                <Campo
                  campo="complemento"
                  label="Complemento (opcional)"
                  erro={erros.complemento}
                  className="md:col-span-3"
                >
                  <input
                    data-field="complemento"
                    value={form.complemento}
                    onChange={(e) =>
                      alterar(
                        "complemento",
                        e.target.value,
                      )
                    }
                    className="ds-input min-h-10 text-sm"
                    placeholder="Casa 2, fundos ou apartamento"
                  />
                </Campo>

                <Campo
                  campo="bairro"
                  label="Bairro"
                  erro={erros.bairro}
                  className="md:col-span-3"
                >
                  <input
                    data-field="bairro"
                    value={form.bairro}
                    onChange={(e) =>
                      alterar(
                        "bairro",
                        e.target.value,
                      )
                    }
                    className="ds-input min-h-10 text-sm"
                    placeholder="Ex.: Centro"
                  />
                </Campo>

                <Campo
                  campo="cidade"
                  label="Cidade"
                  erro={erros.cidade}
                  className="md:col-span-4"
                >
                  <input
                    data-field="cidade"
                    value={form.cidade}
                    onChange={(e) =>
                      alterar(
                        "cidade",
                        e.target.value,
                      )
                    }
                    className="ds-input min-h-10 text-sm"
                    placeholder="Ex.: São Paulo"
                  />
                </Campo>

                <Campo
                  campo="estado"
                  label="Estado"
                  erro={erros.estado}
                  className="md:col-span-2"
                >
                  <select
                    data-field="estado"
                    value={form.estado}
                    onChange={(e) =>
                      alterar(
                        "estado",
                        e.target.value,
                      )
                    }
                    className="ds-input min-h-10 text-sm"
                  >
                    <option value="">
                      Selecione
                    </option>

                    {UFS_BRASIL.map(
                      (uf) => (
                        <option
                          key={uf}
                          value={uf}
                        >
                          {uf}
                        </option>
                      ),
                    )}
                  </select>
                </Campo>
              </div>
              </Secao>
            )}

            {cadastroAtual === "CLIENTE" && (
              <Secao
                icon={<Truck size={20} />}
                titulo="Transportadora vinculada"
              >
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Este cliente utiliza uma transportadora?
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Cadastre a transportadora uma única vez.
                    Nas próximas vendas, ela será vinculada
                    automaticamente a este cliente.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      alterar("usaTransportadora", false);
                      setBuscaTransportadora("");
                      setTransportadoraSelecionada(null);
                      setCadastrandoNovaTransportadora(false);
                    }}
                    className={`min-h-10 rounded-xl border-2 px-3 text-sm font-bold ${
                      !form.usaTransportadora
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    }`}
                  >
                    Não
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      alterar("usaTransportadora", true);
                      setCadastrandoNovaTransportadora(false);
                    }}
                    className={`min-h-10 rounded-xl border-2 px-3 text-sm font-bold ${
                      form.usaTransportadora
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    }`}
                  >
                    Sim
                  </button>
                </div>

                {form.usaTransportadora && (
                  <div className="space-y-2 rounded-xl border border-border bg-background/50 p-3">
                    <div>
                      <label className="block text-sm font-semibold text-foreground">
                        Buscar transportadora cadastrada
                      </label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Digite o nome ou CNPJ para localizar uma transportadora existente.
                      </p>
                    </div>

                    <div className="relative">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <input
                        value={buscaTransportadora}
                        onChange={(event) => {
                          setBuscaTransportadora(event.target.value);
                          setTransportadoraSelecionada(null);
                          setCadastrandoNovaTransportadora(false);
                          setStatusTransportadora(null);
                        }}
                        className="ds-input min-h-10 pl-10 text-sm"
                        placeholder="Nome ou CNPJ da transportadora"
                        autoComplete="off"
                      />
                    </div>

                    {transportadoraSelecionada ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/30 bg-success-bg px-3 py-2.5">
                        <div className="min-w-0 text-sm">
                          <strong className="block truncate text-foreground">
                            {transportadoraSelecionada.nome}
                          </strong>
                          <span className="text-xs text-muted-foreground">
                            {transportadoraSelecionada.documento || "CNPJ não informado"}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTransportadoraSelecionada(null);
                              setBuscaTransportadora("");
                              setCadastrandoNovaTransportadora(true);
                            }}
                            className="rounded-md px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-card"
                          >
                            Editar dados
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTransportadoraSelecionada(null);
                              setBuscaTransportadora("");
                              setCadastrandoNovaTransportadora(false);
                              setStatusTransportadora(null);
                            }}
                            className="rounded-md px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-card hover:text-foreground"
                          >
                            Trocar
                          </button>
                        </div>
                      </div>
                    ) : termoApiTransportadora.length >= 2 ? (
                      <div className="rounded-lg border border-border bg-card p-1">
                        {buscandoTransportadoras ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            Buscando transportadoras...
                          </p>
                        ) : transportadorasEncontradas.length > 0 ? (
                          transportadorasEncontradas.map((transportadora) => (
                            <button
                              key={transportadora.id}
                              type="button"
                              onClick={() => preencherTransportadora(transportadora)}
                              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-secondary"
                            >
                              <span className="min-w-0">
                                <strong className="block truncate text-sm text-foreground">
                                  {transportadora.nome}
                                </strong>
                                <span className="block text-xs text-muted-foreground">
                                  {transportadora.documento || "CNPJ não informado"}
                                </span>
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-primary">
                                Selecionar
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <span className="text-xs text-muted-foreground">
                              Nenhuma transportadora encontrada.
                            </span>
                            <button
                              type="button"
                              onClick={iniciarCadastroNovaTransportadora}
                              className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-dark"
                            >
                              Cadastrar nova
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {!transportadoraSelecionada && !cadastrandoNovaTransportadora && (
                      <button
                        type="button"
                        onClick={iniciarCadastroNovaTransportadora}
                        className="text-left text-xs font-bold text-primary hover:underline"
                      >
                        + Cadastrar nova transportadora
                      </button>
                    )}
                  </div>
                )}

                {statusTransportadora && (
                  <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                    {statusTransportadora}
                  </div>
                )}

                {form.usaTransportadora && cadastrandoNovaTransportadora && !transportadoraSelecionada && (
                  <div className="space-y-4 rounded-2xl border border-border bg-background/50 p-3 md:p-4">
                    <Campo
                      campo="transportadoraNome"
                      label="Nome da transportadora"
                      erro={
                        erros.transportadoraNome
                      }
                    >
                      <input
                        data-field="transportadoraNome"
                        value={
                          form.transportadoraNome
                        }
                        onChange={(e) =>
                          alterar(
                            "transportadoraNome",
                            e.target.value,
                          )
                        }
                        className="ds-input min-h-10 text-sm"
                        placeholder="Ex.: Jadlog"
                      />
                    </Campo>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Campo
                        campo="transportadoraCnpj"
                        label="CNPJ (opcional)"
                        erro={
                          erros.transportadoraCnpj
                        }
                      >
                        <input
                          data-field="transportadoraCnpj"
                          inputMode="numeric"
                          value={
                            form.transportadoraCnpj
                          }
                          onChange={(e) =>
                            alterar(
                              "transportadoraCnpj",
                              e.target.value,
                            )
                          }
                          className="ds-input min-h-10 text-sm"
                          placeholder="00.000.000/0000-00"
                        />
                      </Campo>

                      <Campo
                        campo="transportadoraTelefone"
                        label="Telefone (opcional)"
                        erro={
                          erros.transportadoraTelefone
                        }
                      >
                        <input
                          data-field="transportadoraTelefone"
                          type="tel"
                          inputMode="numeric"
                          value={
                            form.transportadoraTelefone
                          }
                          onChange={(e) =>
                            alterar(
                              "transportadoraTelefone",
                              mascararTelefone(
                                e.target.value,
                              ),
                            )
                          }
                          className="ds-input min-h-10 text-sm"
                          placeholder="(00) 00000-0000"
                        />
                      </Campo>
                    </div>

                    <Campo
                      campo="transportadoraEmail"
                      label="E-mail (opcional)"
                      erro={
                        erros.transportadoraEmail
                      }
                    >
                      <input
                        data-field="transportadoraEmail"
                        type="email"
                        value={
                          form.transportadoraEmail
                        }
                        onChange={(e) =>
                          alterar(
                            "transportadoraEmail",
                            e.target.value,
                          )
                        }
                        className="ds-input min-h-10 text-sm"
                        placeholder="transportadora@email.com"
                      />
                    </Campo>

                    <div className="border-t border-border pt-4">
                      <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Endereço da transportadora
                      </h4>

                      <div className="grid gap-4 md:grid-cols-6">
                        <Campo
                          campo="transportadoraCep"
                          label="CEP"
                          erro={
                            erros.transportadoraCep
                          }
                          className="md:col-span-2"
                        >
                          <input
                            data-field="transportadoraCep"
                            inputMode="numeric"
                            value={
                              form.transportadoraCep
                            }
                            onChange={(e) => {
                              const cep =
                                mascararCep(
                                  e.target.value,
                                );

                              if (
                                apenasDigitosCep(
                                  cep,
                                ) !==
                                ultimoTransportadoraCep.current
                              ) {
                                consultaTransportadoraCepRef.current?.abort();
                              }

                              alterar(
                                "transportadoraCep",
                                cep,
                              );

                              if (
                                apenasDigitosCep(
                                  cep,
                                ).length !== 8
                              ) {
                                ultimoTransportadoraCep.current =
                                  null;
                              }
                            }}
                            onBlur={
                              buscarCepTransportadora
                            }
                            className="ds-input min-h-10 text-sm"
                            placeholder="00000-000"
                          />
                        </Campo>

                        <div className="md:col-span-4" />

                        <Campo
                          campo="transportadoraEndereco"
                          label="Rua ou logradouro"
                          erro={
                            erros.transportadoraEndereco
                          }
                          className="md:col-span-5"
                        >
                          <input
                            data-field="transportadoraEndereco"
                            value={
                              form.transportadoraEndereco
                            }
                            onChange={(e) =>
                              alterar(
                                "transportadoraEndereco",
                                e.target.value,
                              )
                            }
                            className="ds-input min-h-10 text-sm"
                            placeholder="Ex.: Rua das Flores"
                          />
                        </Campo>

                        <Campo
                          campo="transportadoraNumero"
                          label="Número"
                          erro={
                            erros.transportadoraNumero
                          }
                          className="md:col-span-1"
                        >
                          <input
                            data-field="transportadoraNumero"
                            value={
                              form.transportadoraNumero
                            }
                            onChange={(e) =>
                              alterar(
                                "transportadoraNumero",
                                e.target.value,
                              )
                            }
                            className="ds-input min-h-10 text-sm"
                            placeholder="123"
                          />
                        </Campo>

                        <Campo
                          campo="transportadoraComplemento"
                          label="Complemento (opcional)"
                          erro={
                            erros.transportadoraComplemento
                          }
                          className="md:col-span-3"
                        >
                          <input
                            data-field="transportadoraComplemento"
                            value={
                              form.transportadoraComplemento
                            }
                            onChange={(e) =>
                              alterar(
                                "transportadoraComplemento",
                                e.target.value,
                              )
                            }
                            className="ds-input min-h-10 text-sm"
                            placeholder="Sala 2, galpão..."
                          />
                        </Campo>

                        <Campo
                          campo="transportadoraBairro"
                          label="Bairro"
                          erro={
                            erros.transportadoraBairro
                          }
                          className="md:col-span-3"
                        >
                          <input
                            data-field="transportadoraBairro"
                            value={
                              form.transportadoraBairro
                            }
                            onChange={(e) =>
                              alterar(
                                "transportadoraBairro",
                                e.target.value,
                              )
                            }
                            className="ds-input min-h-10 text-sm"
                            placeholder="Ex.: Centro"
                          />
                        </Campo>

                        <Campo
                          campo="transportadoraCidade"
                          label="Cidade"
                          erro={
                            erros.transportadoraCidade
                          }
                          className="md:col-span-4"
                        >
                          <input
                            data-field="transportadoraCidade"
                            value={
                              form.transportadoraCidade
                            }
                            onChange={(e) =>
                              alterar(
                                "transportadoraCidade",
                                e.target.value,
                              )
                            }
                            className="ds-input min-h-10 text-sm"
                            placeholder="Ex.: São Paulo"
                          />
                        </Campo>

                        <Campo
                          campo="transportadoraEstado"
                          label="Estado"
                          erro={
                            erros.transportadoraEstado
                          }
                          className="md:col-span-2"
                        >
                          <select
                            data-field="transportadoraEstado"
                            value={
                              form.transportadoraEstado
                            }
                            onChange={(e) =>
                              alterar(
                                "transportadoraEstado",
                                e.target.value,
                              )
                            }
                            className="ds-input min-h-10 text-sm"
                          >
                            <option value="">
                              Selecione
                            </option>

                            {UFS_BRASIL.map(
                              (uf) => (
                                <option
                                  key={uf}
                                  value={uf}
                                >
                                  {uf}
                                </option>
                              ),
                            )}
                          </select>
                        </Campo>
                      </div>
                    </div>

                    <Campo
                      campo="transportadoraObservacao"
                      label="Observação (opcional)"
                      erro={
                        erros.transportadoraObservacao
                      }
                    >
                      <textarea
                        data-field="transportadoraObservacao"
                        value={
                          form.transportadoraObservacao
                        }
                        onChange={(e) =>
                          alterar(
                            "transportadoraObservacao",
                            e.target.value,
                          )
                        }
                        className="ds-input min-h-24 resize-y py-3 text-sm"
                        placeholder="Informações adicionais sobre a transportadora..."
                      />
                    </Campo>
                  </div>
                )}
              </div>
              </Secao>
            )}

            {erroGeral && (
              <div
                role="alert"
                className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-sm font-semibold text-error"
              >
                {erroGeral}
              </div>
            )}
          </div>

          <footer className="sticky bottom-0 flex gap-2 border-t border-border bg-card px-4 py-3 md:justify-end md:px-6">
            <button
              type="button"
              disabled={salvando}
              onClick={onClose}
              className="min-h-10 rounded-xl border border-border px-5 text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-primary-dark disabled:opacity-60 md:flex-none"
            >
              <Check size={18} />

              {salvando
                ? "Salvando..."
                : `Salvar ${nomeCadastro}`}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Secao({
  titulo,
  icon,
  children,
}: {
  titulo: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-warm-sm md:p-5">
      <h3 className="mb-4 flex items-center gap-2 border-b border-border pb-2 font-display text-lg font-bold text-primary">
        {icon}
        {titulo}
      </h3>

      {children}
    </section>
  );
}

function Campo({
  campo,
  label,
  erro,
  className = "",
  children,
}: {
  campo: string;
  label: string;
  erro?: string;
  className?: string;
  children: React.ReactElement<
    Record<string, unknown>
  >;
}) {
  const id = `cliente-${campo}-erro`;

  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-bold text-foreground">
        {label}
      </label>

      {cloneElement(children, {
        "aria-invalid":
          Boolean(erro) || undefined,
        "aria-describedby": erro
          ? id
          : undefined,
      })}

      {erro && (
        <p
          id={id}
          className="mt-1.5 text-sm font-semibold text-error"
        >
          {erro}
        </p>
      )}
    </div>
  );
}

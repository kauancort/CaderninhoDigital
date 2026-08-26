import {
  cloneElement,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Check,
  FileText,
  MapPin,
  Truck,
  UserRound,
  X,
} from "lucide-react";

import {
  buscarTransportadoraCliente,
  clienteSchema,
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
      tipo === "CPF" &&
      !validarCpf(form.documento)
    ) {
      novosErros.documento =
        "O CPF informado não é válido.";
    }

    if (
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
        className="flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-3xl bg-card shadow-warm-lg md:max-h-[92vh] md:max-w-4xl md:rounded-3xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4 md:px-8">
          <div>
            <h2
              id="cliente-modal-title"
              className="font-display text-2xl font-bold text-primary"
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
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"
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
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto bg-background/40 px-5 py-6 md:px-8">
            <Secao
              icon={<UserRound size={20} />}
              titulo="Dados principais"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Campo
                  campo="nome"
                  label="Nome completo ou razão social"
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
                    className="ds-input min-h-12 text-base"
                    placeholder="Ex.: Maria da Silva ou Mercado da Maria"
                  />
                </Campo>

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
                    className="ds-input min-h-12 text-base"
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
                    className="ds-input min-h-12 text-base"
                    placeholder="cliente@email.com"
                  />
                </Campo>
              </div>
            </Secao>

            <Secao
              icon={<FileText size={20} />}
              titulo="Documento"
            >
              <fieldset>
                <legend className="mb-3 text-base font-semibold text-foreground">
                  Tipo de cliente
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
                      className={`min-h-12 rounded-xl border-2 px-3 text-base font-bold ${
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
                className={`mt-5 grid gap-5 ${
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
                    className="ds-input min-h-12 text-base"
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
                      className="ds-input min-h-12 text-base"
                      placeholder="Número ou ISENTO"
                    />
                  </Campo>
                )}
              </div>
            </Secao>

            <Secao
              icon={<MapPin size={20} />}
              titulo="Endereço"
            >
              <div className="grid gap-5 md:grid-cols-6">
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
                    className="ds-input min-h-12 text-base"
                    placeholder="00000-000"
                    aria-describedby="cep-status"
                  />
                </Campo>

                <div
                  id="cep-status"
                  role="status"
                  className="flex min-h-12 items-end pb-3 text-sm font-medium text-muted-foreground md:col-span-4"
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
                    className="ds-input min-h-12 text-base"
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
                    className="ds-input min-h-12 text-base"
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
                    className="ds-input min-h-12 text-base"
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
                    className="ds-input min-h-12 text-base"
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
                    className="ds-input min-h-12 text-base"
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
                    className="ds-input min-h-12 text-base"
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

            <Secao
              icon={<Truck size={20} />}
              titulo="Transportadora vinculada"
            >
              <div className="space-y-5">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Este cliente utiliza uma transportadora?
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Cadastre a transportadora uma única vez.
                    Nas próximas vendas, ela será vinculada
                    automaticamente a este cliente.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      alterar(
                        "usaTransportadora",
                        false,
                      )
                    }
                    className={`min-h-12 rounded-xl border-2 px-3 text-base font-bold ${
                      !form.usaTransportadora
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    }`}
                  >
                    Não
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      alterar(
                        "usaTransportadora",
                        true,
                      )
                    }
                    className={`min-h-12 rounded-xl border-2 px-3 text-base font-bold ${
                      form.usaTransportadora
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    }`}
                  >
                    Sim
                  </button>
                </div>

                {statusTransportadora && (
                  <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                    {statusTransportadora}
                  </div>
                )}

                {form.usaTransportadora && (
                  <div className="space-y-5 rounded-2xl border border-border bg-background/50 p-4 md:p-5">
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
                        className="ds-input min-h-12 text-base"
                        placeholder="Ex.: Jadlog"
                      />
                    </Campo>

                    <div className="grid gap-5 md:grid-cols-2">
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
                          className="ds-input min-h-12 text-base"
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
                          className="ds-input min-h-12 text-base"
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
                        className="ds-input min-h-12 text-base"
                        placeholder="transportadora@email.com"
                      />
                    </Campo>

                    <div className="border-t border-border pt-5">
                      <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Endereço da transportadora
                      </h4>

                      <div className="grid gap-5 md:grid-cols-6">
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
                            className="ds-input min-h-12 text-base"
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
                            className="ds-input min-h-12 text-base"
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
                            className="ds-input min-h-12 text-base"
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
                            className="ds-input min-h-12 text-base"
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
                            className="ds-input min-h-12 text-base"
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
                            className="ds-input min-h-12 text-base"
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
                            className="ds-input min-h-12 text-base"
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
                        className="ds-input min-h-24 resize-y py-3 text-base"
                        placeholder="Informações adicionais sobre a transportadora..."
                      />
                    </Campo>
                  </div>
                )}
              </div>
            </Secao>

            {erroGeral && (
              <div
                role="alert"
                className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-base font-semibold text-error"
              >
                {erroGeral}
              </div>
            )}
          </div>

          <footer className="sticky bottom-0 flex gap-3 border-t border-border bg-card px-5 py-4 md:justify-end md:px-8">
            <button
              type="button"
              disabled={salvando}
              onClick={onClose}
              className="min-h-12 rounded-xl border border-border px-6 text-base font-bold text-foreground hover:bg-secondary disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-bold text-primary-foreground hover:bg-primary-dark disabled:opacity-60 md:flex-none"
            >
              <Check size={18} />

              {salvando
                ? "Salvando..."
                : "Salvar cliente"}
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
    <section className="rounded-2xl border border-border bg-card p-5 shadow-warm-sm md:p-6">
      <h3 className="mb-5 flex items-center gap-2 border-b border-border pb-3 font-display text-xl font-bold text-primary">
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
      <label className="mb-2 block text-base font-bold text-foreground">
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
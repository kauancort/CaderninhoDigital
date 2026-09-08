const api = require("./apiClient");
const catalogCache = require("./catalogCache");

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function somenteDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function normalizarTelefone(telefone) {
  const digitos = somenteDigitos(telefone);

  if (digitos.length < 10 || digitos.length > 11) {
    return null;
  }

  return digitos;
}

function normalizarDocumento(documento) {
  const digitos = somenteDigitos(documento);

  if (!digitos) {
    return null;
  }

  return digitos;
}

function validarNovoCliente(novoCliente) {
  if (!novoCliente) {
    return "Os dados do novo cliente não foram informados.";
  }

  if (!novoCliente.documento) {
    return "Informe o CPF ou CNPJ do cliente.";
  }

  if (!novoCliente.estado) {
    return "Informe o estado do cliente.";
  }

  if (!novoCliente.cidade) {
    return "Informe a cidade do cliente.";
  }

  if (!novoCliente.bairro) {
    return "Informe o bairro do cliente.";
  }

  if (!novoCliente.endereco) {
    return "Informe o endereço do cliente.";
  }

  if (!novoCliente.numero) {
    return "Informe o número do endereço do cliente.";
  }

  if (!novoCliente.telefone) {
    return "Informe o telefone do cliente.";
  }

  const telefone = normalizarTelefone(
    novoCliente.telefone,
  );

  if (!telefone) {
    return "Informe um telefone válido com DDD.";
  }

  return null;
}

async function resolverClienteId(
  nomeFalado,
  novoCliente = null,
) {
  if (
    !nomeFalado ||
    !String(nomeFalado).trim()
  ) {
    return {
      clienteId: null,
      criadoAgora: false,
    };
  }

  const nome = String(nomeFalado).trim();

  const clientes =
    await catalogCache.getClientes();

  const nomeNormalizado =
    normalizarTexto(nome);

  const encontrado =
    clientes.find((c) => {
      return (
        normalizarTexto(c.nome) ===
        nomeNormalizado
      );
    });

  if (encontrado) {
    return {
      clienteId: encontrado.id,
      criadoAgora: false,
    };
  }

  const parcial =
    clientes.find((c) => {
      const nomeCliente =
        normalizarTexto(c.nome);

      return (
        nomeCliente.includes(
          nomeNormalizado,
        ) ||
        nomeNormalizado.includes(
          nomeCliente,
        )
      );
    });

  if (parcial) {
    return {
      clienteId: parcial.id,
      criadoAgora: false,
    };
  }

  /*
   * Cliente novo.
   *
   * Não criamos telefone falso.
   * Não criamos e-mail falso.
   *
   * O backend exige telefone, documento,
   * endereço, número, bairro, cidade e estado.
   */

  const erro =
    validarNovoCliente(
      novoCliente,
    );

  if (erro) {
    throw new Error(erro);
  }

  const telefone =
    normalizarTelefone(
      novoCliente.telefone,
    );

  const documento =
    normalizarDocumento(
      novoCliente.documento,
    );

  if (!telefone) {
    throw new Error(
      "Informe um telefone válido com DDD.",
    );
  }

  if (!documento) {
    throw new Error(
      "Informe um CPF ou CNPJ válido.",
    );
  }

  const novo = await api.post(
    "/clientes",
    {
      nome,

      email:
        novoCliente.email ||
        null,

      telefone,

      documento,

      endereco:
        novoCliente.endereco,

      numero:
        String(
          novoCliente.numero,
        ),

      complemento:
        novoCliente.complemento ||
        null,

      cep:
        novoCliente.cep ||
        null,

      bairro:
        novoCliente.bairro,

      cidade:
        novoCliente.cidade,

      estado:
        String(
          novoCliente.estado,
        )
          .trim()
          .toUpperCase(),

      inscricaoEstadual:
        novoCliente.inscricaoEstadual ||
        null,

      ativo:
        novoCliente.ativo !==
        false,
    },
  );

  await catalogCache.forcarAtualizacao();

  return {
    clienteId: novo.id,
    criadoAgora: true,
  };
}

module.exports = {
  resolverClienteId,
};

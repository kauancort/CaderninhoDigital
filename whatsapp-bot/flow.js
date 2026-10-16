const api = require("./apiClient");

const catalogCache = require("./catalogCache");

const { resolverClienteId } = require("./clienteResolver");

const { interpretarMensagem } = require("./aiService");



const POTES_POR_CAIXA = 6;



// ============================================================

// MEMÓRIA DAS CONVERSAS

// ============================================================



const conversas = new Map();

const estadosVenda = new Map();

const confirmacoes = new Map();

// Guarda a categoria escolhida no menu até a Gestora informar os detalhes.
const estadosRegistro = new Map();



function getConversa(chatId) {

  return conversas.get(chatId) || [];

}



function acrescentarConversa(chatId, linha) {

  const historico = conversas.get(chatId) || [];



  historico.push(String(linha));



  // Mantém somente as últimas 20 mensagens

  if (historico.length > 20) {

    historico.splice(0, historico.length - 20);

  }



  conversas.set(chatId, historico);

}



function limparConversa(chatId) {

  conversas.delete(chatId);

}



// ============================================================

// ESTADO DA VENDA

// ============================================================



function getEstadoVenda(chatId) {

  return estadosVenda.get(chatId) || null;

}



function salvarEstadoVenda(chatId, venda) {

  estadosVenda.set(chatId, venda);

}



function limparEstadoVenda(chatId) {

  estadosVenda.delete(chatId);

}



// ============================================================

// CONFIRMAÇÃO

// ============================================================



function getConfirmacao(chatId) {

  return confirmacoes.get(chatId) || null;

}



function salvarConfirmacao(chatId, resultado) {

  confirmacoes.set(chatId, resultado);

}



function limparConfirmacao(chatId) {

  confirmacoes.delete(chatId);

}

function getEstadoRegistro(chatId) { return estadosRegistro.get(chatId) || null; }
function salvarEstadoRegistro(chatId, estado) { estadosRegistro.set(chatId, estado); }
function limparEstadoRegistro(chatId) { estadosRegistro.delete(chatId); }

function normalizarNomeCatalogo(valor) {
  return normalizarTexto(valor).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function encontrarMateriaPrimaPorNome(nome, lista) {
  const alvo = normalizarNomeCatalogo(nome);
  if (!alvo) return null;
  const candidatas = (lista || []).filter((item) => item?.nome).sort((a, b) => String(b.nome).length - String(a.nome).length);
  return candidatas.find((item) => {
    const n = normalizarNomeCatalogo(item.nome);
    return n === alvo || n.includes(alvo) || alvo.includes(n);
  }) || null;
}
function extrairValorMonetarioDireto(texto) {
  const n = normalizarTexto(texto);
  let m = n.match(/r\$\s*(\d{1,7})(?:[,.](\d{1,2})|\s+e\s+(\d{1,2}))?/i);
  if (!m) m = n.match(/(?:custou|paguei|pagou|valor(?: total)?(?: foi)?|por)\s*(?:r\$\s*)?(\d{1,7})(?:[,.](\d{1,2})|\s+e\s+(\d{1,2}))?\s*(?:reais?)?/i);
  if (!m) m = n.match(/\b(\d{1,7})(?:[,.](\d{1,2})|\s+e\s+(\d{1,2}))\s*(?:reais?)?\b/i);
  if (!m) {
    m = n.match(/\b(\d{1,7})\s+reais?\b/i);
    if (m) return Number(m[1]);
  }
  if (!m) return null;
  return Number(m[1]) + ((m[2] ?? m[3]) ? Number(m[2] ?? m[3]) / 100 : 0);
}
function extrairQuantidadeMateriaPrima(texto) {
  const n = normalizarTexto(texto);
  const m = n.match(/\b(\d+(?:[,.]\d+)?)\s*(kg|quilo(?:s)?|g|gramas?|l|litros?|ml|unidades?|un)\b/i);
  if (!m) return null;
  let unidade = m[2].toLowerCase();
  if (unidade.startsWith("quilo") || unidade === "kg") unidade = "kg";
  else if (unidade === "g" || unidade.startsWith("grama")) unidade = "g";
  else if (unidade === "l" || unidade.startsWith("litro")) unidade = "L";
  else if (unidade === "ml") unidade = "ml";
  else unidade = "unidade";
  return { quantidade: Number(m[1].replace(",", ".")), unidade };
}

// Extrai o nome de uma matéria-prima mesmo quando a IA não reconhece
// o item ou devolve compras: []. Remove verbos, quantidade e preço.
function extrairNomeMateriaPrimaDaMensagem(texto, lista = []) {
  const original = normalizarTexto(texto);
  if (!original) return "";
  const conhecido = encontrarMateriaPrimaPorNome(original, lista);
  if (conhecido?.nome) return conhecido.nome;
  let nome = original;
  nome = nome.replace(/\br\$\s*\d+(?:[,.]\d{1,2})?(?:\s+e\s+\d{1,2})?\b/gi, " ");
  nome = nome.replace(/\b(?:por|custou|paguei|pagamos|valor(?: total)?(?: foi)?|total(?: de)?)\s*(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s+e\s+\d{1,2})?\s*(?:reais?)?\b/gi, " ");
  nome = nome.replace(/\b\d+(?:[,.]\d+)?\s*(?:kg|quilos?|g|gramas?|l|litros?|ml|unidades?|un)\b/gi, " ");
  nome = nome.replace(/\b(?:comprei|compramos|adquiri|adquirimos|compra|comprar|materia prima|matéria prima|por|e|o|a|um|uma)\b/gi, " ");
  nome = nome.replace(/\b\d+(?:[,.]\d+)?\b/g, " ");
  nome = nome.replace(/[^a-z0-9\s-]/gi, " ").replace(/\s+/g, " ").trim();
  if (nome.length < 2 || /^(reais?|kg|gramas?|litros?|unidades?)$/i.test(nome)) return "";
  return nome.replace(/\b\w/g, (letra) => letra.toUpperCase());
}
function formatarEstoque(lista, tipo) {
  if (!Array.isArray(lista) || lista.length === 0) return `Não encontrei ${tipo} cadastrados no sistema.`;
  return lista.map((item) => {
    const nome = item.nome || item.produtoNome || item.materiaPrimaNome || "Item sem nome";
    const qtd = item.estoqueAtual ?? item.quantidadeEstoque ?? item.saldoEstoque ?? item.quantidade ?? 0;
    const unidade = item.unidadeMedida || item.unidade || "unidades";
    return `• ${nome}: ${qtd} ${unidade}`;
  }).join("\n");
}




// ============================================================

// NORMALIZAÇÃO DE TEXTO

// ============================================================



function normalizarTexto(texto) {

  return String(texto || "")

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .trim()

    .toLowerCase();

}



function textoNormalizado(texto) {

  return normalizarTexto(texto)

    .replace(/[.!?,;:]/g, "")

    .replace(/\s+/g, " ")

    .trim();

}



// ============================================================

// CANCELAMENTO

// ============================================================



function ehCancelamento(texto) {

  const normalizado = textoNormalizado(texto);



  const cancelamentos = [

    "cancelar",

    "cancela",

    "cancelado",

    "cancelar venda",

    "cancela venda",

    "cancelar a venda",

    "cancela a venda",

    "nao quero",

    "não quero",

    "desistir",

    "desisto",

    "parar",

    "pare",

    "sair",

  ];



  return cancelamentos.includes(normalizado);

}



// ============================================================

// CONFIRMAÇÃO POSITIVA

// ============================================================



function ehConfirmacaoPositiva(texto) {

  const normalizado = textoNormalizado(texto);



  const positivos = [

    "sim",

    "s",

    "ss",

    "sim pode salvar",

    "pode salvar",

    "salvar",

    "confirma",

    "confirmo",

    "confirmado",

    "confirmar",

    "pode confirmar",

    "pode registrar",

    "pode lançar",

    "pode lancar",

    "lanca",

    "lança",

    "ok",

    "okay",

    "certo",

    "isso",

    "isso mesmo",

    "perfeito",

  ];



  return positivos.includes(normalizado);

}



// ============================================================

// CONFIRMAÇÃO NEGATIVA

// ============================================================



function ehConfirmacaoNegativa(texto) {

  const normalizado = textoNormalizado(texto);



  const negativos = [

    "nao",

    "não",

    "n",

    "errado",

    "esta errado",

    "está errado",

    "tem erro",

    "corrigir",

    "quero corrigir",

    "preciso corrigir",

    "alterar",

    "quero alterar",

    "mudar",

    "quero mudar",

  ];



  if (negativos.includes(normalizado)) return true;

  return /^(nao|não)\b/.test(normalizado);

}



// ============================================================

// TELEFONE

// ============================================================



function extrairTelefone(texto) {
  const textoString = String(texto || "");

  // Prioriza telefone explicitamente rotulado, inclusive quando CPF/CNPJ
  // também aparece na mesma mensagem.
  const rotulado = textoString.match(
    /(?:telefone|celular|whatsapp|fone)\s*[:=\-]?\s*(\+?55[\s().\-]*)?(\(?\d{2}\)?[\s().\-]*)?(?:9[\s().\-]*)?\d{4}[\s().\-]*\d{4}/i,
  );
  if (rotulado) {
    const numeroRotulado = rotulado[0]
      .replace(/^(?:telefone|celular|whatsapp|fone)\s*[:=\-]?\s*/i, "")
      .replace(/\D/g, "");
    const telefoneRotulado = numeroRotulado.startsWith("55") && numeroRotulado.length >= 12
      ? numeroRotulado.slice(2)
      : numeroRotulado;
    if (telefoneRotulado.length >= 10 && telefoneRotulado.length <= 11) {
      return telefoneRotulado;
    }
  }

  // Impede que um CPF/CNPJ sem rótulo seja interpretado como telefone.
  const textoSemDocumentos = textoString
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, " ")
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, " ")
    .replace(/\b\d{11}\b/g, (numero) => cpfValido(numero) ? " " : numero)
    .replace(/\b\d{14}\b/g, " ");

  const match = textoSemDocumentos.match(
    /(?:\+?55[\s-]*)?(?:\(?\d{2}\)?[\s-]*)?(?:9[\s-]*)?\d{4}[\s-]*\d{4}/,
  );
  if (!match) return null;

  let telefone = match[0].replace(/\D/g, "");
  if (telefone.startsWith("55") && telefone.length >= 12) {
    telefone = telefone.substring(2);
  }
  if (telefone.length < 10 || telefone.length > 11) return null;
  return telefone;
}


function cpfValido(digitos) {

  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;

  for (const t of [9, 10]) {

    let soma = 0;

    for (let i = 0; i < t; i++) soma += Number(digitos[i]) * (t + 1 - i);

    const dv = ((soma * 10) % 11) % 10;

    if (dv !== Number(digitos[t])) return false;

  }

  return true;

}



function extrairDadosCliente(texto) {

  const resultado = {};

  const original = String(texto || "");

  const normalizado = normalizarTexto(original);



  // ---------- Documento ----------

  const comRotulo = original.match(

    /\b(?:cpf|cnpj|documento)\b\D{0,10}([\d.\-/]{11,18})/i,

  );

  const cpfFormatado = original.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);

  const cnpjFormatado = original.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);

  const catorze = original.match(/\b\d{14}\b/);

  const onze = original.match(/\b\d{11}\b/);



  if (comRotulo) resultado.documento = comRotulo[1].replace(/\D/g, "");

  else if (cnpjFormatado) resultado.documento = cnpjFormatado[0].replace(/\D/g, "");

  else if (cpfFormatado) resultado.documento = cpfFormatado[0].replace(/\D/g, "");

  else if (catorze) resultado.documento = catorze[0];

  else if (onze && cpfValido(onze[0])) resultado.documento = onze[0];



  // ---------- Nome ----------

  const nome = original.match(

    /(?:nome(?:\s+completo)?|razao\s+social|razão\s+social)\s*[:=-]\s*(.+?)(?=\s*(?:telefone|cpf|cnpj|rua|endereço|endereco|numero|número|bairro|cidade|estado)\s*[:=-]|[,;\n]|$)/i,

  );

  if (nome) resultado.nome = nome[1].trim();



  // ---------- Telefone ----------

  const telefone = extrairTelefone(original);

  if (telefone && telefone !== resultado.documento) resultado.telefone = telefone;



  // ---------- Número do endereço ----------

  const numeroRotulo = original.match(

    /\b(?:n[º°]|n\.|numero|número)\s*[:.]?\s*(\d{1,6}[A-Za-z]?)\b/i,

  );

  const numeroAposRua = original.match(

    /\b(?:rua|avenida|av\.?|travessa|alameda|estrada|rodovia)\b[^,\d\n],?\s+(\d{1,6}[A-Za-z]?)\b/i,

  );

  if (numeroRotulo) resultado.numero = numeroRotulo[1];
  else if (numeroAposRua) resultado.numero = numeroAposRua[1];

  // Texto corrido: "Rua das Flores, número 1420" e "rua das Flores 1420".
  if (!resultado.numero) {
    const numeroLivre = original.match(/\b(?:n[º°.]?\s*|número\s+|numero\s+)(\d{1,6}[A-Za-z]?)\b/i);
    if (numeroLivre) resultado.numero = numeroLivre[1];
  }



  // ---------- CEP ----------

  const cep = original.match(/\b\d{5}-\d{3}\b/);

  if (cep) resultado.cep = cep[0].replace(/\D/g, "");



  // ---------- Estado ----------

  const estadosNomes = {

    "mato grosso do sul": "MS",

    "rio grande do norte": "RN",

    "rio grande do sul": "RS",

    "distrito federal": "DF",

    "espirito santo": "ES",

    "minas gerais": "MG",

    "mato grosso": "MT",

    "rio de janeiro": "RJ",

    "santa catarina": "SC",

    "sao paulo": "SP",

    acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA",

    ceara: "CE", goias: "GO", maranhao: "MA", paraiba: "PB", parana: "PR",

    pernambuco: "PE", piaui: "PI", rondonia: "RO", roraima: "RR", sergipe: "SE", tocantins: "TO",

  };

  let estadoEncontrado = null;

  const nomesOrdenados = Object.keys(estadosNomes).sort((a,b) => b.length-a.length);

  for (const nomeEstado of nomesOrdenados) {

    const re = new RegExp(`\\b${nomeEstado.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);

    if (re.test(normalizado)) { estadoEncontrado = estadosNomes[nomeEstado]; break; }

  }

  if (!estadoEncontrado && (/\bpará\b/i.test(original) || /\bestado\s+d[oe]\s+para\b/.test(normalizado))) {

    estadoEncontrado = "PA";

  }

  if (!estadoEncontrado) {

    const siglas = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO";

    const ufMaiuscula = original.match(new RegExp(`(?:^|[^A-Za-z0-9])(${siglas})(?=$|[^A-Za-z0-9])`));

    const ufRotulada = original.match(new RegExp(`(?:\\\b(?:uf|estado)\\\s*[:=-]?\\\s*|/\\\s*)(${siglas})\\\b`, "i"));

    const uf = ufMaiuscula?.[1] || ufRotulada?.[1];

    if (uf) estadoEncontrado = uf.toUpperCase();

  }

  if (estadoEncontrado) resultado.estado = estadoEncontrado;



  // ---------- Campos com rótulo ----------

  const cidade = original.match(/\bcidade\s*[:=-]\s*(.+?)(?=\s*(?:estado|uf|bairro|telefone|cpf|cnpj|rua|endereço|endereco|numero|número)\s*[:=-]|[,;\n]|$)/i);

  if (cidade) resultado.cidade = cidade[1].trim();

  const bairro = original.match(/\bbairro\s*[:=-]?\s*(.+?)(?=\s*(?:cidade|estado|uf|telefone|cpf|cnpj|rua|endereço|endereco|numero|número)\s*[:=-]|[,;\n]|$)/i);

  if (bairro) resultado.bairro = bairro[1].trim();

  const endereco = original.match(/\b(?:endereço|endereco|rua|avenida|av\\.)\s*[:=-]?\s*(.+?)(?=\s*(?:n[º°]|n\.|numero|número|bairro|cidade|estado|uf|telefone|cpf|cnpj)\s*[:=-]?|[,;\n\d]|$)/i);

  if (endereco && endereco[1].trim().length >= 3) resultado.endereco = endereco[1].trim();

  // ---------- Texto livre enviado em uma única mensagem ----------
  // Ex.: "Anne da Silva Roxa, telefone (...), CPF ..., mora na Rua ...,
  // bairro ..., na cidade de São Paulo - SP."
  if (!resultado.nome) {
    const nomeLivre = original.match(/^\s*(?:o cliente é|a cliente é|cliente:)?\s*([^,\n]+?)(?=\s*,?\s*(?:telefone|celular|whatsapp|cpf|cnpj|documento|mora|reside|endereço|endereco)\b|\s*$)/i);
    if (nomeLivre?.[1]) {
      const candidato = nomeLivre[1].trim().replace(/[.!;]+$/, "");
      if (candidato.length >= 3 && !/^\d+$/.test(candidato)) resultado.nome = candidato;
    }
  }

  if (!resultado.endereco) {
    const enderecoLivre = original.match(/\b(?:mora|reside|residindo)\s+(?:na|no|em)\s+((?:rua|avenida|av\.?|travessa|alameda|estrada|rodovia|praça|praca)\b[^,\n]*?)(?=\s*,?\s*(?:n[º°.]|número|numero|bairro|na cidade|cidade|estado|uf)\b|[,\n]|$)/i);
    if (enderecoLivre?.[1]) resultado.endereco = enderecoLivre[1].trim().replace(/[.!;]+$/, "");
  }

  if (!resultado.bairro) {
    const bairroLivre = original.match(/\bbairro\s+([^,\n]+?)(?=\s*,?\s*(?:na cidade|cidade|estado|uf)\b|[,\n]|$)/i);
    if (bairroLivre?.[1]) resultado.bairro = bairroLivre[1].trim().replace(/[.!;]+$/, "");
  }

  if (!resultado.cidade) {
    const cidadeLivre = original.match(/\b(?:na\s+)?cidade\s+(?:de\s+)?([^,\n]+?)(?=\s*(?:[-–—]\s*[A-Z]{2}\b|\s+(?:estado|uf)\b|[,\n]|$))/i);
    if (cidadeLivre?.[1]) resultado.cidade = cidadeLivre[1].trim().replace(/[.!;]+$/, "");
  }

  // O estado pode aparecer ao final como "São Paulo - SP".
  if (!resultado.estado) {
    const ufNoFinal = original.match(/(?:[-–—/]\s*|\b(?:estado|UF)\s*[:=-]?\s*)(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b\s*[.,;]*$/i);
    if (ufNoFinal?.[1]) resultado.estado = ufNoFinal[1].toUpperCase();
  }

  const email = original.match(/[A-Z0-9.\_%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

  if (email) resultado.email = email[0];

  return resultado;

}



// ============================================================

// IDENTIFICA CLIENTE JÁ CADASTRADO

// ============================================================



function extrairCompradorDireto(texto) {
  const original = String(texto || "").trim();
  if (!original) return null;
  const normalizado = normalizarTexto(original);
  // Perguntas e contestação sobre o cadastro não são nomes de clientes.
  if (/\b(esta|ta|ja|cadastrad[oa]|no sistema|nao encontrei|ela esta|ela ta|eu quis dizer|na verdade)\b/i.test(normalizado)) return null;
  const padroes = [
    /\bvendi\s+(?:uma\s+|um\s+)?para\s+(?:o\s+|a\s+)?(.+?)(?=\s*,\s*\d+\s*(?:potes?|caixas?)\b|\s+\d+\s*(?:potes?|caixas?)\b|\s+e\s+\d+\s*(?:potes?|caixas?)\b|$)/i,
    /\beu\s+vendi\s+para\s+(?:o\s+|a\s+)?(.+?)(?=\s*,|$)/i,
    /\bvenda\s+(?:para|de)\s+(?:o\s+|a\s+)?(.+?)(?=\s*,|\s+\d+\s*(?:potes?|caixas?)\b|$)/i,
    /\bcliente\s*[:=-]\s*([^,\n]+?)(?=\s*,|$)/i,
  ];
  for (const padrao of padroes) {
    const match = original.match(padrao);
    if (!match?.[1]) continue;
    const nome = match[1].replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "").replace(/^(?:o|a)\s+/i, "").trim();
    const n = normalizarTexto(nome);
    if (nome.length >= 3 && !/\b(esta|cadastrad[oa]|no sistema|nao)\b/i.test(n)) return nome;
  }
  return null;
}

function extrairClienteDaMensagem(texto, clientes) {

  const normalizado = normalizarTexto(texto);



  if (!Array.isArray(clientes) || clientes.length === 0) {

    return null;

  }



  // Primeiro tenta nome completo

  for (const cliente of clientes) {

    if (!cliente || !cliente.nome) {

      continue;

    }



    const nomeCliente = normalizarTexto(cliente.nome);



    if (

      normalizado === nomeCliente ||

      normalizado.includes(`cliente ${nomeCliente}`) ||

      normalizado.includes(`para ${nomeCliente}`) ||

      normalizado.includes(`de ${nomeCliente}`)

    ) {

      return cliente.nome;

    }

  }



  // Depois tenta correspondência parcial

  for (const cliente of clientes) {

    if (!cliente || !cliente.nome) {

      continue;

    }



    const nomeCliente = normalizarTexto(cliente.nome);



    if (

      nomeCliente.length >= 4 &&

      normalizado.includes(nomeCliente)

    ) {

      return cliente.nome;

    }

  }



  return null;

}



// ============================================================

// EXTRAÇÃO ROBUSTA DE CORREÇÕES DE VENDA

// ============================================================



function limparPrefixoCorrecao(texto) {

  return String(texto || "")

    .replace(/^\s*(nao|não)\s*[,.:;-]?\s*/i, "")

    .replace(/^\s*(por favor|porfavor)\s*[,.:;-]?\s*/i, "")

    .trim();

}



function extrairNomeClienteCorrecao(texto) {

  const semPrefixo = limparPrefixoCorrecao(texto);

  const padroes = [

    /(?:troque|troca|mude|mudar|altere|alterar|corrija|corrigir)\s+(?:o\s+)?cliente\s+(?:para|por)\s+(.+?)(?=\s+(?:e|,)\s*(?:o\s+)?(?:produto|quantidade|tamanho|pagamento)|$)/i,

    /(?:nome\s+(?:(?:do|da)\s+)?cliente)\s*(?:e|é|eh|:|=|-)?\s*(?:para\s+)?(.+?)(?=\s+(?:e|,)\s*(?:ele|ela|o|a)?\s*(?:comprou|compraram|foi|pagou|são|sao)|$)/i,

    /(?:cliente)\s*[:=-]\s*(.+?)(?=\s+(?:e|,)\s*(?:produto|quantidade|tamanho|pagamento)|$)/i,

  ];

  for (const padrao of padroes) {

    const match = semPrefixo.match(padrao);

    if (match?.[1]) {

      const nome = match[1].replace(/[.!?,;]+$/, "").trim();

      if (nome.length >= 3) return nome;

    }

  }

  return null;

}



function extrairProdutoDireto(texto, produtos) {
  if (!Array.isArray(produtos)) return null;

  const n = normalizarTexto(texto);
  const candidatos = produtos
    .filter((p) => p?.nome)
    .sort((a, b) => String(b.nome).length - String(a.nome).length);

  // Em correções como "Biriba, não Paçoca" ou "Biriba e não Paçoca",
  // o produto após "não" é o produto incorreto; não o selecione.
  const trechoNegado = n.match(/\bnao\s+(.+?)(?:[,.!?;:]|$)/i)?.[1] || "";
  const nomesNegados = candidatos
    .filter((p) => trechoNegado.includes(normalizarTexto(p.nome)))
    .map((p) => normalizarTexto(p.nome));

  const candidatosValidos = candidatos.filter((p) => {
    const nome = normalizarTexto(p.nome);
    return !nomesNegados.includes(nome);
  });

  // Se a mensagem explicita "X, não Y", prioriza o nome X antes da negação.
  const antesDaNegacao = n.split(/\bnao\b/i)[0];
  for (const produto of candidatosValidos) {
    const nome = normalizarTexto(produto.nome);
    if (nome.length >= 3 && antesDaNegacao.includes(nome)) {
      return { id: produto.id, nome: produto.nome };
    }
  }

  for (const produto of candidatosValidos) {
    const nome = normalizarTexto(produto.nome);
    if (nome.length >= 3 && n.includes(nome)) {
      return { id: produto.id, nome: produto.nome };
    }
  }

  return null;
}



function extrairQuantidadeDireta(texto) {

  const n = normalizarTexto(texto);

  const match = n.match(/\b(\d+)\s*(potes?|caixas?)\b/i);

  if (!match) return null;

  const quantidade = Number(match[1]);

  if (!Number.isFinite(quantidade) || quantidade <= 0) return null;

  return { quantidade, tipo: match[2].startsWith("caixa") ? "caixa" : "pote" };

}



function extrairTamanhoDireto(texto) {
  const n = normalizarTexto(texto);
  if (/\b(?:tamanho|pote|com)?\s*(?:de|do|das)?\s*quarenta e quatro(?:\s+unidades?)?\b/i.test(n)) return 44;
  if (/\b(?:tamanho|pote|com)?\s*(?:de|do|das)?\s*vinte(?:\s+unidades?)?\b/i.test(n)) return 20;
  const match = n.match(/\b(?:tamanho|pote|com)\s*(?:de|do|das)?\s*(20|44)\b/i) || n.match(/\b(20|44)\s*(?:unidades?|unid|un)?\b/i);
  return match ? Number(match[1]) : null;
}

function extrairPagamentoDireto(texto) {

  const n = normalizarTexto(texto);

  if (/\bpix\b/.test(n)) return { forma: "PIX", tipoCartao: null, parcelas: null };

  if (/\bdinheiro\b/.test(n)) return { forma: "DINHEIRO", tipoCartao: null, parcelas: null };

  if (/\bcartao\b/.test(n)) {

    const parcelas = n.match(/\b(\d+)\s*(?:vezes?|x|parcelas?)\b/);

    return {

      forma: "CARTAO",

      tipoCartao: /\bcredito\b/.test(n) ? "CREDITO" : /\bdebito\b/.test(n) ? "DEBITO" : null,

      parcelas: parcelas ? Number(parcelas[1]) : null,

    };

  }

  return null;

}



function aplicarCorrecoesDiretas(venda, texto, produtos, clientes) {
  if (!venda) return venda;
  const textoLimpo = limparPrefixoCorrecao(texto);
  const nomeCliente = extrairNomeClienteCorrecao(textoLimpo);

  // Só altera o cliente se a gestora indicar explicitamente que está corrigindo o cliente.
  if (nomeCliente) {
    const clienteEncontrado = encontrarClientePorNome(nomeCliente, clientes || []);
    const nomeFinal = clienteEncontrado?.nome || nomeCliente;
    venda.comprador = nomeFinal;
    if (venda.novo_cliente) venda.novo_cliente.nome = nomeFinal;
  }

  const produto = extrairProdutoDireto(textoLimpo, produtos);
  const quantidade = extrairQuantidadeDireta(textoLimpo);
  const tamanho = extrairTamanhoDireto(textoLimpo);
  const pagamento = extrairPagamentoDireto(textoLimpo);

  if (produto || quantidade || tamanho) {
    if (!Array.isArray(venda.itens)) venda.itens = [];
    let indices = [];

    if (produto) {
      const nomeProduto = normalizarTexto(produto.nome);
      indices = venda.itens.map((item, i) => ({ item, i }))
        .filter(({ item }) => normalizarTexto(item.produto_nome || item.nome || item.produto || "") === nomeProduto)
        .map(({ i }) => i);

      if (!indices.length && venda.itens.length === 1) {
        // Uma correção de produto em uma venda de um único item substitui
        // esse item, em vez de acrescentar um segundo produto à venda.
        indices = [0];
      } else if (!indices.length) {
        // Em vendas com vários itens, não adivinhe qual item deve ser trocado.
        // Só cria novo item se a mensagem não for uma correção explícita.
        const n = normalizarTexto(textoLimpo);
        const eCorrecaoProduto = /\b(nao|era|em vez de|no lugar de|troca|troque|corrige|corrigir|corrija)\b/.test(n);
        if (!eCorrecaoProduto) {
          venda.itens.push({ produto_final_id: produto.id, produtoId: produto.id, produto_nome: produto.nome, produto: produto.nome });
          indices = [venda.itens.length - 1];
        } else {
          // Quando a correção é explícita e não há correspondência exata,
          // atualiza o item atualmente em foco somente se houver um único item.
          return venda;
        }
      }
    } else if (venda.itens.length === 1) {
      // Respostas curtas como "2 potes tamanho 20" completam o item único.
      indices = [0];
    }

    for (const indice of indices) {
      const item = venda.itens[indice];
      if (produto) {
        item.produto_final_id = produto.id;
        item.produtoId = produto.id;
        item.produto_nome = produto.nome;
        item.produto = produto.nome;
      }
      if (quantidade) {
        item.quantidade = quantidade.quantidade;
        item.tipo = quantidade.tipo;
      }
      if (tamanho) {
        item.tamanho = tamanho;
        item.tamanho_pote = tamanho;
        item.tipo_pote = tamanho;
      }
      const precoCalculado = calcularPrecoItem(item);
      if (precoCalculado !== null) item.preco_unitario = precoCalculado;
    }
  }
  if (pagamento) {
    venda.forma_pagamento = pagamento.forma;
    if (pagamento.tipoCartao) venda.tipo_cartao = pagamento.tipoCartao;
    if (pagamento.parcelas !== null) venda.parcelas = pagamento.parcelas;
  }
  return venda;
}
function mesclarObjetos(base, novo) {

  const resultado = {

    ...(base || {}),

  };



  for (const [chave, valor] of Object.entries(novo || {})) {

    if (

      valor !== undefined &&

      valor !== null &&

      String(valor).trim() !== ""

    ) {

      resultado[chave] = valor;

    }

  }



  return resultado;

}



// ============================================================

// MERGE DE VENDA

// ============================================================



function mesclarVenda(vendaAntiga, vendaNova) {

  const resultado = {

    tipo: "venda",

    comprador: null,

    novo_cliente: null,

    forma_pagamento: null,

    tipo_cartao: null,

    parcelas: null,

    itens: [],

  };



  if (vendaAntiga) {

    Object.assign(resultado, vendaAntiga);

  }



  if (vendaNova) {

    for (const [chave, valor] of Object.entries(vendaNova)) {

      if (

        chave === "itens" &&

        Array.isArray(valor)

      ) {

        if (valor.length > 0) {

          resultado.itens = valor;

        }



        continue;

      }



      if (

        chave === "novo_cliente" &&

        valor &&

        typeof valor === "object"

      ) {

        resultado.novo_cliente = mesclarObjetos(

          resultado.novo_cliente,

          valor,

        );



        continue;

      }



      if (

        valor !== undefined &&

        valor !== null &&

        String(valor).trim() !== ""

      ) {

        resultado[chave] = valor;

      }

    }

  }



  return resultado;

}



// ============================================================

// NORMALIZA NOVO CLIENTE

// ============================================================



function normalizarEstadoNovoCliente(venda) {

  if (!venda) {

    return;

  }



  if (!venda.novo_cliente) {

    return;

  }



  const cliente = venda.novo_cliente;



  if (cliente.estado) {

    cliente.estado = String(cliente.estado)

      .trim()

      .toUpperCase();

  }



  if (cliente.documento) {
    cliente.documento = String(cliente.documento).replace(/\D/g, "");
  }

  if (cliente.telefone) {
    let telefone = String(cliente.telefone).replace(/\D/g, "");

    if (telefone.startsWith("55") && telefone.length >= 12) {
      telefone = telefone.substring(2);
    }

    const documento = String(cliente.documento || "").replace(/\D/g, "");

    // Limpa telefone igual ao documento ou formado pelo início dele.
    if (
      documento &&
      (telefone === documento ||
        ((documento.length === 11 || documento.length === 14) &&
          telefone.length >= 10 &&
          documento.startsWith(telefone)))
    ) {
      cliente.telefone = null;
    } else {
      cliente.telefone = telefone;
    }
  }

  if (cliente.numero !== undefined) {

    cliente.numero = String(cliente.numero);

  }

}



// ============================================================

// PREPARA ITENS DA VENDA

// ============================================================



function prepararItensVenda(venda) {

  if (!venda) {

    return;

  }



  if (!Array.isArray(venda.itens)) {

    venda.itens = [];

    return;

  }



  venda.itens = venda.itens.map((item) => {

    const novoItem = {

      ...item,

    };



    // Aceita nomes diferentes usados pela IA

    if (

      !novoItem.produto_final_id &&

      novoItem.produtoId

    ) {

      novoItem.produto_final_id =

        novoItem.produtoId;

    }



    if (

      !novoItem.produto_final_id &&

      novoItem.produto_id

    ) {

      novoItem.produto_final_id =

        novoItem.produto_id;

    }



    if (

      novoItem.quantidade === undefined &&

      novoItem.quantidade_potes !== undefined

    ) {

      novoItem.quantidade =

        novoItem.quantidade_potes;

    }



    if (

      novoItem.quantidade === undefined &&

      novoItem.quantidade_caixas !== undefined

    ) {

      novoItem.quantidade =

        novoItem.quantidade_caixas;

      novoItem.tipo = "caixa";

    }



    if (

      novoItem.preco_unitario === undefined &&

      novoItem.valorUnitario !== undefined

    ) {

      novoItem.preco_unitario =

        novoItem.valorUnitario;

    }



    if (

      novoItem.preco_unitario === undefined &&

      novoItem.preco !== undefined

    ) {

      novoItem.preco_unitario =

        novoItem.preco;

    }



    if (

      novoItem.quantidade !== undefined

    ) {

      novoItem.quantidade = Number(

        novoItem.quantidade,

      );

    }



    if (

      novoItem.preco_unitario !== undefined &&

      novoItem.preco_unitario !== null

    ) {

      novoItem.preco_unitario = Number(

        novoItem.preco_unitario,

      );

    }



    // Normaliza tamanho do pote

    if (novoItem.tamanho) {

      const tamanhoTexto = String(

        novoItem.tamanho,

      ).toLowerCase();



      if (

        tamanhoTexto.includes("20")

      ) {

        novoItem.tamanho = 20;

      }



      if (

        tamanhoTexto.includes("44")

      ) {

        novoItem.tamanho = 44;

      }

    }



    return novoItem;

  });

}



// ============================================================

// CAMPOS FALTANTES DA VENDA

// ============================================================



function identificarFaltantesVenda(venda) {

  const faltantes = [];



  if (!venda) {

    return [

      "cliente",

      "produto",

      "quantidade",

      "tamanho",

      "pagamento",

    ];

  }



  if (

    !venda.comprador &&

    !venda.novo_cliente

  ) {

    faltantes.push("cliente");

  }



  if (venda.novo_cliente) {

    const cliente = venda.novo_cliente;



    const dadosClienteFaltantes = [];



    if (!cliente.nome) {

      dadosClienteFaltantes.push("nome");

    }



    if (!cliente.documento) {

      dadosClienteFaltantes.push("cpf_cnpj");

    }



    if (!cliente.telefone) {

      dadosClienteFaltantes.push("telefone");

    }



    if (!cliente.estado) {

      dadosClienteFaltantes.push("estado");

    }



    if (!cliente.cidade) {

      dadosClienteFaltantes.push("cidade");

    }



    if (!cliente.bairro) {

      dadosClienteFaltantes.push("bairro");

    }



    if (!cliente.endereco) {

      dadosClienteFaltantes.push("endereco");

    }



    if (!cliente.numero) {

      dadosClienteFaltantes.push("numero");

    }



    for (const campo of dadosClienteFaltantes) {

      faltantes.push(campo);

    }

  }



  if (

    !Array.isArray(venda.itens) ||

    venda.itens.length === 0

  ) {

    faltantes.push("produto");

    faltantes.push("quantidade");

    faltantes.push("tamanho");

  } else {
    for (const item of venda.itens) {
      if (!item.produto_final_id && !item.produtoId) faltantes.push("produto");
      if (!item.quantidade || Number(item.quantidade) <= 0) faltantes.push("quantidade");
      if (!item.tamanho && !item.tamanho_pote && !item.tipo_pote) faltantes.push("tamanho");
    }
  }



  if (!venda.forma_pagamento) {

    faltantes.push("pagamento");

  }



  const pagamento = normalizarTexto(

    venda.forma_pagamento,

  );



  if (

    pagamento.includes("cartao") ||

    pagamento.includes("cartão")

  ) {

    if (!venda.tipo_cartao) {

      faltantes.push("tipo_cartao");

    }



    if (

      venda.parcelas === undefined ||

      venda.parcelas === null ||

      venda.parcelas === ""

    ) {

      faltantes.push("parcelas");

    }

  }



  return [...new Set(faltantes)];

}



// ============================================================

// CHECKLIST INICIAL

// ============================================================



function montarChecklistInicialVenda() {

  return (

    "Vamos registrar a venda.\n\n" +

    "Me envie estas informações:\n\n" +

    "Cliente:\n" +

    "Produto:\n" +

    "Quantidade (potes ou caixas):\n" +

    "Tamanho do pote (20 ou 44):\n" +

    "Forma de pagamento (Pix, dinheiro, cartão):\n" +

    "Se for cartão, informe crédito ou débito e o número de parcelas."

  );

}



// ============================================================

// CHECKLIST PARA CADASTRO DE NOVO CLIENTE

// ============================================================



function montarChecklistNovoCliente(cliente = {}) {
  const dados = typeof cliente === "string" ? { nome: cliente } : (cliente || {});
  const campo = (valor) => valor === undefined || valor === null ? "" : String(valor);
  return `Não encontrei esse cliente cadastrado no sistema. Para prosseguirmos com a venda, confira os dados e complete apenas o que estiver faltando:

Nome completo ou razão social: ${campo(dados.nome)}
Telefone: ${campo(dados.telefone)}
CPF ou CNPJ: ${campo(dados.documento || dados.cpf_cnpj)}
Rua ou logradouro: ${campo(dados.endereco)}
Número: ${campo(dados.numero)}
Bairro: ${campo(dados.bairro)}
Cidade: ${campo(dados.cidade)}
Estado (UF): ${campo(dados.estado)}`;
}

function montarChecklistFaltantes(

  faltantes,

  introducao = "Ainda faltam algumas informações:",

) {

  const nomes = {

    cliente: "Cliente",

    produto: "Produto",

    quantidade: "Quantidade (potes ou caixas)",

    tamanho: "Tamanho do pote (20 ou 44)",

    pagamento: "Forma de pagamento",

    tipo_cartao: "Tipo do cartão (crédito ou débito)",

    parcelas: "Quantidade de parcelas",

    nome: "Nome completo ou razão social",

    cpf_cnpj: "CPF ou CNPJ do cliente",

    telefone: "Telefone do cliente",

    estado: "Estado do cliente",

    cidade: "Cidade do cliente",

    bairro: "Bairro do cliente",

    endereco: "Endereço do cliente",

    numero: "Número do endereço",

  };



  const linhas = faltantes

    .map((campo) => `• ${nomes[campo] || campo}`)

    .join("\n");



  return `${introducao}\n\n${linhas}`;

}



// ============================================================

// PERGUNTA PARA UM ÚNICO CAMPO

// ============================================================



function perguntaParaFaltante(faltantes) {

  if (!faltantes || faltantes.length === 0) {

    return null;

  }



  const campo = faltantes[0];



  const perguntas = {

    cliente:

      "Qual é o cliente dessa venda?",



    produto:

      "Qual produto foi vendido?",



    quantidade:

      "Qual foi a quantidade? Pode informar em potes ou caixas.",



    tamanho:

      "Qual o tamanho do pote: 20 ou 44?",



    pagamento:

      "Qual foi a forma de pagamento? Pix, dinheiro ou cartão?",



    tipo_cartao:

      "O cartão foi crédito ou débito?",



    parcelas:

      "Em quantas parcelas foi a venda?",



    cpf_cnpj:

      "Informe o CPF ou CNPJ do novo cliente.",



    telefone:

      "Informe o telefone do novo cliente com DDD.",



    estado:

      "Qual é o estado do novo cliente?",



    cidade:

      "Qual é a cidade do novo cliente?",



    bairro:

      "Qual é o bairro do novo cliente?",



    endereco:

      "Qual é o endereço do novo cliente?",



    numero:

      "Qual é o número do endereço do novo cliente?",

  };



  return (

    perguntas[campo] ||

    `Informe: ${campo}.`

  );

}



// ============================================================

// VALIDAÇÃO FINAL DA VENDA

// ============================================================



function validarVendaParaConfirmacao(venda) {

  if (!venda) {

    return "Os dados da venda não foram encontrados.";

  }



  if (

    !venda.comprador &&

    !venda.novo_cliente

  ) {

    return "Informe o cliente da venda.";

  }



  if (

    venda.novo_cliente &&

    !venda.comprador

  ) {

    const cliente = venda.novo_cliente;



    const camposObrigatorios = [

      ["nome", "nome completo ou razão social"],

      ["documento", "CPF ou CNPJ"],

      ["telefone", "telefone"],

      ["estado", "estado"],

      ["cidade", "cidade"],

      ["bairro", "bairro"],

      ["endereco", "endereço"],

      ["numero", "número do endereço"],

    ];



    for (const [campo, nome] of camposObrigatorios) {

      if (!cliente[campo]) {

        return `Informe o ${nome} do novo cliente.`;

      }

    }

  }



  if (

    !Array.isArray(venda.itens) ||

    venda.itens.length === 0

  ) {

    return "Informe pelo menos um produto na venda.";

  }



  for (const item of venda.itens) {

    if (!item.produto_final_id) {

      return "Não consegui identificar o produto vendido.";

    }



    if (

      !item.quantidade ||

      Number(item.quantidade) <= 0

    ) {

      return "Informe uma quantidade válida.";

    }



    const tamanho =

      item.tamanho ||

      item.tamanho_pote ||

      item.tipo_pote;



    if (

      Number(tamanho) !== 20 &&

      Number(tamanho) !== 44

    ) {

      return "O tamanho do pote precisa ser 20 ou 44.";

    }



    // Preço pode vir da IA ou ser calculado abaixo

    if (

      item.preco_unitario === undefined ||

      item.preco_unitario === null ||

      Number.isNaN(Number(item.preco_unitario))

    ) {

      item.preco_unitario =

        calcularPrecoItem(item);

    }



    if (

      item.preco_unitario === undefined ||

      item.preco_unitario === null

    ) {

      return "Não consegui identificar o preço do produto.";

    }

  }



  if (!venda.forma_pagamento) {

    return "Informe a forma de pagamento.";

  }



  const pagamento = normalizarTexto(

    venda.forma_pagamento,

  );



  if (

    pagamento.includes("cartao")

  ) {

    if (!venda.tipo_cartao) {

      return "Informe se o cartão é crédito ou débito.";

    }



    if (

      venda.parcelas === undefined ||

      venda.parcelas === null ||

      venda.parcelas === ""

    ) {

      return "Informe a quantidade de parcelas.";

    }

  }



  return null;

}



// ============================================================

// PREÇOS DOS PRODUTOS

// ============================================================



function calcularPrecoItem(item) {

  const nome = normalizarTexto(

    item.produto_nome ||

      item.nome ||

      item.produto ||

      "",

  );



  const tamanho = Number(

    item.tamanho ||

      item.tamanho_pote ||

      item.tipo_pote,

  );



  if (nome.includes("fondant")) {

    if (tamanho === 20) return 20.70;

    if (tamanho === 44) return 21.30;

  }



  if (nome.includes("biriba")) {

    return 19.70;

  }



  if (nome.includes("pacoca") || nome.includes("paçoca")) {

    return 18.70;

  }



  return null;

}



// ============================================================

// CONFIRMAÇÃO DA VENDA

// ============================================================



function montarConfirmacaoVenda(venda) {
  let texto = "Confira os dados da venda:\n\n";
  texto += `Cliente: ${venda.comprador || venda.novo_cliente?.nome || "Novo cliente"}\n`;
  if (venda.novo_cliente) {
    texto += "Cliente novo: sim\n";
    if (venda.novo_cliente.documento) texto += `CPF/CNPJ: ${venda.novo_cliente.documento}\n`;
  }
  let totalVenda = 0;
  if (Array.isArray(venda.itens)) {
    texto += "\nProdutos:\n";
    for (const item of venda.itens) {
      const quantidade = Number(item.quantidade || 0);
      const ehCaixa = item.tipo === "caixa";
      const tipo = ehCaixa ? `caixa(s) = ${quantidade * POTES_POR_CAIXA} potes` : `${quantidade} pote(s)`;
      const tamanho = item.tamanho || item.tamanho_pote || item.tipo_pote || "?";
      const precoInformado = Number(item.preco_unitario);
      const preco = Number.isFinite(precoInformado) && precoInformado > 0 ? precoInformado : Number(calcularPrecoItem(item) || 0);
      const quantidadeCobrada = ehCaixa ? quantidade * POTES_POR_CAIXA : quantidade;
      const subtotal = quantidadeCobrada * preco;
      totalVenda += subtotal;
      texto += `• ${item.produto_nome || item.nome || item.produto || "Produto"}\n`;
      texto += `  Quantidade: ${tipo}\n`;
      texto += `  Tamanho: ${tamanho}\n`;
      texto += `  Valor unitário: R$ ${preco.toFixed(2).replace(".", ",")}\n`;
      texto += `  Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}\n`;
    }
  }
  texto += `\nTOTAL DA VENDA: R$ ${totalVenda.toFixed(2).replace(".", ",")}\n`;
  texto += `\nPagamento: ${venda.forma_pagamento || "-"}`;
  if (venda.tipo_cartao) texto += ` (${venda.tipo_cartao})`;
  if (venda.parcelas) texto += ` em ${venda.parcelas}x`;
  texto += "\n\nDeseja confirmar e registrar essa venda? Responda SIM ou NÃO.";
  return texto;
}
async function concluirLancamento(resultado) {

  if (!resultado) {

    throw new Error("Resultado do lançamento não informado.");

  }



  switch (resultado.tipo) {

    case "venda":

      return await criarVenda(resultado.venda);



    case "compra":

      return await criarCompra(

        resultado.compra ||

          resultado.compras,

      );



    case "producao":
      if (Array.isArray(resultado.producoes) && resultado.producoes.length > 1) {
        const producoesRegistradas = [];
        for (const producao of resultado.producoes) {
          try {
            await criarProducao(producao);
            producoesRegistradas.push(producao);
          } catch (erro) {
            erro.producoesRegistradas = producoesRegistradas;
            erro.producaoFalha = producao;
            throw erro;
          }
        }
        return "Produções registradas com sucesso!";
      }
      return await criarProducao(resultado.producao || resultado.producoes?.[0]);



    case "gasto":

    case "despesa":

      return await criarGasto(

        resultado.gasto ||

          resultado.despesa,

      );



    default:

      throw new Error(

        `Tipo de lançamento não suportado: ${resultado.tipo}`,

      );

  }

}



// ============================================================

// CRIAR VENDA

// ============================================================



async function criarVenda(venda) {

  if (!venda) {

    throw new Error("Dados da venda não informados.");

  }



  prepararItensVenda(venda);



  const erro = validarVendaParaConfirmacao(venda);



  if (erro) {

    throw new Error(erro);

  }



  let clienteId = null;

  let criadoAgora = false;



  if (venda.novo_cliente) {

    if (!venda.novo_cliente.nome) {

      venda.novo_cliente.nome = venda.comprador || null;

    }



    if (!venda.novo_cliente.nome) {

      throw new Error(

        "O nome completo ou razão social do novo cliente não foi informado.",

      );

    }



    const resultadoCliente =

      await resolverClienteId(

        venda.novo_cliente.nome,

        venda.novo_cliente,

      );



    clienteId =

      resultadoCliente.clienteId;



    criadoAgora =

      resultadoCliente.criadoAgora;

  } else if (venda.comprador) {

    const resultadoCliente =

      await resolverClienteId(

        venda.comprador,

        null,

      );



    clienteId =

      resultadoCliente.clienteId;



    criadoAgora =

      resultadoCliente.criadoAgora;

  }



  const itens = venda.itens.map((item) => {

    let quantidade =

      Number(item.quantidade);



    if (item.tipo === "caixa") {

      quantidade =

        quantidade * POTES_POR_CAIXA;

    }



    const valorUnitario =

      Number(item.preco_unitario);



    return {

      produtoId:

        item.produto_final_id,

      quantidade,

      valorUnitario,

    };

  });



  const formaPagamento =

    String(

      venda.forma_pagamento || "pix",

    ).toUpperCase();



  const dadosVenda = {

    clienteId,

    dataVenda: hojeISO(),

    formaPagamento,

    statusPagamento: "PAGO",

    observacao:

      "Lançado pelo WhatsApp",

    itens,

  };



  // Informações extras somente se existirem

  if (venda.tipo_cartao) {

    dadosVenda.tipoCartao =

      String(venda.tipo_cartao).toUpperCase();

  }



  if (

    venda.parcelas !== undefined &&

    venda.parcelas !== null

  ) {

    dadosVenda.parcelas =

      Number(venda.parcelas);

  }



  console.log(

    "[FLOW] Enviando venda para API:",

    JSON.stringify(

      dadosVenda,

      null,

      2,

    ),

  );



  const criada =

    await api.post(

      "/vendas",

      dadosVenda,

    );



  console.log(

    "[FLOW] Venda criada:",

    JSON.stringify(

      criada,

      null,

      2,

    ),

  );



  let resposta =

    "Venda registrada com sucesso!";



  if (criadoAgora) {

    resposta +=

      "\n\nO novo cliente também foi cadastrado.";

  }



  if (criada?.id) {

    resposta += `\nNúmero da venda: ${criada.id}`;

  }



  return resposta;

}



// ============================================================

// CRIAR COMPRA

// ============================================================



async function criarCompra(compra) {

  if (!compra) {

    throw new Error(

      "Dados da compra não informados.",

    );

  }



  /*

   * Mantemos compatibilidade com diferentes formatos

   * que a IA pode retornar.

   */



  const fornecedorId =

    compra.fornecedorId ||

    compra.fornecedor_id ||

    null;



  const itensOriginais =

    compra.itens ||

    compra.materias_primas ||

    [];



  if (

    !Array.isArray(itensOriginais) ||

    itensOriginais.length === 0

  ) {

    throw new Error(

      "Informe pelo menos uma matéria-prima na compra.",

    );

  }



  const itens = itensOriginais.map(

    (item) => ({

      materiaPrimaId:

        item.materiaPrimaId ||

        item.materia_prima_id ||

        item.id,

      quantidade: Number(

        item.quantidade || 0,

      ),

      valorUnitario: Number(

        item.valorUnitario ||

          item.valor_unitario ||

          item.preco_unitario ||

          0,

      ),

    }),

  );



  const dados = {

    fornecedorId,

    dataCompra:

      compra.dataCompra ||

      compra.data_compra ||

      hojeISO(),

    observacao:

      compra.observacao ||

      "Lançado pelo WhatsApp",

    itens,

  };



  console.log(

    "[FLOW] Enviando compra para API:",

    JSON.stringify(

      dados,

      null,

      2,

    ),

  );



  await api.post(

    "/compras-materias-primas",

    dados,

  );



  return "Compra registrada com sucesso!";

}



// ============================================================

// CRIAR PRODUÇÃO

// ============================================================



async function criarProducao(producao) {

  if (!producao) {

    throw new Error(

      "Dados da produção não informados.",

    );

  }



  const dados = {

    produtoId:

      producao.produtoId ||

      producao.produto_id ||

      producao.produto_final_id,



    quantidadeProduzida: Number(

      producao.quantidade || producao.quantidadeProduzida || producao.potes || 0,

    ),



    dataProducao:

      producao.dataProducao ||

      producao.data_producao ||

      hojeISO(),

    tamanhoPote: Number(
      producao.tamanhoPote || producao.tamanho_pote || producao.tamanho || 0,
    ),

    observacao:

      producao.observacao ||

      "Lançado pelo WhatsApp",

  };



  if (!dados.produtoId) {

    throw new Error(

      "Informe o produto da produção.",

    );

  }



  if (dados.tamanhoPote !== 20 && dados.tamanhoPote !== 44) {
    throw new Error(
      "Informe o tamanho do pote: 20 ou 44 unidades.",
    );
  }

  if (

    !dados.quantidadeProduzida ||

    dados.quantidadeProduzida <= 0

  ) {

    throw new Error(

      "Informe uma quantidade válida para a produção.",

    );

  }


  console.log(

    "[FLOW] Enviando produção para API:",

    JSON.stringify(

      dados,

      null,

      2,

    ),

  );



  await api.post(

    "/producoes",

    dados,

  );



  return "Produção registrada com sucesso!";

}



// ============================================================

// CRIAR GASTO

// ============================================================



async function criarGasto(gasto) {
  if (!gasto) {
    throw new Error("Dados do gasto não informados.");
  }

  const descricao = String(
    gasto.descricao ||
      gasto.nome ||
      gasto.titulo ||
      gasto.categoria ||
      "Gasto",
  ).trim();

  const valorTotal = Number(
    gasto.valor ??
      gasto.valorTotal ??
      gasto.valor_total ??
      0,
  );

  const dados = {
    tipo: "GASTO_GERAL",
    titulo: String(gasto.titulo || descricao).trim(),
    descricao,
    valorTotal,
    dataLancamento:
      gasto.dataLancamento ||
      gasto.data_lancamento ||
      gasto.data ||
      hojeISO(),
  };

  if (!dados.titulo || !dados.valorTotal || dados.valorTotal <= 0) {
    throw new Error("Informe a descrição e um valor válido para o gasto.");
  }

  console.log(
    "[FLOW] Enviando gasto para API:",
    JSON.stringify(dados, null, 2),
  );

  await api.post("/lancamentos", dados);

  return "Gasto registrado com sucesso!";
}


// ============================================================

// DATA

// ============================================================



function hojeISO() {

  const agora = new Date();



  const ano =

    agora.getFullYear();



  const mes =

    String(

      agora.getMonth() + 1,

    ).padStart(2, "0");



  const dia =

    String(

      agora.getDate(),

    ).padStart(2, "0");



  return `${ano}-${mes}-${dia}`;

}



// ============================================================

// CLIENTE: CONSULTA E CONTROLE DE DADOS

// ============================================================



function encontrarClientePorNome(nome, clientes) {
  if (!nome || !Array.isArray(clientes)) return null;
  const normalizar = (valor) => normalizarTexto(valor).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const alvo = normalizar(nome);
  if (alvo.length < 3) return null;
  const validos = clientes.filter((c) => c?.nome);
  const exatos = validos.filter((c) => normalizar(c.nome) === alvo);
  if (exatos.length === 1) return exatos[0];
  if (exatos.length > 1) return null;
  const contidos = validos.filter((c) => {
    const n = normalizar(c.nome);
    return n.length >= 5 && (alvo.includes(n) || n.includes(alvo));
  });
  return contidos.length === 1 ? contidos[0] : null;
}

function ehConsultaCadastroCliente(texto) {

  const n = normalizarTexto(texto);



  return (

    (

      n.includes("cadastrada") ||

      n.includes("cadastrado") ||

      n.includes("cadastro")

    ) &&

    (

      n.includes("cliente") ||

      n.includes("essa cliente") ||

      n.includes("esse cliente")

    )

  );

}



function limparDadosClienteNaoConfirmados(dadosIA, dadosDiretos) {

  const resultado = {};



  if (!dadosIA || typeof dadosIA !== "object") {

    return resultado;

  }



  const camposConfiaveis = [

    "documento",

    "telefone",

    "numero",

    "cep",

    "estado",

    "cidade",

    "bairro",

    "endereco",

    "email",

  ];



  for (const campo of camposConfiaveis) {

    if (

      dadosDiretos?.[campo] !== undefined &&

      dadosDiretos?.[campo] !== null &&

      String(dadosDiretos[campo]).trim() !== ""

    ) {

      resultado[campo] = dadosDiretos[campo];

    }

  }



  return resultado;

}



function prepararNovoClienteDaVenda(venda, clientes) {

  if (!venda?.comprador) return;



  const clienteEncontrado = encontrarClientePorNome(

    venda.comprador,

    clientes,

  );



  if (clienteEncontrado) {

    venda.comprador = clienteEncontrado.nome;

    venda.novo_cliente = null;

    return;

  }



  if (!venda.novo_cliente) {

    venda.novo_cliente = {};

  }



  // O nome vem do comprador informado na venda.

  venda.novo_cliente.nome = venda.comprador;

}



function obterNomeClienteParaConsulta(texto, clientes) {

  const cliente = extrairClienteDaMensagem(texto, clientes);

  if (cliente) return cliente;



  const n = normalizarTexto(texto)

    .replace(/\b(essa|esse|o|a|cliente|esta|está|cadastrada|cadastrado|no|na|sistema)\b/g, " ")

    .replace(/\s+/g, " ")

    .trim();



  if (!n) return null;



  return (

    clientes.find((cliente) => {

      const nomeCliente = normalizarTexto(cliente?.nome);

      return (

        nomeCliente &&

        (n.includes(nomeCliente) ||

          nomeCliente.includes(n))

      );

    })?.nome || null

  );

}



// ============================================================

// PROCESSAMENTO PRINCIPAL

// ============================================================



async function processarMensagemInternamente(

  chatId,

  {

    texto,

    audioBase64,

    mime,

  },

) {

  try {

    if (audioBase64) {

      return "O áudio precisa ser transcrito antes de ser processado.";

    }



    if (

      !texto ||

      !String(texto).trim()

    ) {

      return "Não consegui identificar sua mensagem. Pode tentar novamente?";

    }



    const textoAtual =

      String(texto).trim();

    // O registro de produção foi desativado no bot.
    // Limpa fluxos antigos de produção para impedir que sejam retomados.
    const estadoRegistroAnterior = getEstadoRegistro(chatId);
    if (estadoRegistroAnterior?.tipo === "producao") {
      limparEstadoRegistro(chatId);
      limparConversa(chatId);
    }

    const pedidoRegistroProducao = /\b(produzi|produzimos|produzir|producao|fabricar|fabriquei|fabricamos|foi produzido|foi produzida)\b/i.test(normalizarTexto(textoAtual));
    if (pedidoRegistroProducao && !getEstadoVenda(chatId) && !getConfirmacao(chatId) && !getEstadoRegistro(chatId)) {
      return "O registro de produção não está mais disponível pelo bot. Você ainda pode registrar vendas, compras de matéria-prima e gastos ou despesas.";
    }

    // Após falha de uma produção, não reenvia o lançamento automaticamente.
    // Exige uma confirmação explícita para evitar duplicidade após falhas parciais.
    const estadoProducaoFalha = getEstadoRegistro(chatId);
    if (estadoProducaoFalha?.aguardandoRetentativaProducao && !ehCancelamento(textoAtual)) {
      const respostaRetentativa = textoNormalizado(textoAtual);
      const pediuRetentativa = /\b(tentar novamente|tentar|tenta|tente|tenta de novo|tentar de novo|repetir|registrar novamente|pode tentar|pode repetir)\b/i.test(respostaRetentativa);
      if (respostaRetentativa === '?' || respostaRetentativa === '？' || respostaRetentativa === 'que' || respostaRetentativa === 'como assim') {
        const nomeFalhou = estadoProducaoFalha.dados?.producoes?.[0]?.produto_nome || 'o produto';
        return `A produção de ${nomeFalhou} não foi registrada porque a API retornou um erro. Os produtos anteriores que foram confirmados como salvos não serão enviados novamente. Corrija o problema informado e depois escreva "tentar novamente" para tentar somente o produto que falhou.`;
      }
      if (!pediuRetentativa) {
        const nomeFalhou = estadoProducaoFalha.dados?.producoes?.[0]?.produto_nome || 'o produto';
        return `A produção de ${nomeFalhou} continua pendente por causa do erro anterior. Para evitar duplicidade, não vou reenviar automaticamente. Corrija o problema e escreva "tentar novamente" quando quiser repetir somente essa produção.`;
      }
      salvarEstadoRegistro(chatId, { ...estadoProducaoFalha, aguardandoRetentativaProducao: false });
    }

    // ========================================================

    // CANCELAMENTO

    // ========================================================



    if (ehCancelamento(textoAtual)) {

      const tinhaVenda =

        Boolean(

          getEstadoVenda(chatId) ||

          getConfirmacao(chatId),

        );



      limparConfirmacao(chatId);

      limparEstadoVenda(chatId);
      const tinhaRegistro = Boolean(getEstadoRegistro(chatId));
      limparEstadoRegistro(chatId);

      limparConversa(chatId);



      if (tinhaVenda) {

        return "Certo. A venda foi cancelada e os dados pendentes foram descartados.";

      }



      if (tinhaRegistro) return "Certo. O registro pendente foi cancelado e os dados foram descartados.";
      return "Certo. Não há nenhum lançamento pendente.";

    }



    // ========================================================

    // INÍCIO DE VENDA

    // ========================================================



    const textoNormal =

      textoNormalizado(textoAtual);

    // SAUDAÇÕES E PEDIDOS DE AJUDA: exibe o menu sem chamar a IA,
    // mas não interrompe uma venda ou outro lançamento que já esteja em andamento.
    const mensagensDeBoasVindas = new Set([
      "oi", "ola", "oie", "oii", "opa", "bom dia", "boa tarde",
      "boa noite", "tudo bem", "tudo bem com voce", "e ai",
      "olá", "bom dia tudo bem", "boa tarde tudo bem", "boa noite tudo bem",
      "oq vc pode fazer", "o que vc pode fazer", "o que voce pode fazer",
      "o que voce faz", "quais suas funcoes", "quais sao suas funcoes",
      "ajuda", "menu", "opcoes", "opcoes do bot",
    ]);

    const temFluxoEmAndamento = Boolean(
      getEstadoVenda(chatId) ||
      getConfirmacao(chatId) ||
      getEstadoRegistro(chatId)
    );

    if (mensagensDeBoasVindas.has(textoNormal) && !temFluxoEmAndamento) {
      const menuBoasVindas =
        `${/^(bom dia|boa tarde|boa noite)/.test(textoNormal) ? "Olá! " : "Olá! "}` +
        "O que você deseja fazer?\n\n" +
        "1. Registrar uma venda\n" +
        "2. Registrar uma compra de matéria-prima\n" +
        "3. Registrar um gasto ou despesa\n\n" +
        "Também posso ajudar a cadastrar novos clientes.\n\n" +
        "Responda com o número da opção ou me conte, com suas palavras, o que precisa.";

      acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
      acrescentarConversa(chatId, `Vovó: ${menuBoasVindas}`);
      console.log("[FLOW] Saudação/pedido de ajuda interceptado; menu exibido sem chamar a IA.");
      return menuBoasVindas;
    }

		// MENU DE REGISTRO: a palavra isolada "registrar" é ambígua e nunca deve
		// ser interpretada como confirmação ou como início automático de uma venda.
		const pedidoMenuRegistro = [
		  "registrar",
		  "quero registrar",
		  "preciso registrar",
		  "quero fazer um registro",
		  "registrar algo",
		].includes(textoNormal);

		if (pedidoMenuRegistro) {
		  // Evita que uma venda antiga pendente capture o próximo registro.
		  limparConfirmacao(chatId);
		  limparEstadoVenda(chatId);
          limparEstadoRegistro(chatId);
		  limparConversa(chatId);

		  const menuRegistro =
		    "O que você deseja registrar, meu bem?\n\n" +
		    "1. Venda\n" +
		    "2. Compra de matéria-prima\n" +
		    "3. Gasto ou despesa\n\n" +
		    "Pode responder com uma opção ou já me contar o que aconteceu.\n" +
		    "Exemplos: \"comprei 2 kg de amendoim por R$ 30,00\" ou \"vendi 2 potes para Maria\".";

		  acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
		  acrescentarConversa(chatId, `Vovó: ${menuRegistro}`);
		  console.log("[FLOW] Mensagem genérica de registro interceptada; menu exibido sem chamar a IA.");
		  return menuRegistro;
		}




    // A escolha de uma categoria apenas inicia o fluxo; não salva dados vazios.
    const opcoesRegistro = {
      venda: ["1", "1 venda", "venda", "registrar venda", "nova venda"],
      compra: ["2", "2 compra de materia prima", "compra", "compra de materia prima", "registrar compra", "registrar compra de materia prima"],
      gasto: ["3", "3 gasto ou despesa", "gasto", "despesa", "gasto ou despesa", "registrar gasto", "registrar despesa"],
    };
    const categoriaSelecionada = Object.entries(opcoesRegistro)
      .find(([, opcoes]) => opcoes.includes(textoNormal))?.[0];

    if (categoriaSelecionada === "venda") {
      limparEstadoRegistro(chatId);
      if (!getEstadoVenda(chatId) && !getConfirmacao(chatId)) {
        const vendaInicial = { tipo: "venda", comprador: null, novo_cliente: null, forma_pagamento: null, tipo_cartao: null, parcelas: null, itens: [] };
        salvarEstadoVenda(chatId, vendaInicial);
        const resposta = "Vamos registrar uma venda!\n\nCliente:\nProduto:\nQuantidade (potes ou caixas):\nTamanho do pote (20 ou 44):\nForma de pagamento (Pix, dinheiro ou cartão):\nSe for cartão, informe crédito ou débito e o número de parcelas.\n\nPode responder em texto corrido, do seu jeito. Vou aproveitar as informações que você enviar e perguntar o que ainda faltar.";
        acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
        acrescentarConversa(chatId, `Vovó: ${resposta}`);
        console.log("[FLOW] Opção 1 selecionada: venda iniciada sem chamar a IA.");
        return resposta;
      }
    }

    if (categoriaSelecionada && categoriaSelecionada !== "venda") {
      limparConfirmacao(chatId);
      limparEstadoVenda(chatId);
      limparConversa(chatId);
      salvarEstadoRegistro(chatId, { tipo: categoriaSelecionada });
      const perguntas = {
        producao: "Vamos registrar uma produção. O que foi produzido e em qual quantidade?\n\nExemplo: produzi 5 potes de biriba.",
        compra: "Vamos registrar uma compra de matéria-prima. Qual matéria-prima você comprou, em qual quantidade e qual foi o valor?\n\nExemplo: comprei 2 kg de amendoim por R$ 30,00.",
        gasto: "Vamos registrar um gasto ou despesa. Qual foi o gasto e qual foi o valor?\n\nExemplo: conta de luz, R$ 100,00.",
      };
      const pergunta = perguntas[categoriaSelecionada];
      acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
      acrescentarConversa(chatId, `Vovó: ${pergunta}`);
      console.log(`[FLOW] Categoria ${categoriaSelecionada} escolhida no menu; aguardando detalhes, sem chamar a API.`);
      return pergunta;
    }
    if (categoriaSelecionada === "venda") limparEstadoRegistro(chatId);

    const inicioVenda =

      categoriaSelecionada === "venda" ||

      textoNormal === "venda" ||

      textoNormal === "registrar venda" ||

      textoNormal ===

        "registrar uma venda" ||

      textoNormal ===

        "quero registrar venda" ||

      textoNormal ===

        "quero registrar uma venda" ||

      textoNormal === "nova venda" ||

      textoNormal ===

        "fazer uma venda";



    if (

      inicioVenda &&

      !getEstadoVenda(chatId)

    ) {

      const vendaInicial = {

        tipo: "venda",

        comprador: null,

        novo_cliente: null,

        forma_pagamento: null,

        tipo_cartao: null,

        parcelas: null,

        itens: [],

      };



      salvarEstadoVenda(

        chatId,

        vendaInicial,

      );



      const checklist =

        montarChecklistInicialVenda();



      acrescentarConversa(

        chatId,

        `Gestora: ${textoAtual}`,

      );



      acrescentarConversa(

        chatId,

        `Vovó: ${checklist}`,

      );



      console.log(

        "[FLOW] Nova venda iniciada sem chamar a IA.",

      );



      return checklist;

    }



    // ========================================================

    // ESTADO ATUAL

    // ========================================================



    let vendaEmAndamento =

      getEstadoVenda(chatId);



    const confirmacaoAtual =

      getConfirmacao(chatId);



    // ========================================================

    // EXTRAÇÃO DIRETA DE TELEFONE

    // ========================================================



    const telefone =

      extrairTelefone(textoAtual);



    if (

      telefone &&

      (vendaEmAndamento || confirmacaoAtual)

    ) {

      const venda =

        vendaEmAndamento ||

        confirmacaoAtual.venda;



      // Só grava telefone se o cadastro de cliente novo já estiver em andamento

      if (venda && venda.novo_cliente) {

        venda.novo_cliente.telefone = telefone;



        normalizarEstadoNovoCliente(venda);



        salvarEstadoVenda(chatId, venda);

      }

    }



    // ========================================================

    // CONFIRMAÇÃO POSITIVA

    // ========================================================



    const vendaPendente =

      getConfirmacao(chatId);



    if (

      vendaPendente &&

      ehConfirmacaoPositiva(

        textoAtual,

      )

    ) {

      console.log(

        "[FLOW] Venda confirmada pela Gestora.",

      );



      try {

        // Não abandonar uma requisição de gravação em segundo plano: se ela concluísse
        // depois de um timeout local, a gestora poderia tentar novamente e duplicar a venda.
        // O timeout central é controlado pelo apiClient; só limpamos o estado após sucesso.
        const resposta = await concluirLancamento(vendaPendente);



        limparConfirmacao(chatId);

        limparEstadoVenda(chatId);

        limparConversa(chatId);



        return resposta;

      } catch (err) {

        console.error(

          "[FLOW] Erro ao concluir venda:",

          err.response?.data ||

            err,

        );



        const msg =

          err.response?.data

            ?.message ||

          err.response?.data

            ?.error ||

          err.message ||

          "erro desconhecido";



        return (

          `Deu um probleminha ao salvar: ${msg}\n\n` +

          "Os dados da venda continuam pendentes."

        );

      }

    }



    // ========================================================

    // CONFIRMAÇÃO NEGATIVA

    // ========================================================



    if (

      vendaPendente &&

      ehConfirmacaoNegativa(textoAtual)

    ) {

      const vendaParaCorrigir = vendaPendente.venda;

      const textoCorrecao = limparPrefixoCorrecao(textoAtual);



      salvarEstadoVenda(chatId, vendaParaCorrigir);

      limparConfirmacao(chatId);

      acrescentarConversa(chatId, `Gestora: ${textoAtual}`);



      if (!textoCorrecao) {
        vendaParaCorrigir._aguardandoCorrecao = true;
        salvarEstadoVenda(chatId, vendaParaCorrigir);
        const resposta = "Certo. O que você deseja corrigir na venda? Pode dizer, por exemplo, ‘a paçoca foi pote de 44 unidades’ ou ‘o cliente é Ana’. Vou alterar somente os dados que você indicar.";

        acrescentarConversa(chatId, `Vovó: ${resposta}`);

        return resposta;

      }



      // NÃO + correção na mesma mensagem: aplica agora e continua o fluxo.

      const produtosCorrecao = await catalogCache.getProdutos();

      const clientesCorrecao = await catalogCache.getClientes();

      aplicarCorrecoesDiretas(vendaParaCorrigir, textoCorrecao, produtosCorrecao, clientesCorrecao);

      normalizarEstadoNovoCliente(vendaParaCorrigir);

      prepararItensVenda(vendaParaCorrigir);

      salvarEstadoVenda(chatId, vendaParaCorrigir);

    }



    // ========================================================

    // BUSCAR CATÁLOGO

    // ========================================================



    const produtos =

      await catalogCache.getProdutos();



    const materiasPrimas =

      await catalogCache.getMateriasPrimas();



    const clientes =

      await catalogCache.getClientes();



    console.log(

      `[FLOW] Processando mensagem de ${chatId}: ${textoAtual}`,

    );



    // ========================================================

    
    // Cadastro de produto acabado novo: exige confirmação e preço de venda antes de criar.
    const estadoCadastroProduto = getEstadoRegistro(chatId);
    if (estadoCadastroProduto?.tipo === "producao" && (estadoCadastroProduto.aguardandoCadastroProduto || estadoCadastroProduto.aguardandoPrecoProduto)) {
      const respostaProduto = textoNormalizado(textoAtual);
      if (estadoCadastroProduto.aguardandoCadastroProduto) {
        if (["sim", "s", "pode", "pode cadastrar", "cadastrar", "quero"].includes(respostaProduto)) {
          salvarEstadoRegistro(chatId, { ...estadoCadastroProduto, aguardandoCadastroProduto: false, aguardandoPrecoProduto: true });
          return `Qual será o preço de venda de "${estadoCadastroProduto.nomeProdutoNovo}" por pote? Preciso desse valor para cadastrar o produto.`;
        }
        if (["nao", "n"].includes(respostaProduto)) {
          limparEstadoRegistro(chatId);
          limparConversa(chatId);
          return "Certo, não cadastrei esse produto. Para registrar a produção, informe um produto que já exista no catálogo.";
        }
        return `Deseja cadastrar "${estadoCadastroProduto.nomeProdutoNovo}" como um novo produto? Responda sim ou não.`;
      }
      const preco = extrairValorMonetarioDireto(textoAtual);
      if (!(preco > 0)) return `Qual será o preço de venda de "${estadoCadastroProduto.nomeProdutoNovo}" por pote? Exemplo: R$ 18,00.`;
      const nome = estadoCadastroProduto.nomeProdutoNovo;
      const criado = await api.post("/produtos", {
        nome, unidadeMedida: "pote", precoVenda: preco, custoAtual: 0, estoqueAtual: 0, ativo: true,
      });
      await catalogCache.forcarAtualizacao();
      const catalogoAtualizado = await catalogCache.getProdutos();
      const produto = (criado && criado.id) ? criado : extrairProdutoDireto(nome, catalogoAtualizado);
      const dados = estadoCadastroProduto.dados || {};
      const producoes = Array.isArray(dados.producoes) ? [...dados.producoes] : [dados.producao || {}];
      const indice = Number(estadoCadastroProduto.indiceProdutoNovo || 0);
      if (producoes[indice]) {
        producoes[indice] = { ...producoes[indice], produtoId: produto?.id || null, produto_final_id: produto?.id || null, produto_nome: produto?.nome || nome };
      }
      const incompleta = producoes.find((x) => !x.produtoId || Number(x.quantidade || x.potes || 0) <= 0);
      if (incompleta) {
        const indicePendente = producoes.indexOf(incompleta);
        const novoNome = incompleta.produto_nome || incompleta.produto || "";
        if (!incompleta.produtoId && novoNome) {
          salvarEstadoRegistro(chatId, { tipo: "producao", dados: { producoes }, aguardandoCadastroProduto: true, nomeProdutoNovo: novoNome, indiceProdutoNovo: indicePendente });
          return `O produto "${novoNome}" também não está cadastrado. Deseja cadastrá-lo? Responda sim ou não.`;
        }
        salvarEstadoRegistro(chatId, { tipo: "producao", dados: { producoes } });
        return !incompleta.produtoId ? "Qual produto foi produzido?" : "Quantos potes foram produzidos?";
      }
      const respostaProducao = await concluirLancamento({ tipo: "producao", producoes });
      limparEstadoRegistro(chatId);
      limparConversa(chatId);
      return `Produto "${nome}" cadastrado. ${respostaProducao}`;
    }

    // Se uma matéria-prima não existe no catálogo, só cadastramos após confirmação da gestora.
    const estadoCadastroMateria = getEstadoRegistro(chatId);
    if (estadoCadastroMateria?.tipo === "compra" && estadoCadastroMateria.aguardandoCadastroMateriaPrima) {
      const respostaCadastro = textoNormalizado(textoAtual);
      if (["sim", "s", "pode", "pode cadastrar", "cadastrar", "quero"].includes(respostaCadastro)) {
        const nome = estadoCadastroMateria.nomeMateriaPrimaNova;
        const unidade = estadoCadastroMateria.unidadeNova || "kg";
        const criado = await api.post("/materias-primas", {
          nome, unidadeMedida: unidade, estoqueAtual: 0, estoqueMinimo: 0, custoMedio: 0, ativo: true,
        });
        await catalogCache.forcarAtualizacao();
        const catalogoAtualizado = await catalogCache.getMateriasPrimas();
        const materia = (criado && (criado.id || criado.materiaPrimaId)) ? criado : encontrarMateriaPrimaPorNome(nome, catalogoAtualizado);
        const compra = estadoCadastroMateria.dados?.compra || {};
        const itens = compra.itens || [];
        if (itens[0]) {
          itens[0].materiaPrimaId = materia?.id || materia?.materiaPrimaId || null;
          itens[0].produto_nome = materia?.nome || nome;
        }
        const item = itens[0] || {};
        const quantidade = Number(item.quantidade || 0);
        const total = Number(item.valor_total || item.valorTotal || 0);
        const valorUnitario = Number(item.valorUnitario || item.valor_unitario || (total > 0 && quantidade > 0 ? total / quantidade : 0));
        if (itens.length && item.materiaPrimaId && quantidade > 0 && valorUnitario > 0) {
          const respostaCompra = await criarCompra({ ...compra, itens: [{ ...item, materiaPrimaId: item.materiaPrimaId, quantidade, valorUnitario }] });
          limparEstadoRegistro(chatId);
          limparConversa(chatId);
          return `Matéria-prima "${nome}" cadastrada. ${respostaCompra}`;
        }
        salvarEstadoRegistro(chatId, {
          ...estadoCadastroMateria, aguardandoCadastroMateriaPrima: false,
          dados: { ...(estadoCadastroMateria.dados || {}), compra: { ...compra, itens } },
        });
        if (quantidade <= 0) return `Matéria-prima "${nome}" cadastrada. Qual quantidade você comprou?`;
        return `Matéria-prima "${nome}" cadastrada. Quanto custou a compra? Informe o valor total ou o valor por unidade.`;
      }
      if (["nao", "n"].includes(respostaCadastro)) {
        limparEstadoRegistro(chatId);
        limparConversa(chatId);
        return "Certo, não cadastrei essa matéria-prima. O que mais você deseja registrar?";
      }
      return `Deseja cadastrar "${estadoCadastroMateria.nomeMateriaPrimaNova}" como nova matéria-prima? Responda sim ou não.`;
    }

    // Consultas de estoque respondidas pelo catálogo real da API.
    const textoBuscaEstoque = normalizarTexto(textoAtual);
    const temVerboDeCompraOuProducao = /\b(comprei|compramos|produzi|produzimos|vendi|vendeu|registrar compra|registrar producao|lancei|adicionar ao estoque|dar entrada)\b/i.test(textoBuscaEstoque);
    const pareceConsultaEstoque = /\b(quais|qual|que|quanto|quantos|tem|lista|listar|mostrar|mostre|consultar|consulta|ver|mande|envie|estoque|materias primas|matérias-primas)\b/i.test(textoBuscaEstoque);
    if (!temVerboDeCompraOuProducao && pareceConsultaEstoque && /\b(estoque|produtos|materias primas|matérias-primas|insumos)\b/i.test(textoBuscaEstoque)) {
      if (/materia.?prima|insumo|ingrediente/.test(textoBuscaEstoque)) {
        return "Matérias-primas cadastradas:\n" + formatarEstoque(materiasPrimas, "matérias-primas");
      }
      if (/produto(s)?\s+(acabado|final|pronto)|doces|potes/.test(textoBuscaEstoque)) {
        return "Produtos cadastrados:\n" + formatarEstoque(produtos, "produtos");
      }
      return "Produtos cadastrados:\n" + formatarEstoque(produtos, "produtos") +
        "\n\nMatérias-primas cadastradas:\n" + formatarEstoque(materiasPrimas, "matérias-primas");
    }

// CONSULTA REAL AO CADASTRO DE CLIENTES

    // ========================================================



    if (ehConsultaCadastroCliente(textoAtual)) {

      const nomeConsulta = obterNomeClienteParaConsulta(

        textoAtual,

        clientes,

      );



      if (!nomeConsulta) {

        return "Qual é o nome completo ou razão social do cliente que você deseja consultar?";

      }



      const clienteEncontrado = encontrarClientePorNome(

        nomeConsulta,

        clientes,

      );



      if (clienteEncontrado) {

        return `Sim. ${clienteEncontrado.nome} está cadastrado no sistema.`;

      }



      return `Não. ${nomeConsulta} não está cadastrado no sistema.`;

    }



    // ========================================================

    // Evita que uma mensagem isolada com o nome de um item reutilize dados antigos.
    const registroAtivoAntesIA = getEstadoRegistro(chatId);
    const vendaAtivaAntesIA = getEstadoVenda(chatId);
    const temVerboDeLancamento = /\b(comprei|compramos|compra|registrar|registre|produzi|produzimos|produção|produzir|fiz|vendi|vendeu|venda|gasto|despesa|paguei|custou|custaram|foi produzido|foi produzida)\b/i.test(normalizarTexto(textoAtual));
    if (!registroAtivoAntesIA && !vendaAtivaAntesIA && !temVerboDeLancamento) {
      const materiaMencionada = encontrarMateriaPrimaPorNome(textoAtual, materiasPrimas);
      const produtoMencionado = extrairProdutoDireto(textoAtual, produtos);
      if (materiaMencionada || produtoMencionado) {
        const nome = materiaMencionada?.nome || produtoMencionado?.nome;
        return `Você mencionou "${nome}". Deseja consultar o estoque ou registrar uma ${materiaMencionada ? "compra dessa matéria-prima" : "venda desse produto"}?`;
      }
    }

    // EXTRAÇÕES DIRETAS

    // ========================================================

    const clienteDiretoCatalogo = extrairClienteDaMensagem(
      textoAtual,
      clientes,
    );

    const compradorDireto = extrairCompradorDireto(textoAtual);

    const clienteDireto =
      clienteDiretoCatalogo ||
      compradorDireto;



    const dadosDiretos =

      extrairDadosCliente(

        textoAtual,

      );



    vendaEmAndamento =

      getEstadoVenda(chatId);

    // Contestação da busca: atualiza o catálogo e não interpreta a frase como dados do cliente novo.
    if (
      vendaEmAndamento?.novo_cliente &&
      /\b(cadastrad[oa]|no sistema|ja existe|ja ta|nao ta no sistema|nao esta cadastrada|nao ta cadastrada)\b/i.test(normalizarTexto(textoAtual))
    ) {
      try {
        await catalogCache.forcarAtualizacao();
        const clientesAtualizados = await catalogCache.getClientes();
        const nomePendente = vendaEmAndamento.novo_cliente.nome || vendaEmAndamento.comprador || "";
        const clienteMencionado = extrairClienteDaMensagem(textoAtual, clientesAtualizados);
        const clienteExistente = clienteMencionado
          ? encontrarClientePorNome(clienteMencionado, clientesAtualizados)
          : encontrarClientePorNome(nomePendente, clientesAtualizados);
        if (clienteExistente?.id) {
          vendaEmAndamento.comprador = clienteExistente.nome;
          vendaEmAndamento.novo_cliente = null;
          salvarEstadoVenda(chatId, vendaEmAndamento);
          const respostaBusca = `Encontrei ${clienteExistente.nome} no cadastro. Vou usar esse cliente na venda. Pode continuar informando os dados que faltam.`;
          acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
          acrescentarConversa(chatId, `Vovó: ${respostaBusca}`);
          return respostaBusca;
        }
        const respostaBusca = `Atualizei a lista de clientes, mas ainda não consegui confirmar ${nomePendente || "esse cliente"}. Não vou cadastrar ninguém automaticamente. Confira o nome completo ou envie o CPF/CNPJ para eu verificar melhor.`;
        acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
        acrescentarConversa(chatId, `Vovó: ${respostaBusca}`);
        return respostaBusca;
      } catch (erroBusca) {
        console.error("[FLOW] Falha ao atualizar clientes durante contestação:", erroBusca?.message || erroBusca);
        return "Não consegui consultar o cadastro de clientes agora. Isso pode ser uma falha de conexão; não significa que o cliente não esteja cadastrado. Tente novamente em instantes.";
      }
    }

    if (vendaEmAndamento && vendaEmAndamento._aguardandoCorrecao) {
      const vendaParaCorrigir = vendaEmAndamento;
      delete vendaParaCorrigir._aguardandoCorrecao;
      const clientesParaCorrecao = await catalogCache.getClientes();
      aplicarCorrecoesDiretas(vendaParaCorrigir, textoAtual, produtos, clientesParaCorrecao);
      prepararItensVenda(vendaParaCorrigir);
      for (const item of (vendaParaCorrigir.itens || [])) {
        const precoCalculado = calcularPrecoItem(item);
        if (precoCalculado !== null) item.preco_unitario = precoCalculado;
      }
      const erroCorrecao = validarVendaParaConfirmacao(vendaParaCorrigir);
      if (erroCorrecao) {
        // Mantém o modo de correção ativo para que a próxima resposta curta
        // complete os campos pendentes deste item, sem passar pela IA/merge.
        vendaParaCorrigir._aguardandoCorrecao = true;
        salvarEstadoVenda(chatId, vendaParaCorrigir);
        let orientacao = erroCorrecao;
        if (erroCorrecao.includes("quantidade")) {
          orientacao = "Informe a quantidade, por exemplo: 2 potes.";
        } else if (erroCorrecao.includes("tamanho")) {
          orientacao = "Informe o tamanho do pote: 20 ou 44 unidades.";
        }
        const respostaCorrecao = `A correção foi aplicada. ${orientacao}`;
        acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
        acrescentarConversa(chatId, `Vovó: ${respostaCorrecao}`);
        return respostaCorrecao;
      }
      salvarEstadoVenda(chatId, vendaParaCorrigir);
      const confirmacaoCorrigida = montarConfirmacaoVenda(vendaParaCorrigir);
      salvarConfirmacao(chatId, { tipo: "venda", venda: vendaParaCorrigir, faltando: [], perguntaProximo: null });
      acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
      acrescentarConversa(chatId, `Vovó: ${confirmacaoCorrigida}`);
      return confirmacaoCorrigida;
    }

    if (vendaEmAndamento) {

      if (vendaEmAndamento.novo_cliente && Object.keys(dadosDiretos).length > 0) {
        vendaEmAndamento.novo_cliente = mesclarObjetos(vendaEmAndamento.novo_cliente, dadosDiretos);
        if (dadosDiretos.nome) vendaEmAndamento.comprador = dadosDiretos.nome;
        normalizarEstadoNovoCliente(vendaEmAndamento);
        salvarEstadoVenda(chatId, vendaEmAndamento);
      }

      if (compradorDireto) {
        vendaEmAndamento.comprador = compradorDireto;
      } else if (clienteDireto && clienteDireto !== "sem telefone") {
        vendaEmAndamento.comprador = clienteDireto;
      }



      // Se a gestora enviou um bloco de cadastro, processa diretamente pelo FLOW.
      if (
        vendaEmAndamento.novo_cliente &&
        Object.keys(dadosDiretos).length > 0
      ) {
        vendaEmAndamento.novo_cliente = mesclarObjetos(
          vendaEmAndamento.novo_cliente,
          dadosDiretos,
        );

        if (dadosDiretos.nome) {
          vendaEmAndamento.novo_cliente.nome = dadosDiretos.nome;
          vendaEmAndamento.comprador = dadosDiretos.nome;
        }

        normalizarEstadoNovoCliente(vendaEmAndamento);
        prepararItensVenda(vendaEmAndamento);
        salvarEstadoVenda(chatId, vendaEmAndamento);

        const faltantesCadastro = identificarFaltantesVenda(vendaEmAndamento);
        const faltantesClienteCadastro = faltantesCadastro.filter((campo) =>
          [
            "nome",
            "cpf_cnpj",
            "telefone",
            "estado",
            "cidade",
            "bairro",
            "endereco",
            "numero",
          ].includes(campo),
        );

        if (faltantesClienteCadastro.length > 0) {
          const respostaCadastro = montarChecklistNovoCliente(vendaEmAndamento.novo_cliente || { nome: vendaEmAndamento.comprador || "" });

          acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
          acrescentarConversa(chatId, `Vovó: ${respostaCadastro}`);
          return respostaCadastro;
        }

        const erroCadastroCompleto = validarVendaParaConfirmacao(vendaEmAndamento);

        if (!erroCadastroCompleto) {
          const confirmacaoCadastro = montarConfirmacaoVenda(vendaEmAndamento);

          salvarConfirmacao(chatId, {
            tipo: "venda",
            venda: vendaEmAndamento,
            faltando: [],
            perguntaProximo: null,
          });

          acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
          acrescentarConversa(chatId, `Vovó: ${confirmacaoCadastro}`);
          return confirmacaoCadastro;
        }
      }

normalizarEstadoNovoCliente(

        vendaEmAndamento,

      );



      // Se já sabemos que o cliente é novo, os próximos dados

      // são tratados pelo FLOW, sem mandar a mensagem para a IA.

      if (

      vendaEmAndamento.novo_cliente &&

      !/(produto|paçoca|pacoca|biriba|fondant|pote|potes|caixa|caixas|pix|dinheiro|cartao|cartão|credito|crédito|debito|débito|troque|troca|mude|mudar|altere|alterar|corrija|corrigir|cliente)/i.test(textoAtual)

    ) {

        const faltantesCliente = [

          "nome",

          "cpf_cnpj",

          "telefone",

          "estado",

          "cidade",

          "bairro",

          "endereco",

          "numero",

        ];



        const cliente = vendaEmAndamento.novo_cliente;



        const aindaFaltam = faltantesCliente.filter((campo) => {

          const chave =

            campo === "cpf_cnpj"

              ? "documento"

              : campo;

          return (

            !cliente[chave] ||

            String(cliente[chave]).trim() === ""

          );

        });



        salvarEstadoVenda(

          chatId,

          vendaEmAndamento,

        );



        if (aindaFaltam.length > 0) {

          const resposta = montarChecklistNovoCliente(cliente);



          acrescentarConversa(

            chatId,

            `Gestora: ${textoAtual}`,

          );



          acrescentarConversa(

            chatId,

            `Vovó: ${resposta}`,

          );



          return resposta;

        }



        // Todos os dados do novo cliente chegaram.

        // A venda continua pendente e vai para confirmação,

        // sem depender de uma nova interpretação da IA.

        prepararItensVenda(vendaEmAndamento);



        const erroClienteVenda =

          validarVendaParaConfirmacao(

            vendaEmAndamento,

          );



        if (!erroClienteVenda) {

          const confirmacao =

            montarConfirmacaoVenda(

              vendaEmAndamento,

            );



          salvarConfirmacao(

            chatId,

            {

              tipo: "venda",

              venda: vendaEmAndamento,

              faltando: [],

              perguntaProximo: null,

            },

          );



          acrescentarConversa(

            chatId,

            `Gestora: ${textoAtual}`,

          );



          acrescentarConversa(

            chatId,

            `Vovó: ${confirmacao}`,

          );



          return confirmacao;

        }

      }



      salvarEstadoVenda(

        chatId,

        vendaEmAndamento,

      );

    }



    // ========================================================

    // CORREÇÕES DIRETAS ANTES DA IA

    // ========================================================



    vendaEmAndamento = getEstadoVenda(chatId);

    if (vendaEmAndamento) {

      aplicarCorrecoesDiretas(vendaEmAndamento, textoAtual, produtos, clientes);

      normalizarEstadoNovoCliente(vendaEmAndamento);

      prepararItensVenda(vendaEmAndamento);

      salvarEstadoVenda(chatId, vendaEmAndamento);

    }



    // ========================================================

    // IA

    // ========================================================



    const registroEmAndamento = getEstadoRegistro(chatId);

    const resultado =

      await interpretarMensagem({

        texto: registroEmAndamento
          ? `A Gestora escolheu registrar ${registroEmAndamento.tipo}. Dados já capturados: ${JSON.stringify(registroEmAndamento.dados || {})}. Interprete a mensagem atual SOMENTE como atualização desses dados. Não reutilize dados de operações concluídas. Mensagem: ${textoAtual}`
          : textoAtual,

        produtos,

        materiasPrimas,

        clientes,

        conversaPrevia:
          (registroEmAndamento || vendaEmAndamento) ? (getConversa(chatId) || null) : null,

        estadoAtual:

          vendaEmAndamento ||

          null,

      });



    // A categoria escolhida explicitamente no menu tem prioridade sobre a IA.
    if (registroEmAndamento) {
      const tipoEscolhido = registroEmAndamento.tipo;
      if (tipoEscolhido === "producao") {
        const origem = resultado.producao || resultado.venda || resultado;
        const itensOrigem = origem?.itens || resultado.itens || [];
        const listaOrigem = Array.isArray(itensOrigem) && itensOrigem.length ? itensOrigem : [origem];
        resultado.tipo = "producao";
        resultado.producoes = listaOrigem.map((item) => {
          const nome = item?.produto_nome || item?.produto || origem?.produto_nome || "";
          const catalogado = item?.produtoId || item?.produto_id || item?.produto_final_id
            ? produtos.find((p) => String(p.id) === String(item.produtoId || item.produto_id || item.produto_final_id))
            : extrairProdutoDireto(nome, produtos);
          const qtd = Number(item?.quantidade || item?.potes || item?.quantidadeProduzida || origem?.quantidade || origem?.potes || 0);
          return {
            ...(origem && typeof origem === "object" ? origem : {}),
            ...item,
            produtoId: catalogado?.id || item?.produtoId || item?.produto_id || item?.produto_final_id || null,
            produto_final_id: catalogado?.id || item?.produto_final_id || item?.produtoId || item?.produto_id || null,
            produto_nome: catalogado?.nome || nome,
            quantidade: qtd,
            potes: qtd,
            tamanho_pote: item?.tamanho_pote || item?.tamanhoPote || origem?.tamanho_pote || origem?.tamanhoPote || extrairTamanhoDireto(textoAtual) || null,
            observacao: item?.observacao || origem?.observacao || origem?.observacoes,
          };
        });
        resultado.producao = resultado.producoes[0] || {};
      } else if (tipoEscolhido === "compra") {
        resultado.tipo = "compra";
        const lista = Array.isArray(resultado.compras) ? resultado.compras : (resultado.compra?.itens || resultado.compra?.materias_primas || []);
        resultado.compra = {
          ...(resultado.compra && !Array.isArray(resultado.compra) ? resultado.compra : {}),
          itens: lista.map((item) => ({
            ...item,
            materiaPrimaId: item.materiaPrimaId || item.materia_prima_id || item.id,
            quantidade: Number(item.quantidade || 0),
            valorUnitario: Number(item.valorUnitario || item.valor_unitario || item.preco_unitario || (item.valor_total && item.quantidade ? item.valor_total / item.quantidade : 0)),
          })),
        };
      } else if (tipoEscolhido === "gasto") {
        resultado.tipo = "gasto";
        resultado.gasto = resultado.gasto || resultado.despesa || {
          descricao: resultado.descricao || resultado.titulo || textoAtual,
          valor: resultado.valor || resultado.valorTotal || resultado.valor_total || 0,
          categoria: resultado.categoria || null,
        };
      }
    }

        // Corrige classificações erradas da IA quando a mensagem declara claramente a operação.
    if (!registroEmAndamento && resultado && typeof resultado === "object") {
      const mensagemNormalizada = normalizarTexto(textoAtual);
      const mencionaVenda = /\b(vendi|vendeu|venda|cliente comprou|foi vendido)\b/i.test(mensagemNormalizada);
      const mencionaCompra = /\b(comprei|compramos|fiz uma compra|compra de materia prima|adquiri)\b/i.test(mensagemNormalizada);
      const mencionaProducao = /\b(produzi|produzimos|producao|produzir|fabricamos|fabriquei)\b/i.test(mensagemNormalizada) ||
        (/\bfiz\b/i.test(mensagemNormalizada) && /\b(potes?|caixas?)\b/i.test(mensagemNormalizada) && !mencionaVenda);
      const mencionaGasto = /\b(gasto|gastei|despesa|no mercado|conta de luz|conta de agua|paguei por|paguei|pago|paga)\b/i.test(mensagemNormalizada) && !mencionaCompra;
      // Menções explícitas de venda têm prioridade sobre uma classificação errada da IA.
      // Alguns retornos trazem os dados corretos dentro de resultado.venda, mas marcam tipo="gasto".
      if (mencionaVenda && resultado.tipo !== "venda") {
        const dadosVenda = resultado.venda && typeof resultado.venda === "object"
          ? resultado.venda
          : resultado;
        Object.assign(resultado, dadosVenda, { tipo: "venda" });
      } else if (mencionaCompra && !mencionaVenda && resultado.tipo !== "compra") {
        const itensCompra = resultado.compras || resultado.compra?.itens || resultado.compra || resultado.itens || resultado.venda?.itens || [];
        resultado.tipo = "compra";
        resultado.compra = { ...(Array.isArray(resultado.compra) ? {} : resultado.compra || {}), itens: Array.isArray(itensCompra) ? itensCompra : [itensCompra] };
      } else if (mencionaProducao && !mencionaVenda && resultado.tipo !== "producao") {
        const origem = resultado.producao || resultado.venda || resultado;
        const itensOrigem = origem?.itens || resultado.itens || [];
        const lista = Array.isArray(itensOrigem) && itensOrigem.length ? itensOrigem : [origem];
        resultado.producoes = lista.map((item) => {
          const nome = item?.produto_nome || item?.produto || origem?.produto_nome || "";
          const produtoCatalogo = item?.produtoId || item?.produto_id || item?.produto_final_id
            ? produtos.find((p) => String(p.id) === String(item.produtoId || item.produto_id || item.produto_final_id))
            : extrairProdutoDireto(nome, produtos);
          const qtd = Number(item?.quantidade || item?.potes || item?.quantidadeProduzida || 0);
          return { ...item, produtoId: produtoCatalogo?.id || item?.produtoId || item?.produto_id || item?.produto_final_id || null,
            produto_final_id: produtoCatalogo?.id || item?.produtoId || item?.produto_id || item?.produto_final_id || null,
            produto_nome: produtoCatalogo?.nome || nome, quantidade: qtd, potes: qtd };
        });
        resultado.tipo = "producao";
        resultado.producao = resultado.producoes[0] || origem;
      } else if (mencionaGasto && resultado.tipo !== "gasto" && resultado.tipo !== "despesa") {
        resultado.tipo = "gasto";
        resultado.gasto = resultado.gasto || resultado.despesa || {
          descricao: resultado.descricao || resultado.titulo || textoAtual,
          valor: resultado.valor || resultado.valorTotal || resultado.valor_total || extrairValorMonetarioDireto(textoAtual) || 0,
        };
      }
    }

    // Normaliza compra mesmo quando a mensagem inicial já contém todos os dados.
    if (resultado && resultado.tipo === "compra") {
      const lista = Array.isArray(resultado.compras) ? resultado.compras
        : Array.isArray(resultado.compra) ? resultado.compra
        : (resultado.compra?.itens || resultado.compra?.materias_primas || resultado.materias_primas || []);
      const anterior = registroEmAndamento?.dados?.compra || {};
      const anteriores = anterior.itens || [];
      const itens = (Array.isArray(lista) ? lista : []).map((item) => {
        const nome = item.produto_nome || item.nome || item.materiaPrimaNome || "";
        const id = item.materiaPrimaId || item.materia_prima_id || item.id || null;
        const prev = anteriores.find((x) =>
          (id && String(x.materiaPrimaId || x.materia_prima_id || x.id) === String(id)) ||
          (nome && normalizarNomeCatalogo(x.produto_nome || x.nome) === normalizarNomeCatalogo(nome))
        ) || {};
        const qtdDireta = extrairQuantidadeMateriaPrima(textoAtual);
        const valorDireto = extrairValorMonetarioDireto(textoAtual);
        const catalogo = id ? materiasPrimas.find((x) => String(x.id) === String(id)) : encontrarMateriaPrimaPorNome(nome || prev.produto_nome, materiasPrimas);
        const quantidade = Number(item.quantidade || prev.quantidade || qtdDireta?.quantidade || 0);
        const total = Number(item.valor_total || item.valorTotal || 0);
        let valorUnitario = Number(item.valorUnitario || item.valor_unitario || item.preco_unitario || 0);
        if (!valorUnitario && total > 0 && quantidade > 0) valorUnitario = total / quantidade;
        if (!valorUnitario) valorUnitario = Number(prev.valorUnitario || 0);
        if (!valorUnitario && valorDireto > 0 && quantidade > 0) valorUnitario = valorDireto / quantidade;
        return { ...prev, ...item, produto_nome: catalogo?.nome || nome || prev.produto_nome || "",
          materiaPrimaId: catalogo?.id || id || prev.materiaPrimaId || null, quantidade,
          unidade: item.unidade || prev.unidade || qtdDireta?.unidade || catalogo?.unidadeMedida || "",
          valor_total: total || (valorUnitario > 0 && quantidade > 0 ? valorUnitario * quantidade : Number(prev.valor_total || 0)),
          valorUnitario };
      });
      resultado.compra = { ...(typeof resultado.compra === "object" && !Array.isArray(resultado.compra) ? resultado.compra : {}), ...anterior, itens: itens.length ? itens : anteriores };
      resultado.compras = resultado.compra.itens;
    }

    if (registroEmAndamento && resultado) {
      const dadosAntigos = registroEmAndamento.dados || {};
      // Nunca descarte os itens já capturados se a IA responder com lista vazia.
      if (registroEmAndamento.tipo === "compra") {
        const itensSalvos = dadosAntigos.compra?.itens || dadosAntigos.compra?.materias_primas || [];
        const itensDaIA = resultado.compra?.itens || resultado.compra?.materias_primas || [];
        if (itensSalvos.length && !itensDaIA.length) {
          resultado.tipo = "compra";
          resultado.compra = { ...(resultado.compra || {}), ...(dadosAntigos.compra || {}), itens: itensSalvos.map((item) => {
            const qtdDireta = extrairQuantidadeMateriaPrima(textoAtual);
            const valorDireto = extrairValorMonetarioDireto(textoAtual);
            const quantidade = Number(qtdDireta?.quantidade || item.quantidade || 0);
            const totalAnterior = Number(item.valor_total || item.valorTotal || 0);
            const valorUnitario = valorDireto > 0 && quantidade > 0
              ? valorDireto / quantidade
              : Number(item.valorUnitario || item.valor_unitario || (totalAnterior > 0 && quantidade > 0 ? totalAnterior / quantidade : 0));
            return { ...item, quantidade, unidade: qtdDireta?.unidade || item.unidade || "kg", valor_total: valorDireto || totalAnterior, valorUnitario };
          }) };
          resultado.compras = resultado.compra.itens;
        }
      }
      if (registroEmAndamento.tipo === "producao") {
        const novo = resultado.producao || resultado.venda || resultado;
        const item = novo?.itens?.[0] || novo || {};
        const anterior = dadosAntigos.producao || {};
        const produtoDireto = extrairProdutoDireto(textoAtual, produtos);
        const qtdDireta = extrairQuantidadeDireta(textoAtual);
        const quantidade = Number(item.quantidade || item.potes || item.quantidadeProduzida || anterior.quantidade || qtdDireta?.quantidade || 0);
        const id = item.produtoId || item.produto_id || item.produto_final_id || anterior.produtoId || produtoDireto?.id || null;
        const nome = item.produto_nome || item.produto || anterior.produto_nome || produtoDireto?.nome || "";
        resultado.tipo = "producao";
        resultado.producao = { ...anterior, ...(novo && typeof novo === "object" ? novo : {}), produtoId: id, produto_final_id: id, produto_nome: nome, quantidade, potes: quantidade };
        if (!Array.isArray(resultado.producoes)) resultado.producoes = [resultado.producao];
        registroEmAndamento.dados = { ...dadosAntigos, producao: resultado.producao, producoes: resultado.producoes };
      } else if (registroEmAndamento.tipo === "compra") {
        const anteriores = dadosAntigos.compra?.itens || [];
        const novos = resultado.compra?.itens || [];
        const novosEfetivos = novos.length ? novos : (anteriores.length ? [anteriores[0]] : []);
        const qtdDiretaDaMensagem = extrairQuantidadeMateriaPrima(textoAtual);
        const valorDiretoDaMensagem = extrairValorMonetarioDireto(textoAtual);
        const merged = novosEfetivos.map((novo) => {
          const prev = anteriores.find((x) =>
            (novo.materiaPrimaId && String(x.materiaPrimaId) === String(novo.materiaPrimaId)) ||
            (novo.produto_nome && normalizarNomeCatalogo(x.produto_nome) === normalizarNomeCatalogo(novo.produto_nome))
          ) || anteriores[0] || {};
          const nome = novo.produto_nome || prev.produto_nome || "";
          const catalogo = encontrarMateriaPrimaPorNome(nome, materiasPrimas);
          const qtdDireta = extrairQuantidadeMateriaPrima(textoAtual);
          const valorDireto = extrairValorMonetarioDireto(textoAtual);
          const quantidade = Number(qtdDiretaDaMensagem?.quantidade || novo.quantidade || prev.quantidade || qtdDireta?.quantidade || 0);
          let valorUnitario = Number(novo.valorUnitario || prev.valorUnitario || 0);
          const totalAnterior = Number(novo.valor_total || novo.valorTotal || prev.valor_total || prev.valorTotal || 0);
          if (valorDiretoDaMensagem > 0 && quantidade > 0) valorUnitario = valorDiretoDaMensagem / quantidade;
          else if (!valorUnitario && totalAnterior > 0 && quantidade > 0) valorUnitario = totalAnterior / quantidade;
          return { ...prev, ...novo, produto_nome: catalogo?.nome || nome, materiaPrimaId: catalogo?.id || novo.materiaPrimaId || prev.materiaPrimaId || null, quantidade, unidade: qtdDiretaDaMensagem?.unidade || novo.unidade || prev.unidade || qtdDireta?.unidade || catalogo?.unidadeMedida || "", valor_total: valorDiretoDaMensagem || totalAnterior, valorUnitario };
        });
        resultado.tipo = "compra";
        resultado.compra = { ...(dadosAntigos.compra || {}), ...(resultado.compra || {}), itens: merged.length ? merged : anteriores };
        resultado.compras = resultado.compra.itens;
        registroEmAndamento.dados = { ...dadosAntigos, compra: resultado.compra };
      } else if (registroEmAndamento.tipo === "gasto") {
        const novo = resultado.gasto || resultado.despesa || {};
        const prev = dadosAntigos.gasto || {};
        const valorDireto = extrairValorMonetarioDireto(textoAtual);
        const descricaoNova = novo.descricao || novo.titulo || novo.nome || "";
        const descricaoDireta = textoAtual.replace(/\b(?:gastei|gasto|paguei|paguei no|paguei na|paguei em)\b/ig, " ").replace(/r\$?\s*\d+(?:[,.]\d{1,2})?\s*(?:reais?)?/ig, " ").replace(/\s+/g, " ").trim();
        const descricao = (descricaoNova && !/^(custou|paguei|valor|r\$|\d)/i.test(descricaoNova)) ? descricaoNova : (prev.descricao || descricaoDireta || "");
        const valor = Number(novo.valor || novo.valorTotal || novo.valor_total || prev.valor || valorDireto || 0);
        resultado.tipo = "gasto";
        resultado.gasto = { ...prev, ...novo, descricao, valor };
        registroEmAndamento.dados = { ...dadosAntigos, gasto: resultado.gasto };
      }
      salvarEstadoRegistro(chatId, registroEmAndamento);
    }

console.log(

      "[FLOW] Resultado da IA:",

      JSON.stringify(

        resultado,

        null,

        2,

      ),

    );



    acrescentarConversa(

      chatId,

      `Gestora: ${textoAtual}`,

    );



    if (

      !resultado ||

      !resultado.tipo

    ) {

      throw new Error(

        "A IA retornou uma resposta sem informar o tipo da ação.",

      );

    }



    // ========================================================

    // CORREÇÃO DE VENDA COM ESTADO ATIVO

    // ========================================================



    // Se a mensagem contém uma correção clara e existe uma venda pendente,

    // não deixamos a IA transformar a correção em uma conversa genérica.

    if (vendaEmAndamento && resultado.tipo !== "venda") {

      const vendaCorrigida = getEstadoVenda(chatId);

      const houveCorrecao = Boolean(

        extrairNomeClienteCorrecao(textoAtual) ||

        extrairProdutoDireto(textoAtual, produtos) ||

        extrairQuantidadeDireta(textoAtual) ||

        extrairTamanhoDireto(textoAtual) ||

        extrairPagamentoDireto(textoAtual)

      );



      if (houveCorrecao) {

        aplicarCorrecoesDiretas(vendaCorrigida, textoAtual, produtos, clientes);

        normalizarEstadoNovoCliente(vendaCorrigida);

        prepararItensVenda(vendaCorrigida);

        salvarEstadoVenda(chatId, vendaCorrigida);



        const faltantesCorrecao = identificarFaltantesVenda(vendaCorrigida);

        if (faltantesCorrecao.length === 0) {

          const confirmacaoCorrigida = montarConfirmacaoVenda(vendaCorrigida);

          salvarConfirmacao(chatId, {

            tipo: "venda",

            venda: vendaCorrigida,

            faltando: [],

            perguntaProximo: null,

          });

          acrescentarConversa(chatId, `Vovó: ${confirmacaoCorrigida}`);

          return confirmacaoCorrigida;

        }

      }

    }



    // ========================================================

    // CONVERSA

    // ========================================================



    if (

      resultado.tipo ===

      "conversa"

    ) {

      const resposta =

        resultado.resposta ||

        "Como posso ajudar?";



      acrescentarConversa(

        chatId,

        `Vovó: ${resposta}`,

      );



      return resposta;

    }



    // ========================================================

    // DESCONHECIDO

    // ========================================================



    if (

      resultado.tipo ===

      "desconhecido"

    ) {

      const resposta =

        resultado.resposta ||

        "Não entendi o que você gostaria de fazer. Pode explicar de outro jeito?";



      acrescentarConversa(

        chatId,

        `Vovó: ${resposta}`,

      );



      return resposta;

    }



    // ========================================================

    // VENDA

    // ========================================================



    if (

      resultado.tipo ===

      "venda"

    ) {

      let novaVenda =

        resultado.venda;



      if (

        !novaVenda &&

        vendaEmAndamento

      ) {

        novaVenda =

          vendaEmAndamento;

      }



      if (!novaVenda) {

        novaVenda = {

          tipo: "venda",

          comprador: null,

          novo_cliente: null,

          forma_pagamento: null,

          tipo_cartao: null,

          parcelas: null,

          itens: [],

        };

      }



      novaVenda =

        mesclarVenda(

          vendaEmAndamento,

          novaVenda,

        );



      // Correções explícitas da mensagem têm prioridade sobre valores antigos retornados pela IA.

      aplicarCorrecoesDiretas(novaVenda, textoAtual, produtos, clientes);



      // O cadastro do cliente é controlado pelo FLOW.

      // Nunca aceitamos valores inventados pela IA para um novo cliente.

      if (novaVenda.novo_cliente && !vendaEmAndamento?.novo_cliente) {

        const dadosIACliente = novaVenda.novo_cliente;

        const dadosConfiaveis = limparDadosClienteNaoConfirmados(

          dadosIACliente,

          dadosDiretos,

        );



        novaVenda.novo_cliente = {

          ...dadosConfiaveis,

        };

      }



      if (compradorDireto) {
        novaVenda.comprador = compradorDireto;
      } else if (clienteDireto && clienteDireto !== "sem telefone") {
        novaVenda.comprador = clienteDireto;
      }



      // Verifica no catálogo REAL se o cliente existe.

      // Se não existir, transforma a venda em cadastro pendente.

      prepararNovoClienteDaVenda(

        novaVenda,

        clientes,

      );



      // Só mescla dados de cadastro se o catálogo REAL confirmou que o cliente é novo

      if (novaVenda.novo_cliente) {

        if (Object.keys(dadosDiretos).length > 0) {

          novaVenda.novo_cliente = mesclarObjetos(

            novaVenda.novo_cliente,

            dadosDiretos,

          );

        }



        if (telefone) {

          novaVenda.novo_cliente.telefone = telefone;

        }

      }



      normalizarEstadoNovoCliente(

        novaVenda,

      );



      prepararItensVenda(

        novaVenda,

      );



      salvarEstadoVenda(

        chatId,

        novaVenda,

      );



      const faltantes =

        identificarFaltantesVenda(

          novaVenda,

        );



      console.log(

        "[FLOW] Estado da venda:",

        JSON.stringify(

          novaVenda,

          null,

          2,

        ),

      );



      console.log(

        "[FLOW] Faltantes:",

        faltantes,

      );



      // ======================================================

      // AINDA FALTAM DADOS

      // ======================================================



      if (

        faltantes.length > 0

      ) {

        let resposta;



        const faltantesCliente = faltantes.filter((campo) =>

          [

            "nome",

            "cpf_cnpj",

            "telefone",

            "estado",

            "cidade",

            "bairro",

            "endereco",

            "numero",

          ].includes(campo),

        );



        if (faltantesCliente.length > 0) {

          resposta = montarChecklistNovoCliente(novaVenda.novo_cliente || { nome: novaVenda.comprador || "" });

        } else if (

          faltantes.length > 1

        ) {

          resposta =

            montarChecklistFaltantes(

              faltantes,

              "Para continuar, me manda essas informações:",

            );

        } else {

          resposta =

            perguntaParaFaltante(

              faltantes,

            );

        }



        if (resposta) {

          acrescentarConversa(

            chatId,

            `Vovó: ${resposta}`,

          );



          return resposta;

        }

      }



      // ======================================================

      // VALIDAR

      // ======================================================



      const erro =

        validarVendaParaConfirmacao(

          novaVenda,

        );



      if (erro) {

        acrescentarConversa(

          chatId,

          `Vovó: ${erro}`,

        );



        return erro;

      }



      // ======================================================

      // CONFIRMAÇÃO

      // ======================================================



      const confirmacao =

        montarConfirmacaoVenda(

          novaVenda,

        );



      const resultadoConfirmacao =

        {

          tipo: "venda",

          venda: novaVenda,

          faltando: [],

          perguntaProximo: null,

        };



      salvarConfirmacao(

        chatId,

        resultadoConfirmacao,

      );



      acrescentarConversa(

        chatId,

        `Vovó: ${confirmacao}`,

      );



      return confirmacao;

    }



    // ========================================================

    // OUTROS LANÇAMENTOS

    // ========================================================



    // Guardar os campos capturados e perguntar somente o que ainda falta.
    const tipoOperacao = registroEmAndamento?.tipo || resultado.tipo;

    if (tipoOperacao === "producao") {
      limparEstadoRegistro(chatId);
      return "O registro de produção não está mais disponível pelo bot. Você ainda pode registrar vendas, compras de matéria-prima e gastos ou despesas.";
    }

    if (tipoOperacao === "producao") {
      const origemProducoes = Array.isArray(resultado.producoes) && resultado.producoes.length
        ? resultado.producoes
        : [resultado.producao || {}];
      const producoesAnteriores = registroEmAndamento?.dados?.producoes || (registroEmAndamento?.dados?.producao ? [registroEmAndamento.dados.producao] : []);
      const tamanhoDireto = extrairTamanhoDireto(textoAtual);
      const producoes = origemProducoes.map((prod, indice) => {
        const produtoDireto = extrairProdutoDireto(prod.produto_nome || prod.produto || textoAtual, produtos);
        const produtoId = prod.produtoId || prod.produto_id || prod.produto_final_id || produtoDireto?.id || null;
        const produtoNome = prod.produto_nome || prod.produto || produtoDireto?.nome || producoesAnteriores[indice]?.produto_nome || "";
        const anterior = producoesAnteriores.find((x) => normalizarNomeCatalogo(x.produto_nome || x.produto) === normalizarNomeCatalogo(produtoNome)) || producoesAnteriores[indice] || {};
        const qtdDireta = extrairQuantidadeDireta(textoAtual);
        const quantidade = Number(prod.quantidade || prod.potes || prod.quantidadeProduzida || anterior.quantidade || anterior.potes || qtdDireta?.quantidade || 0);
        const tamanho_pote = Number(prod.tamanho_pote || prod.tamanhoPote || anterior.tamanho_pote || anterior.tamanhoPote || tamanhoDireto || 0);
        return { ...anterior, ...prod, produtoId, produto_final_id: produtoId, produto_nome: produtoNome, quantidade, potes: quantidade, tamanho_pote };
      });
      resultado.tipo = "producao";
      resultado.producoes = producoes;
      resultado.producao = producoes[0] || {};
      const incompleta = producoes.find((prod) => !prod.produtoId || Number(prod.quantidade) <= 0 || !Number(prod.tamanho_pote));
      if (incompleta) {
        const indiceIncompleto = producoes.indexOf(incompleta);
        const nomeIncompleto = incompleta.produto_nome || incompleta.produto || "";
        if (!incompleta.produtoId && Number(incompleta.quantidade) > 0 && nomeIncompleto) {
          salvarEstadoRegistro(chatId, {
            tipo: "producao",
            dados: { ...(registroEmAndamento?.dados || {}), producoes },
            aguardandoCadastroProduto: true,
            nomeProdutoNovo: nomeIncompleto,
            indiceProdutoNovo: indiceIncompleto,
          });
          const pergunta = `Não encontrei "${nomeIncompleto}" no cadastro de produtos. Deseja cadastrar esse produto? Responda sim ou não.`;
          acrescentarConversa(chatId, `Vovó: ${pergunta}`);
          return pergunta;
        }
        salvarEstadoRegistro(chatId, { tipo: "producao", dados: { ...(registroEmAndamento?.dados || {}), producoes } });
        const pergunta = !incompleta.produtoId && Number(incompleta.quantidade) <= 0
          ? "O que foi produzido e em qual quantidade? Exemplo: produzi 5 potes de biriba."
          : !incompleta.produtoId ? "Qual produto foi produzido? Exemplo: biriba ou paçoca."
          : Number(incompleta.quantidade) <= 0 ? `Quantos potes de ${nomeIncompleto || incompleta.produto_nome} foram produzidos?`
          : !Number(incompleta.tamanho_pote) ? `Os potes de ${nomeIncompleto || incompleta.produto_nome} eram de 20 ou 44 unidades?`
          : "Qual informação falta para concluir a produção?";
        acrescentarConversa(chatId, `Vovó: ${pergunta}`);
        return pergunta;
      }
        } else if (tipoOperacao === "compra") {
      let compra = resultado.compra || {};
      const compraPendente = registroEmAndamento?.dados?.compra || {};
      const itensResultado = compra.itens || compra.materias_primas || [];
      const itensOriginais = Array.isArray(itensResultado) && itensResultado.length
        ? itensResultado
        : (compraPendente.itens || compraPendente.materias_primas || []);
      const itens = Array.isArray(itensOriginais) ? [...itensOriginais] : [];
      // Fallback determinístico: se a IA não reconhecer um item novo, tenta
      // extrair o nome diretamente da mensagem da gestora.
      if (!itens.length || !(itens[0]?.produto_nome || itens[0]?.nome || itens[0]?.materiaPrimaNome)) {
        const nomeExtraido = extrairNomeMateriaPrimaDaMensagem(textoAtual, materiasPrimas);
        if (nomeExtraido) {
          const qtdExtraida = extrairQuantidadeMateriaPrima(textoAtual);
          const valorExtraido = extrairValorMonetarioDireto(textoAtual);
          itens[0] = {
            ...(itens[0] || {}),
            produto_nome: nomeExtraido,
            quantidade: qtdExtraida?.quantidade || Number(itens[0]?.quantidade || 0),
            unidade: qtdExtraida?.unidade || itens[0]?.unidade || "kg",
            valor_total: valorExtraido || Number(itens[0]?.valor_total || itens[0]?.valorTotal || 0),
            valorUnitario: Number(itens[0]?.valorUnitario || 0),
          };
          resultado.compra = { ...compra, itens };
          compra = resultado.compra;
        }
      }
      const item = itens[0] || {};
      const nomeItem = item.produto_nome || item.nome || item.materiaPrimaNome || "";
      const catalogo = encontrarMateriaPrimaPorNome(nomeItem, materiasPrimas);
      const id = item.materiaPrimaId || item.materia_prima_id || item.id || catalogo?.id || null;
      const quantidade = Number(item.quantidade || 0);
      const valorUnitario = Number(item.valorUnitario || item.valor_unitario || item.preco_unitario || 0);
      const total = Number(item.valor_total || item.valorTotal || 0);
      if (!itens.length || !nomeItem) {
        salvarEstadoRegistro(chatId, { tipo: "compra", dados: { ...(registroEmAndamento?.dados || {}), compra } });
        const pergunta = "Qual matéria-prima você comprou? Exemplo: açúcar, leite em pó ou amendoim.";
        acrescentarConversa(chatId, `Vovó: ${pergunta}`);
        return pergunta;
      }
      if (!id) {
        salvarEstadoRegistro(chatId, { tipo: "compra", dados: { ...(registroEmAndamento?.dados || {}), compra }, aguardandoCadastroMateriaPrima: true, nomeMateriaPrimaNova: nomeItem, unidadeNova: item.unidade || "kg" });
        const pergunta = `Não encontrei "${nomeItem}" no cadastro de matérias-primas. Deseja cadastrar essa matéria-prima no sistema? Responda sim ou não.`;
        acrescentarConversa(chatId, `Vovó: ${pergunta}`);
        return pergunta;
      }
      if (quantidade <= 0) {
        salvarEstadoRegistro(chatId, { tipo: "compra", dados: { ...(registroEmAndamento?.dados || {}), compra: { ...compra, itens } } });
        const pergunta = `Qual quantidade de ${catalogo?.nome || nomeItem} você comprou? Informe a quantidade e a unidade, por exemplo: 2 kg.`;
        acrescentarConversa(chatId, `Vovó: ${pergunta}`);
        return pergunta;
      }
      const valorEfetivo = valorUnitario > 0 ? valorUnitario : total > 0 ? total / quantidade : 0;
      if (valorEfetivo <= 0) {
        salvarEstadoRegistro(chatId, { tipo: "compra", dados: { ...(registroEmAndamento?.dados || {}), compra: { ...compra, itens: [{ ...item, materiaPrimaId: id, quantidade, produto_nome: catalogo?.nome || nomeItem }] } } });
        const pergunta = `Quanto custou ${quantidade} ${item.unidade || catalogo?.unidadeMedida || ""} de ${catalogo?.nome || nomeItem}? Informe o valor total pago ou o valor por unidade.`;
        acrescentarConversa(chatId, `Vovó: ${pergunta}`);
        return pergunta;
      }
      resultado.tipo = "compra";
      resultado.compra = { ...compra, itens: itens.map((it) => ({ ...it, materiaPrimaId: it.materiaPrimaId || it.materia_prima_id || it.id || catalogo?.id, quantidade: Number(it.quantidade || quantidade), valorUnitario: Number(it.valorUnitario || it.valor_unitario || it.preco_unitario || (Number(it.valor_total || it.valorTotal || 0) > 0 ? Number(it.valor_total || it.valorTotal) / Number(it.quantidade || quantidade) : valorEfetivo)) })) };
      resultado.compras = resultado.compra.itens;
    } else if (tipoOperacao === "gasto" || tipoOperacao === "despesa") {
      const gasto = resultado.gasto || resultado.despesa || {};
      const anterior = registroEmAndamento?.dados?.gasto || {};
      const descricao = gasto.descricao || gasto.titulo || gasto.nome || anterior.descricao || "";
      const valor = Number(gasto.valor || gasto.valorTotal || gasto.valor_total || anterior.valor || extrairValorMonetarioDireto(textoAtual) || 0);
      resultado.tipo = "gasto";
      resultado.gasto = { ...anterior, ...gasto, descricao, valor };
      if (!descricao || valor <= 0) {
        salvarEstadoRegistro(chatId, { tipo: "gasto", dados: { ...(registroEmAndamento?.dados || {}), gasto: resultado.gasto } });
        const pergunta = !descricao && valor <= 0
          ? "Qual gasto ou despesa você deseja registrar e qual foi o valor? Exemplo: conta de luz, R$ 100,00."
          : !descricao ? "Do que foi esse gasto? Exemplo: conta de luz ou compra de material."
          : `Qual foi o valor de ${descricao}?`;
        acrescentarConversa(chatId, `Vovó: ${pergunta}`);
        return pergunta;
      }
    }

    try {

      const resposta =

        await concluirLancamento(

          resultado,

        );

      limparEstadoRegistro(chatId);



      limparConversa(chatId);



      return resposta;

    } catch (err) {

      console.error(

        "[FLOW] Erro ao concluir lançamento:",

        err.response?.data ||

          err,

      );



      const msg =

        err.response?.data

          ?.message ||

        err.response?.data

          ?.error ||

        err.message ||

        "erro desconhecido";

      if (tipoOperacao === "producao") {
        const producaoFalha = err.producaoFalha || resultado.producao || resultado.producoes?.[0] || {};
        const nomeFalhou = producaoFalha.produto_nome || producaoFalha.produto || "produto";
        salvarEstadoRegistro(chatId, {
          tipo: "producao",
          dados: { producoes: [{ ...producaoFalha }] },
          aguardandoRetentativaProducao: true,
          mensagemErroProducao: String(msg),
          producoesJaRegistradas: (err.producoesRegistradas || []).map((item) => ({
            produto_nome: item.produto_nome || item.produto || "produto",
            quantidade: item.quantidade || item.quantidadeProduzida || item.potes || 0,
          })),
        });
        const nomesSalvos = (err.producoesRegistradas || []).map((item) => item.produto_nome || item.produto || "produto");
        const avisoParciais = nomesSalvos.length
          ? ` Já foram registradas com sucesso: ${nomesSalvos.join(", ")}. Não vou reenviá-las.`
          : "";
        return `Não consegui registrar a produção de ${nomeFalhou}: ${msg}.${avisoParciais} Corrija o problema e escreva "tentar novamente" para tentar somente essa produção.`;
      }

      return `Deu um probleminha ao salvar: ${msg}`;

    }

  } catch (error) {

    console.error(

      "========================================",

    );



    console.error(

      "[FLOW] ERRO REAL:",

    );



    console.error(

      error.response?.data ||

        error,

    );



    console.error(

      error.stack,

    );



    console.error(

      "========================================",

    );



    const codigo = error?.code;

    const status = error?.response?.status;

    if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(codigo)) {

      return "Não consegui acessar a API do sistema neste momento. Verifique a conexão com a API e tente novamente em alguns segundos.";

    }

    if (status) {

      const detalhe =

        error?.response?.data?.message ||

        error?.response?.data?.error ||

        `HTTP ${status}`;

      return `Não consegui acessar o sistema. ${detalhe}`;

    }

    return "Não consegui processar essa mensagem. Tente novamente.";

  }

}



// ============================================================

// FUNÇÃO PÚBLICA USADA PELO BOT.JS

// ============================================================



async function processarMensagem(

  chatId,

  dados,

) {

  return await processarMensagemInternamente(

    chatId,

    dados,

  );

}



// ============================================================

// EXPORTAÇÃO

// ============================================================



module.exports = {

  processarMensagem,

};

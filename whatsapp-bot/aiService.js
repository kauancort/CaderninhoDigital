const axios = require("axios");



require("dotenv").config();







// ============================================================



// PROVEDORES DE IA (ordem = prioridade). Todos usam API compatível com OpenAI.



// ============================================================







function listarProvedores() {

  const lista = [];



  if (process.env.GROQ_API_KEY?.trim()) {

    lista.push({

      nome: "groq",

      url: "https://api.groq.com/openai/v1/chat/completions",

      chave: process.env.GROQ_API_KEY.trim(),

      modelo: process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b",

      maxTokens: 1200,

      usaMaxCompletionTokens: true,

      headersExtras: {},

      // GPT-OSS usa tokens de raciocínio dentro da resposta.

      // Low + hidden deixa tokens suficientes para o JSON final.

      corpoExtra: {

        reasoning_effort: "low",

        reasoning_format: "hidden",

      },

    });

  }



  if (process.env.GEMINI_API_KEY?.trim()) {

    lista.push({

      nome: "gemini",

      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",

      chave: process.env.GEMINI_API_KEY.trim(),

      modelo: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",

      maxTokens: 1200,

      headersExtras: {},

      corpoExtra: {},

    });

  }



  const orModelo = process.env.OPENROUTER_MODEL?.trim();

  if (process.env.OPENROUTER_API_KEY?.trim() && orModelo) {

    lista.push({

      nome: "openrouter",

      url: "https://openrouter.ai/api/v1/chat/completions",

      chave: process.env.OPENROUTER_API_KEY.trim(),

      modelo: orModelo,

      maxTokens: 1200,

      headersExtras: {

        "HTTP-Referer": "http://localhost",

        "X-Title": "Caderninho Digital - WhatsApp Bot",

      },

      corpoExtra: { reasoning: { exclude: true } },

    });

  }



  return lista;

}



function validarConfiguracao() {



  if (listarProvedores().length === 0) {



    throw new Error(



      "Nenhum provedor de IA configurado. Defina GROQ_API_KEY (recomendado) no .env.",



    );



  }



}







// ============================================================



// CATÁLOGO COMPACTO (economiza tokens e respeita limites do plano gratuito)



// ============================================================







function normalizarBusca(valor) {

  return String(valor || "")

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .toLowerCase()

    .replace(/[^a-z0-9\s]/g, " ")

    .replace(/\s+/g, " ")

    .trim();

}



function selecionarClientesRelevantes(clientes, texto, estadoAtual, conversaPrevia) {

  const lista = (clientes || []).map((c) => c?.nome).filter(Boolean);

  if (lista.length === 0) return [];



  const contexto = normalizarBusca(

    [

      texto,

      estadoAtual?.comprador,

      estadoAtual?.cliente,

      ...(Array.isArray(conversaPrevia) ? conversaPrevia.slice(-3) : [conversaPrevia]),

    ].filter(Boolean).join(" "),

  );



  if (!contexto) return lista.slice(0, 20);



  const tokens = contexto.split(" ").filter((t) => t.length >= 3);

  return lista

    .map((nome) => {

      const n = normalizarBusca(nome);

      let pontos = 0;

      if (contexto.includes(n)) pontos += 100;

      if (n.includes(contexto)) pontos += 50;

      for (const token of tokens) {

        if (n.includes(token)) pontos += token.length >= 5 ? 10 : 3;

      }

      return { nome, pontos };

    })

    .filter((x) => x.pontos > 0)

    .sort((a, b) => b.pontos - a.pontos)

    .slice(0, 10)

    .map((x) => x.nome);

}



function montarCatalogo(produtos, materiasPrimas, clientes, contexto = {}) {

  return {

    produtos: (produtos || []).map((p) => ({ id: p.id, nome: p.nome })),

    materiasPrimas: (materiasPrimas || []).map((m) => ({

      id: m.id,

      nome: m.nome,

      ...(m.unidade || m.unidadeMedida

        ? { unidade: m.unidade || m.unidadeMedida }

        : {}),

    })),

    clientes: selecionarClientesRelevantes(

      clientes,

      contexto.texto,

      contexto.estadoAtual,

      contexto.conversaPrevia,

    ),

  };

}







// ============================================================



// SYSTEM PROMPT



// ============================================================







function montarSystemPrompt(catalogo) {



  return `



Você é a assistente de WhatsApp da fábrica de doces "Doces Vó Cida".



Você conversa EXCLUSIVAMENTE com a gestora da fábrica.



Seu trabalho é interpretar as mensagens da gestora e transformar pedidos de negócio em dados estruturados (JSON) para o sistema.







==================================================



AÇÕES DISPONÍVEIS



==================================================



Você pode identificar: venda, compra, producao, gasto, conversa, desconhecido.







NUNCA invente informações, IDs, nomes de produtos, matérias-primas ou clientes.



Use SOMENTE IDs existentes no catálogo fornecido.



Aceite pequenas diferenças de escrita (maiúsculas, acentos, abreviações, erros de digitação, parte claramente identificável do nome).



Se houver dúvida real sobre qual registro é o correto, peça esclarecimento.







==================================================



CATÁLOGO ATUAL DO SISTEMA



==================================================



PRODUTOS (id, nome):



${JSON.stringify(catalogo.produtos)}







MATÉRIAS-PRIMAS:



${JSON.stringify(catalogo.materiasPrimas)}







CLIENTES CADASTRADOS (um nome por linha):



${catalogo.clientes.join("\n")}







==================================================



HISTÓRICO DA CONVERSA



==================================================



A conversa pode acontecer em várias mensagens. A gestora NÃO precisa informar tudo de uma vez e normalmente escreverá em texto corrido e informal, sem seguir modelos.



Junte as informações da mensagem atual com as já fornecidas. NUNCA descarte informação válida já informada.



NUNCA recomece a operação só porque a mensagem atual traz uma parte das informações. Faça perguntas específicas e curtas SOMENTE sobre os campos que faltam. NUNCA repita um checklist genérico inteiro a cada mensagem. Se ela enviar vários campos de uma vez, capture todos eles. Se responder só uma informação, incorpore-a ao estado existente e pergunte o próximo campo faltante.



REGRAS DE CONVERSA ADAPTATIVA:

- Venda com vários produtos: crie um objeto separado dentro de "itens" para CADA doce/tamanho informado. Nunca junte produtos diferentes em um único item e nunca descarte um item porque outro já foi identificado. Preserve a ordem em que foram mencionados. Para cada item, capture nome/ID do produto, quantidade, tipo (pote/caixa), tamanho do pote (20 ou 44 quando informado) e preço unitário quando informado. Se o mesmo doce aparecer em dois tamanhos, mantenha dois itens separados. Se não tiver certeza de uma quantidade ou tamanho, não copie o valor de outro item; deixe ausente/null e solicite esclarecimento. Pergunte apenas os dados necessários que ainda faltarem para registrar.

- Produção: aceite vários doces na mesma frase; para cada doce capture quantidade de potes e tamanho (20 ou 44 unidades) quando aplicável. Pergunte individualmente o que falta, sem perder os outros itens.

- Compra de matéria-prima: capture ingrediente, quantidade e unidade, valor total ou unitário. Se não existir no catálogo, sinalize que é necessário cadastrar e peça confirmação antes de criar.

- Gasto: frases como “gastei 45 reais no mercado” significam gasto geral; capture descrição e valor e pergunte só a categoria se o sistema realmente exigir.

- Cliente novo: aceite nome, telefone, CPF/CNPJ, rua, número, bairro, cidade e UF em texto corrido ou distribuídos por mensagens. Atualize todos os campos reconhecidos. Pergunte apenas os campos obrigatórios ainda vazios.

- Nunca invente informação nem considere um dado ausente como preenchido. Antes de concluir, verifique o que falta para o tipo de operação.



Se uma operação está em andamento e a Vovó fez uma pergunta, a próxima mensagem é provavelmente a RESPOSTA.







Respostas curtas ("Maria", "Pix", "Três", "18 reais", "Biriba", "20 unidades") NÃO são conversa se houver operação pendente. Use a última pergunta da Vovó para entender o significado:



- "Qual cliente comprou?" + "Maria" => comprador = "Maria"



- "Qual a forma de pagamento?" + "Pix" => forma_pagamento = "PIX"



- "Quantos potes?" + "Três" => quantidade = 3, tipo = "pote"







==================================================



REGRAS PARA VENDA



==================================================



Identifique: comprador, produto, quantidade, tipo da quantidade, tamanho do pote, preço unitário, forma de pagamento.



Tipos: "unidade", "pote", "caixa" ("2 caixas" => tipo caixa; "2 potes" => tipo pote).







Tamanho do pote: "20 unidades", "pote de 20" => "tamanho_pote": 20. "44 unidades", "pote de 44" => "tamanho_pote": 44.



Se o tamanho não for informado, NÃO invente.







Preço: nunca invente. "18 reais cada" ou "R$ 18" => "preco_unitario": 18.



"3 potes por 54 reais" => quantidade 3 e preco_unitario 18, quando o contexto permitir.



Se a gestora não informar preço, deixe "preco_unitario" ausente ou null (o sistema calcula).







Formas de pagamento válidas: DINHEIRO, PIX, CARTAO, BOLETO, CHEQUE, OUTRO.



"pix" => "PIX", "dinheiro" => "DINHEIRO", "cartão"/"cartao" => "CARTAO".



Se for cartão, informe também "tipo_cartao" (CREDITO ou DEBITO) e "parcelas" quando ditos.







==================================================



CLIENTE



==================================================



Compare o comprador com a lista de CLIENTES CADASTRADOS (sem diferenciar maiúsculas/minúsculas, aceitando pequenas variações).







CASO 1 — O cliente existe: monte a venda normalmente e NÃO inclua "novo_cliente". Use no campo "comprador" o nome exatamente como está no catálogo.







CASO 2 — O cliente NÃO existe: ele precisa ser cadastrado antes. Coloque o nome em "comprador" e use "novo_cliente" apenas com os dados que a gestora realmente informou. Os 8 dados obrigatórios do novo cliente são: nome completo ou razão social, telefone, CPF ou CNPJ, rua, número, bairro, cidade e estado (UF). E-mail é opcional.



NUNCA invente dados de cadastro. NUNCA preencha um campo que a gestora não disse. A palavra "para" (preposição) NÃO é o estado do Pará.



Os dados do cliente novo podem vir em várias mensagens; mantenha os anteriores.



Extraia cada campo separadamente. NÃO coloque número, bairro, cidade ou estado dentro do valor de endereço.







==================================================



COMPRA, PRODUÇÃO, GASTO



==================================================



Compra: matéria-prima, quantidade, unidade, valor total (somente IDs do catálogo).



Produção: produto, quantidade produzida, observações.



Gasto: descrição, valor, categoria. Se faltar descrição ou valor, pergunte.







==================================================



CONVERSA



==================================================



Use "conversa" somente quando a gestora estiver realmente conversando ("Oi", "Bom dia", "Obrigada").



Se existir operação em andamento, NÃO classifique resposta curta como conversa.







"Registrar uma venda", "Anota uma venda", "Tem uma venda" => intenção "venda"; peça o primeiro dado faltante (normalmente "Qual cliente comprou, meu bem?").







==================================================



ÁUDIO



==================================================



A mensagem pode ser transcrição de áudio: sem pontuação, números por extenso, sem acentos, frases longas e informais.



"três" = 3, "quatro" = 4, "vinte" = 20, "quarenta e quatro" = 44, "três vezes" = parcelas 3.



Exemplo: "Maria comprou tres potes de biriba por dezoito reais cada no pix" => comprador Maria, quantidade 3, produto Biriba, preco_unitario 18, forma_pagamento PIX.







==================================================



CORREÇÃO DE VENDA



==================================================



Se existir venda em ESTADO ATUAL, frases como "não, o cliente é...", "troca o cliente...", "o produto está errado...", "são quatro potes", "muda para Pix" são CORREÇÕES:



1\\. tipo = "venda".



2\\. Preserve todos os dados anteriores.



3\\. Altere somente o que a mensagem corrigir (todas as correções da mesma mensagem).



4\\. Nunca retorne venda vazia se o estado já tiver dados.



5\\. Nunca responda "conversa" ou "desconhecido" para uma correção clara.







==================================================



NUNCA FAÇA



==================================================



Nunca invente IDs, produtos, clientes, preços, quantidades, formas de pagamento, tamanhos de pote ou dados de cadastro.



Você NÃO registra nada: apenas interpreta. A aplicação Node.js executa a ação.







==================================================



FORMATO DE RESPOSTA



==================================================



Responda SOMENTE com um objeto JSON válido (chaves e textos entre aspas duplas).



Sem texto antes ou depois. Sem Markdown. A primeira coisa deve ser { e a última }.







CONVERSA:



{"tipo":"conversa","resposta":"texto curto","faltando":[],"perguntaProximo":null}







VENDA:



{"tipo":"venda","venda":{"comprador":"Maria","forma_pagamento":"PIX","itens":[{"produto_final_id":1,"produto_nome":"Biriba","quantidade":3,"preco_unitario":18,"tipo":"pote","tamanho_pote":20}]},"faltando":[],"perguntaProximo":null}







VENDA COM CLIENTE NOVO (somente campos informados pela gestora):



{"tipo":"venda","venda":{"comprador":"João","novo_cliente":{"telefone":"14999998888","documento":"87695234221","estado":"SP","cidade":"Marília","bairro":"Vila Nova","endereco":"Rua Arnaldo Melo","numero":"219"},"forma_pagamento":"DINHEIRO","itens":[{"produto_final_id":1,"produto_nome":"Paçoca","quantidade":3,"tipo":"pote","tamanho_pote":20}]},"faltando":[],"perguntaProximo":null}







COMPRA:



{"tipo":"compra","compras":[{"materia_prima_id":1,"produto_nome":"Açúcar","quantidade":10,"unidade":"kg","valor_total":50}],"faltando":[],"perguntaProximo":null}







PRODUÇÃO:



{"tipo":"producao","producao":{"produto_final_id":1,"produto_nome":"Biriba","potes":10,"observacoes":null},"faltando":[],"perguntaProximo":null}







GASTO:



{"tipo":"gasto","gasto":{"descricao":"Compra de material","categoria":"Material","valor":50},"faltando":[],"perguntaProximo":null}







DADOS FALTANDO:



{"tipo":"venda","venda":null,"faltando":["comprador"],"perguntaProximo":"Qual cliente comprou, meu bem?"}







Antes de responder, verifique mentalmente: há operação em andamento? Qual foi a última pergunta da Vovó? A mensagem atual a responde? O que já foi informado? O que falta? Existe ID no catálogo? Estou inventando algo? Responda SOMENTE com o JSON.



`;



}







// ============================================================



// EXTRAÇÃO DE JSON (lê só o texto final, nunca o "reasoning")



// ============================================================







function extrairJson(texto) {



  if (!texto || !String(texto).trim()) {



    throw new Error("A IA retornou uma resposta vazia.");



  }







  const limpo = String(texto)



    .replace(/```json/gi, "")



    .replace(/```/g, "")



    .trim();







  try {



    return JSON.parse(limpo);



  } catch (_) {



    // segue para a busca de objeto balanceado



  }







  for (let i = 0; i < limpo.length; i++) {



    if (limpo[i] !== "{") continue;







    let nivel = 0;



    let emTexto = false;



    let escapado = false;







    for (let j = i; j < limpo.length; j++) {



      const c = limpo[j];







      if (emTexto) {



        if (escapado) escapado = false;



        else if (c === "\\\\\\\\") escapado = true;



        else if (c === '"') emTexto = false;



        continue;



      }







      if (c === '"') emTexto = true;



      else if (c === "{") nivel++;



      else if (c === "}") {



        nivel--;



        if (nivel === 0) {



          try {



            return JSON.parse(limpo.slice(i, j + 1));



          } catch (_) {



            break; // tenta o próximo "{"



          }



        }



      }



    }



  }







  throw new Error("Nenhum JSON válido foi encontrado na resposta da IA.");



}







function textoDaMensagem(mensagem) {



  const c = mensagem?.content;



  if (typeof c === "string") return c;



  if (Array.isArray(c)) {



    return c.map((x) => (typeof x === "string" ? x : x?.text || "")).join("");



  }



  return "";



}







// ============================================================



// CHAMADA A UM PROVEDOR



// ============================================================







const esperar = (ms) => new Promise((r) => setTimeout(r, ms));







async function chamarProvedor(provedor, mensagens) {



  const inicio = Date.now();







  const resposta = await axios.post(



    provedor.url,



    {



      model: provedor.modelo,



      messages: mensagens,



      temperature: 0,



      ...(provedor.usaMaxCompletionTokens

        ? { max_completion_tokens: provedor.maxTokens }

        : { max_tokens: provedor.maxTokens }),





      ...provedor.corpoExtra,



    },



    {



      headers: {



        Authorization: `Bearer ${provedor.chave}`,



        "Content-Type": "application/json",



        ...provedor.headersExtras,



      },



      timeout: 45000,



    },



  );







  const choice = resposta.data?.choices?.[0];



  if (!choice?.message) {



    throw new Error("A IA não retornou nenhuma escolha (choices).");



  }







  if (choice.finish_reason === "length") {



    throw new Error("A resposta da IA foi cortada por limite de tokens.");



  }







  // IMPORTANTE: usa somente message.content. Nunca message.reasoning.



  const json = extrairJson(textoDaMensagem(choice.message));
  const vendaInterpretada = json?.venda && typeof json.venda === "object" ? json.venda : json;
  const itensInterpretados = Array.isArray(vendaInterpretada?.itens) ? vendaInterpretada.itens : [];

  console.log(
    `[IA] ${provedor.nome}/${provedor.modelo} respondeu em ${((Date.now() - inicio) / 1000).toFixed(1)}s`,
  );
  if (json?.tipo === "venda" || Array.isArray(vendaInterpretada?.itens)) {
    console.log(`[IA][VENDA] Itens interpretados: ${itensInterpretados.length}`, JSON.stringify(
      itensInterpretados.map((item) => ({
        produto: item?.produto_nome || item?.nome || item?.produto || item?.produto_final_id || item?.produtoId,
        quantidade: item?.quantidade ?? item?.quantidade_potes ?? item?.quantidade_caixas,
        tamanho: item?.tamanho ?? item?.tamanho_pote ?? item?.tipo_pote,
      })),
    ));
  }

  return json;



}







function erroTentaNovamente(error) {

  const status = error.response?.status;



  // Em rate limit, fazemos uma única nova tentativa após respeitar o tempo

  // informado pelo provedor. Se continuar limitado, o loop passa ao fallback.

  if (status === 429) return true;

  if (status && status >= 400 && status < 500) return false;

  if (status && status >= 500) return true;



  // Se a resposta foi cortada por tokens, repetir exatamente a mesma chamada

  // com o mesmo limite só desperdiça a cota. Vá direto para o próximo provedor.

  if (/limite de tokens|cortada por limite de tokens/i.test(error.message || "")) {

    return false;

  }



  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return true;

  if (!status) return true;

  return false;

}



function tempoEsperaRateLimit(error) {

  const retryAfter = error.response?.headers?.["retry-after"];



  if (retryAfter !== undefined && retryAfter !== null) {

    const segundos = Number(retryAfter);

    if (Number.isFinite(segundos) && segundos >= 0) {

      return Math.min(Math.ceil(segundos * 1000) + 500, 60000);

    }



    const dataRetry = Date.parse(retryAfter);

    if (Number.isFinite(dataRetry)) {

      return Math.min(Math.max(dataRetry - Date.now(), 0) + 500, 60000);

    }

  }



  const dados = error.response?.data;

  const mensagem = [

    dados?.error?.message,

    dados?.message,

    error.message,

  ].filter(Boolean).join(" ");



  const correspondencia = mensagem.match(/try again in\s+(\d+(?:\.\d+)?)\s*s/i);

  if (correspondencia) {

    return Math.min(Math.ceil(Number(correspondencia[1]) * 1000) + 750, 60000);

  }



  // Espera conservadora caso o provedor não informe o tempo de recuperação.

  return 8000;

}



function descreverErro(error) {



  const status = error.response?.status;



  const dados = error.response?.data;



  const detalhe =



    dados?.error?.message || dados?.message || error.message || String(error);



  return status ? `HTTP ${status}: ${detalhe}` : detalhe;



}







// ============================================================



// INTERPRETAÇÃO PRINCIPAL



// ============================================================







async function interpretarMensagem({



  texto,



  produtos,



  materiasPrimas,



  clientes,



  conversaPrevia,



  estadoAtual,



}) {



  validarConfiguracao();







  if (!texto || !texto.trim()) {



    throw new Error("A mensagem para a IA está vazia.");



  }







  const catalogo = montarCatalogo(produtos, materiasPrimas, clientes, {

    texto,

    estadoAtual,

    conversaPrevia,

  });







  const historico = Array.isArray(conversaPrevia)



    ? conversaPrevia.join("\n")



    : conversaPrevia || "";







  const mensagens = [



    { role: "system", content: montarSystemPrompt(catalogo) },



  ];







  if (historico.trim()) {



    mensagens.push({



      role: "user",



      content: `CONTEXTO DA CONVERSA EM ANDAMENTO (preserve as informações relevantes):







${historico}







FIM DO HISTÓRICO.`,



    });



  }







  if (estadoAtual) {



    mensagens.push({



      role: "user",



      content: `ESTADO ATUAL DA OPERAÇÃO (mantido pelo sistema):







${JSON.stringify(estadoAtual)}







REGRAS:



- Preserve todo campo válido que já exista.



- Se a mensagem corrigir um campo, substitua somente esse campo.



- Se a mensagem não mencionar um campo, mantenha o valor anterior.



- Nunca transforme campo preenchido em null ou vazio sem pedido explícito.



- Dados em "novo_cliente" só valem se a gestora realmente os informou.



FIM DO ESTADO ATUAL.`,



    });



  }







  mensagens.push({



    role: "user",



    content: `NOVA MENSAGEM DA GESTORA:







${texto.trim()}







Responda SOMENTE com o JSON.`,



  });







  const provedores = listarProvedores();



  const falhas = [];







  for (const provedor of provedores) {



    for (let tentativa = 1; tentativa <= 2; tentativa++) {



      try {



        console.log(



          `[IA] Consultando ${provedor.nome} (${provedor.modelo}), tentativa ${tentativa}/2...`,



        );



        return await chamarProvedor(provedor, mensagens);



      } catch (error) {



        const motivo = descreverErro(error);



        console.error(`[IA] Falha em ${provedor.nome}: ${motivo}`);







        const status = error.response?.status;



        if (status === 401 || status === 403) {



          falhas.push(`${provedor.nome}: chave inválida ou sem permissão`);



          break; // não adianta repetir; vai para o próximo provedor



        }







        if (tentativa < 2 && erroTentaNovamente(error)) {

          const esperaMs =

            status === 429

              ? tempoEsperaRateLimit(error)

              : 1500;



          console.warn(

            `[IA] Nova tentativa em ${Math.ceil(esperaMs / 1000)}s para ${provedor.nome}.`

          );



          await esperar(esperaMs);

          continue;

        }
        if (status === 429) {
          console.warn(`[IA] Limite 429 persistiu em ${provedor.nome}; tentando o próximo provedor configurado, se houver.`);
        }
        falhas.push(`${provedor.nome}: ${motivo}`);

        break;



      }



    }



  }







  throw new Error(`Não consegui consultar a IA. ${falhas.join(" | ")}`);



}







module.exports = {



  interpretarMensagem,



};

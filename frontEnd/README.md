# Vovó AI — Frontend

SPA em React, Vite e TanStack Router. Este repositório contém somente o frontend e consome a API Spring Boot.

## Executar

```bash
npm install
cp .env.example .env
npm run dev
```

A aplicação abre em `http://localhost:3000` e, por padrão, encaminha `/api` para `http://localhost:8080` pelo proxy do Vite.
No celular conectado à mesma rede, abra `http://<IP-do-computador>:3000`; configurações antigas com `localhost:8080` também são convertidas automaticamente para esse proxy durante o desenvolvimento.

Em um banco vazio, a tela oferece a conta inicial somente até a definição da primeira senha forte.

## Segurança e contrato do backend

- Segredos, credenciais de banco e chaves de IA devem existir somente no Spring Boot.
- O frontend não envia cookies de sessão. Configure CORS no Spring para aceitar apenas as origens conhecidas e o header `Authorization`.
- A sessão JWT fica em `localStorage` sob a chave `userSession`; as chamadas protegidas enviam `Authorization: Bearer <token>`.
- Respostas 401 encerram a sessão e redirecionam para o login. Respostas 403 preservam a sessão e indicam falta de permissão.
- O lançamento por áudio grava no navegador e envia `POST /assistente/transcrever-audio` como multipart. O backend usa o OpenRouter STT com a chave mantida no servidor e passa a transcrição para `POST /assistente/interpretar-voz`.
- Em conexões HTTP locais onde o navegador não libera `getUserMedia`, o botão oferece captura por arquivo (`accept="audio/*"`, `capture="user"`), que funciona no fluxo de gravação do próprio aparelho.
- O chat da Vovó AI espera `POST /assistente/conversa`, recebendo `{ mensagem, historico }` e retornando `{ resposta }`.
- Para produção, sirva a SPA com fallback para `index.html` e use HTTPS.

## Verificação de responsividade

```bash
npx playwright install chromium
npm run test:mobile
```

Os testes iniciam um Vite separado na porta 3010 e simulam dados da API, sem
alterar o banco. Verificam telas preenchidas, textos longos, valores financeiros,
rolagem com navegação fixa, filtros e modais em celular, paisagem, tablet e desktop.
Os testes usam as fontes locais de fallback para não depender do Google Fonts.
As capturas e resultados ficam em `test-results/` (ignorado pelo Git).

# Vovó AI — Frontend

SPA em React, Vite e TanStack Router. Este repositório contém somente o frontend e consome a API Spring Boot.

## Executar

```bash
npm install
cp .env.example .env
npm run dev
```

A aplicação abre em `http://localhost:3000` e, por padrão, usa a API em `http://localhost:8080/api/v1`.

Em um banco vazio, a tela oferece a conta inicial somente até a definição da primeira senha forte.

## Segurança e contrato do backend

- Segredos, credenciais de banco e chaves de IA devem existir somente no Spring Boot.
- O frontend não envia cookies de sessão. Configure CORS no Spring para aceitar apenas as origens conhecidas e o header `Authorization`.
- A sessão JWT fica em `localStorage` sob a chave `userSession`; as chamadas protegidas enviam `Authorization: Bearer <token>`.
- Respostas 401 encerram a sessão e redirecionam para o login. Respostas 403 preservam a sessão e indicam falta de permissão.
- O endpoint de voz esperado é `POST /assistente/interpretar-voz`; ele deve manter a chave do provedor de IA no backend.
- O chat da Vovó AI espera `POST /assistente/conversa`, recebendo `{ mensagem, historico }` e retornando `{ resposta }`.
- Para produção, sirva a SPA com fallback para `index.html` e use HTTPS.

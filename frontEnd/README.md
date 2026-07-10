# Vovó AI — Frontend

SPA em React, Vite e TanStack Router. Este repositório contém somente o frontend e consome a API Spring Boot.

## Executar

```bash
npm install
cp .env.example .env
npm run dev
```

A aplicação abre em `http://localhost:3000` e, por padrão, usa a API em `http://localhost:8080/api/v1`.

O botão **Pular login** aparece automaticamente em desenvolvimento. Para evitar um bypass acidental, ele fica desabilitado em builds de produção, exceto se `VITE_ENABLE_TEST_LOGIN=true` for definido explicitamente.

## Segurança e contrato do backend

- Segredos, credenciais de banco e chaves de IA devem existir somente no Spring Boot.
- O frontend envia cookies com `credentials: include`. Configure CORS no Spring para aceitar apenas as origens do frontend e habilitar credenciais.
- A autenticação recomendada é uma sessão ou JWT armazenado em cookie `HttpOnly`, `Secure` e `SameSite` apropriado.
- `X-Usuario-Id` existe apenas para compatibilidade com a API atual. O backend nunca deve confiar nesse cabeçalho para autorização; o usuário deve ser obtido da sessão autenticada.
- O endpoint de voz esperado é `POST /assistente/interpretar-voz`; ele deve manter a chave do provedor de IA no backend.
- O chat da Vovó AI espera `POST /assistente/conversa`, recebendo `{ mensagem, historico }` e retornando `{ resposta }`.
- Para produção, sirva a SPA com fallback para `index.html` e use HTTPS.

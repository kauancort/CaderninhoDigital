# Caderninho Digital - Backend

Backend do Caderninho Digital Inteligente, uma API REST em Java Spring Boot para gestão de usuários, clientes, fornecedores, produtos, matérias-primas, compras, produção, vendas, dashboard e insights operacionais.

## Tecnologias

- Java 21
- Spring Boot 3.3
- Maven
- Spring Web
- Spring Data JPA
- Bean Validation
- PostgreSQL 16
- Flyway
- Docker / Docker Compose
- Swagger / OpenAPI
- Lombok

## Como Rodar Com Docker

Este é o modo recomendado para desenvolvimento local, pois sobe API e banco juntos.

```bash
cd springBoot
docker compose up --build -d
```

Serviços:

```txt
API:   http://localhost:8080
PostgreSQL: localhost:5432
```

Swagger:

```txt
http://localhost:8080/swagger-ui.html
```

Ver containers:

```bash
docker compose ps
```

Ver logs da API:

```bash
docker compose logs -f api
```

Parar containers:

```bash
docker compose down
```

Parar e apagar o banco local:

```bash
docker compose down -v
```

Use `down -v` apenas quando quiser apagar todos os dados locais do PostgreSQL.

## Como Rodar Sem Docker Para a API

Também é possível rodar apenas o PostgreSQL no Docker e executar a API localmente com Maven.

```bash
cd springBoot
docker compose up -d postgres
./mvnw spring-boot:run
```

Neste modo, a API usa o PostgreSQL em `localhost:5432`.

## Banco De Dados Local

Configuração padrão do Docker Compose:

```txt
Database: caderninho_digital
User:     caderninho_user
Password: caderninho_pass
Root:     root
Port:     5432
```

## Variáveis De Ambiente

A aplicação aceita variáveis de ambiente para facilitar deploy e uso no Render.

```txt
PORT
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
SPRING_JPA_HIBERNATE_DDL_AUTO
SPRING_JPA_SHOW_SQL
SPRING_FLYWAY_ENABLED
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
GMAIL_SENDER
```

Valores locais padrão:

```txt
PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/caderninho_digital
SPRING_DATASOURCE_USERNAME=caderninho_user
SPRING_DATASOURCE_PASSWORD=caderninho_pass
SPRING_JPA_HIBERNATE_DDL_AUTO=validate
SPRING_JPA_SHOW_SQL=false
SPRING_FLYWAY_ENABLED=true
```

Para habilitar a recuperação de senha, ative a Gmail API no Google Cloud e
autorize a conta remetente com o escopo mínimo `gmail.send`:

```txt
GMAIL_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=seu-client-secret
GMAIL_REFRESH_TOKEN=seu-refresh-token
GMAIL_SENDER=docevocida12@gmail.com
```

Essas variáveis pertencem exclusivamente à API. Não as adicione ao frontend e
jamais versione seus valores reais.

## Assistente empresarial

O assistente usa a IA somente para interpretar a pergunta, gerar um plano fechado
e explicar resultados já validados. O modelo não recebe acesso ao banco, não
escolhe a empresa e não executa cálculos financeiros:

```txt
pergunta -> planejador IA -> validação do plano -> ferramentas permitidas
         -> consultas por empresa -> cálculos do backend -> resultado seguro
         -> explicação IA (ou texto determinístico de fallback)
```

Os planos aceitam apenas ferramentas e argumentos definidos nos contratos Java,
com limite configurável e sem execução recursiva. O `empresaId` é derivado do
usuário autenticado e aplicado internamente às consultas. Tavily é chamado apenas
pela ferramenta de mercado e seus resultados possuem cache temporário.

Configuração principal:

```txt
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it
AI_SEARCH_INTERPRETATION_TIMEOUT_MS=300000
AI_REQUEST_BUDGET_MILLIS=345000
AI_MAX_OUTPUT_TOKENS=1000
AI_MAX_TOOLS_PER_PLAN=5
AI_MAX_TOOL_CALLS=5
AI_MAX_MARKET_SEARCHES_PER_REQUEST=1
TAVILY_CANDIDATE_RESULTS=15
TAVILY_MAX_RESULTS=5
TAVILY_MAX_SNIPPET_CHARACTERS=4000
AI_MARKET_SEARCH_CACHE_MINUTES=30
```

O planejamento e a extração usam `response_format=json_schema`, schema estrito,
`additionalProperties=false`, roteamento somente para provedores compatíveis e
uma segunda validação no backend. A configuração segue a documentação oficial de
[saídas estruturadas](https://openrouter.ai/docs/guides/features/structured-outputs)
e o catálogo do modelo
[Gemma 4 26B A4B](https://openrouter.ai/google/gemma-4-26b-a4b-it/providers).

Falhas do planejamento tentam somente fast paths determinísticos compatíveis.
Falha na extração preserva as fontes e só admite evidência explícita; falha na
redação final reutiliza os fatos e cálculos já concluídos. Uma execução de
ferramenta nunca é repetida como se fosse falha de planejamento.

Consultas claras de rentabilidade de produto usam um caminho mais curto:

```txt
produto cadastrado + intenção de margem/prejuízo/preço
  -> ANALISAR_RENTABILIDADE_PRODUTO (sem planejamento por IA)
  -> custo conhecido + vendas reais + modalidades no backend
  -> uma busca econômica no Tavily, quando habilitada
  -> uma redação final curta no OpenRouter, com fallback determinístico
```

O custo unitário usa a média ponderada das produções no período
(`soma dos custos históricos dos insumos / quantidade produzida`). Se não há
produção no período, o resultado identifica explicitamente o uso do
`custo_atual` cadastrado. A análise nunca chama essa margem conhecida de lucro
líquido e lista custos não disponíveis. Preços externos só entram na faixa de
mercado após normalização no backend e classificação de comparabilidade; fontes
de comparabilidade baixa permanecem apenas como referência.

No caminho ideal são feitas zero chamadas de IA para planejamento, zero para
extração (quando o preço e a unidade estão explícitos) e uma para a resposta
final. Os logs `evento=USO_MODELO` registram somente modelo, tokens, latência e
`tipoDaChamada` (`PLANEJAMENTO`, `EXTRACAO` ou `RESPOSTA_FINAL`), sem prompts.

### Autorizar a conta remetente

O envio usa uma única conta do Gmail e um `refresh_token`; portanto, a aplicação
não precisa expor um callback OAuth próprio:

1. No Google Cloud, ative a **Gmail API**.
2. Configure a tela de consentimento e adicione `docevocida12@gmail.com` como
   usuário de teste enquanto o aplicativo estiver em modo de teste.
3. Crie um OAuth Client ID do tipo **Web application**.
4. Em **Authorized redirect URIs**, cadastre exatamente:
   `https://developers.google.com/oauthplayground`.
5. No OAuth 2.0 Playground, abra as configurações, marque **Use your own OAuth
   credentials** e informe o Client ID e o Client Secret.
6. Autorize apenas o escopo
   `https://www.googleapis.com/auth/gmail.send`, usando acesso offline.
7. Troque o código pelo `refresh_token` e configure as quatro variáveis acima no
   Render.

Enquanto a tela OAuth externa estiver em **Testing**, o refresh token para esse
escopo expira em 7 dias. Para uso contínuo em produção, altere o status de
publicação do aplicativo e cumpra as exigências apresentadas pelo Google Cloud.

O backend renova o access token em `https://oauth2.googleapis.com/token` e envia
a mensagem por `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`.
São chamadas HTTPS de saída; não é necessário abrir porta ou criar rota pública
adicional no Render.

Dentro do Docker Compose, a API usa `postgres` como host do banco:

```txt
jdbc:postgresql://postgres:5432/caderninho_digital
```

## Flyway

O versionamento do banco é feito com Flyway.

As migrations ficam em:

```txt
src/main/resources/db/migration
```

Migration inicial:

```txt
V1__create_initial_schema.sql
```

O Hibernate está configurado com:

```txt
ddl-auto=validate
```

Isso significa que o Hibernate não cria nem altera tabelas automaticamente. Ele apenas valida se o schema do banco está compatível com as entidades. Alterações no banco devem ser feitas por novas migrations Flyway.

Exemplo de próxima migration:

```txt
V2__add_campo_exemplo.sql
```

## Testes

Rodar testes:

```bash
cd springBoot
./mvnw test
```

Os testes usam Testcontainers com PostgreSQL 16 real. Docker deve estar ativo ao executar a suíte.

## Endpoints Principais

Autenticação:

```txt
POST /api/v1/auth/login
POST /api/v1/auth/primeiro-acesso
GET  /api/v1/auth/bootstrap-status
GET  /api/v1/usuarios
POST /api/v1/usuarios
```

Cadastros:

```txt
/api/v1/clientes
/api/v1/fornecedores
/api/v1/produtos
/api/v1/materias-primas
```

Operações:

```txt
/api/v1/compras-materias-primas
/api/v1/producoes
/api/v1/vendas
/api/v1/lancamentos
```

Dashboard e insights:

```txt
GET  /api/v1/dashboard/resumo
GET  /api/v1/insights
POST /api/v1/insights/gerar
```

## Autenticação JWT

O login retorna um JWT Bearer válido por 24 horas. Requisições protegidas usam:

```bash
curl http://localhost:8080/api/v1/produtos \
  -H "Authorization: Bearer $TOKEN"
```

A API é stateless e não utiliza sessão HTTP ou `X-Usuario-Id`. O usuário é obtido exclusivamente do `SecurityContext`. Configure `JWT_SECRET` com pelo menos 32 bytes; alterar o segredo invalida tokens emitidos anteriormente.

## Fluxo Básico Para Testar

1. Cadastrar gestor.
2. Fazer login.
3. Cadastrar cliente.
4. Cadastrar fornecedor.
5. Cadastrar produto.
6. Cadastrar matéria-prima.
7. Registrar compra de matéria-prima.
8. Registrar produção usando a matéria-prima.
9. Registrar venda do produto.
10. Consultar dashboard e insights.

## Deploy No Render

Para deploy no Render, use o `Dockerfile` da API. O `render.yaml` na raiz
provisiona somente a API; o banco PostgreSQL de produção é externo e fica no
Supabase.

Configure manualmente no serviço do Render:

```txt
SPRING_DATASOURCE_URL=jdbc:postgresql://<host-do-session-pooler>:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=postgres.<project-ref>
SPRING_DATASOURCE_PASSWORD=<senha-do-banco>
SPRING_JPA_HIBERNATE_DDL_AUTO=validate
SPRING_FLYWAY_ENABLED=true
JWT_SECRET=um-segredo-persistente-com-pelo-menos-32-bytes
GMAIL_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=seu-client-secret
GMAIL_REFRESH_TOKEN=seu-refresh-token
GMAIL_SENDER=docevocida12@gmail.com
```

Copie host, usuário e porta de `Connect > Session pooler` no Supabase. As três
credenciais são segredos `sync: false`: seus valores ficam somente no painel do
Render e nunca no repositório. O Flyway aplica as migrations pendentes durante a
inicialização da API.

O `docker-compose.yml` e seus valores locais não são afetados por essa
configuração de produção.

# Caderninho Digital

Sistema de gestão para a produção e venda de Biriba, Fondant de leite e Paçoca. Este repositório reúne o frontend React e a API Spring Boot.

## Estrutura

```text
CaderninhoDigital/
├── frontEnd/    # React 19, TypeScript e Vite
└── springBoot/  # Java 21, Spring Boot e PostgreSQL
```

## Dependências

Para a forma recomendada de execução:

- Docker e Docker Compose;
- Node.js 20 ou superior;
- npm 10 ou superior.

Para executar o backend sem Docker também são necessários:

- Java 21;
- PostgreSQL 16;
- Maven não precisa ser instalado separadamente, pois o projeto possui Maven Wrapper.

## Executar o backend com Docker

Entre na pasta do backend e suba a API e o PostgreSQL:

```bash
cd springBoot
docker compose up -d --build
```

A API estará disponível em `http://localhost:8080`. O Swagger pode ser acessado em `http://localhost:8080/swagger-ui.html`.

Para acompanhar os logs:

```bash
docker compose logs -f api
```

Para interromper os containers sem apagar o banco:

```bash
docker compose down
```

Não use `docker compose down -v` se quiser preservar os dados. O parâmetro `-v` remove o volume do PostgreSQL.

## Executar o frontend

Com o backend em execução, abra outro terminal:

```bash
cd frontEnd
cp .env.example .env
npm install
npm run dev
```

O frontend estará disponível em `http://localhost:3000` e usará, por padrão, a API em `http://localhost:8080/api/v1`.

As variáveis locais ficam no arquivo `frontEnd/.env`, que não é versionado. O modelo seguro para configuração está em `frontEnd/.env.example`:

```env
VITE_API_URL="http://localhost:8080/api/v1"
```

Em builds de produção, o frontend usa por padrão `https://caderninho-digital-api.onrender.com/api/v1`. A variável `VITE_API_URL` pode sobrescrever esse endereço em qualquer ambiente.

## Executar o backend sem Docker

Crie um banco PostgreSQL chamado `caderninho_digital` e um usuário compatível com as configurações abaixo, ou forneça suas próprias variáveis de ambiente:

```bash
cd springBoot
export SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/caderninho_digital'
export SPRING_DATASOURCE_USERNAME='caderninho_user'
export SPRING_DATASOURCE_PASSWORD='caderninho_pass'
export JWT_SECRET='desenvolvimento-local-com-no-minimo-32-bytes'
./mvnw spring-boot:run
```

O Flyway cria e atualiza as tabelas automaticamente quando a API inicia. A carga inicial inclui Biriba, Fondant de leite, Paçoca, suas matérias-primas e seus gabaritos.

## Testes e verificações

Backend:

```bash
cd springBoot
./mvnw test
```

Frontend:

```bash
cd frontEnd
npm run lint
npm run build
```

## Atualizar uma instalação existente

Depois de baixar novas alterações, reconstrua os containers sem remover o volume:

```bash
cd springBoot
docker compose up -d --build
```

As migrations pendentes serão aplicadas automaticamente no banco existente.

## Deploy no Render

O arquivo `render.yaml` da raiz cria a API Docker no Render. Em produção, a API
usa um PostgreSQL externo no Supabase; o PostgreSQL do `docker-compose.yml`
continua exclusivo do ambiente local.

Antes do primeiro deploy, configure manualmente estas variáveis no serviço da
API no Render:

```txt
SPRING_DATASOURCE_URL=jdbc:postgresql://<host-do-session-pooler>:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=postgres.<project-ref>
SPRING_DATASOURCE_PASSWORD=<senha-do-banco>
```

Use os dados exibidos em `Connect > Session pooler` no painel do Supabase. As
credenciais são declaradas com `sync: false` no Blueprint para nunca serem
versionadas. Em serviços já existentes, alterações no `render.yaml` não
preenchem esses segredos; mantenha os valores configurados diretamente no
painel do Render.

O Flyway executa as migrations pendentes quando a API inicia e o health check
usa `/actuator/health`.

O Blueprint também gera `JWT_SECRET`. Esse valor deve permanecer estável: alterá-lo invalida todas as sessões ativas. Em uma instalação vazia, use a conta inicial `adm@gmail.com` / `123` e defina imediatamente uma senha forte.

Depois de validar o health check, o login e uma operação de escrita no Supabase,
o antigo PostgreSQL do Render pode ser excluído manualmente. Os planos gratuitos
são apropriados para homologação; revise persistência e backups antes de
armazenar dados reais.

## Repositório

Remoto oficial:

```text
git@github.com:kauancort/CaderninhoDigital.git
```

Arquivos `.env`, dependências (`node_modules`), builds (`dist`, `.output`, `target`) e dados locais do Docker não devem ser enviados ao Git.

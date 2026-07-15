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
DB_HOST
DB_PORT
DB_NAME
DB_USERNAME
DB_PASSWORD
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
POST /api/v1/auth/cadastro
POST /api/v1/auth/login
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

## Autenticação Temporária

Nesta versão ainda não há JWT. Após login, o frontend deve usar o `usuarioId` retornado e enviar nas requisições protegidas:

```txt
X-Usuario-Id: 1
```

Exemplo:

```bash
curl http://localhost:8080/api/v1/produtos \
  -H "X-Usuario-Id: 1"
```

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

Para deploy no Render, use o `Dockerfile` da API ou configure build Maven.

O `render.yaml` na raiz provisiona a API e um PostgreSQL gerenciado usando a rede interna do Render.

Configure no Render:

```txt
PORT
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
SPRING_JPA_HIBERNATE_DDL_AUTO=validate
SPRING_FLYWAY_ENABLED=true
```

O `docker-compose.yml` é apenas para desenvolvimento local.

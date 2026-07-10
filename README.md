# Caderninho Digital

Sistema de gestão para a produção e venda de Biriba, Fondant de leite e Paçoca. Este repositório reúne o frontend React e a API Spring Boot.

## Estrutura

```text
CaderninhoDigital/
├── frontEnd/    # React 19, TypeScript e Vite
└── springBoot/  # Java 21, Spring Boot e MySQL
```

## Dependências

Para a forma recomendada de execução:

- Docker e Docker Compose;
- Node.js 20 ou superior;
- npm 10 ou superior.

Para executar o backend sem Docker também são necessários:

- Java 21;
- MySQL 8;
- Maven não precisa ser instalado separadamente, pois o projeto possui Maven Wrapper.

## Executar o backend com Docker

Entre na pasta do backend e suba a API e o MySQL:

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

Não use `docker compose down -v` se quiser preservar os dados. O parâmetro `-v` remove o volume do MySQL.

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
VITE_ENABLE_TEST_LOGIN="false"
```

## Executar o backend sem Docker

Crie um banco MySQL chamado `caderninho_digital` e um usuário compatível com as configurações abaixo, ou forneça suas próprias variáveis de ambiente:

```bash
cd springBoot
export SPRING_DATASOURCE_URL='jdbc:mysql://localhost:3306/caderninho_digital?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Sao_Paulo'
export SPRING_DATASOURCE_USERNAME='caderninho_user'
export SPRING_DATASOURCE_PASSWORD='caderninho_pass'
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

## Repositório

Remoto oficial:

```text
git@github.com:kauancort/CaderninhoDigital.git
```

Arquivos `.env`, dependências (`node_modules`), builds (`dist`, `.output`, `target`) e dados locais do Docker não devem ser enviados ao Git.

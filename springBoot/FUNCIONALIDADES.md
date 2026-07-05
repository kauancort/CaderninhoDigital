# Funcionalidades Do Backend

Este documento resume as funcionalidades atuais do backend do Caderninho Digital.

## Visão Geral

O backend controla a rotina operacional e financeira de uma pequena produção de doces. O fluxo principal cobre:

- cadastro e login de usuários gestores;
- cadastro de clientes e fornecedores;
- cadastro de matérias-primas;
- cadastro de produtos finais com gabarito de produção;
- compras de matérias-primas;
- produções com cálculo automático de insumos pelo gabarito;
- vendas com baixa de estoque;
- lançamentos financeiros genéricos;
- dashboard por período;
- insights simples baseados em regras.

## Autenticação Atual

Ainda não existe JWT nem Spring Security.

Fluxo atual:

1. O usuário faz cadastro.
2. O usuário faz login com e-mail e senha.
3. O backend retorna `usuarioId`.
4. As rotas protegidas recebem o header:

```txt
X-Usuario-Id: 1
```

Nesta versão, apenas usuários com perfil `GESTOR` podem usar as funcionalidades principais.

## Usuários

A entidade `Usuario` representa quem acessa o sistema.

Campos principais:

- nome;
- e-mail;
- senha;
- cargo/função;
- perfil;
- data de criação.

Perfis:

```txt
GESTOR
FUNCIONARIO
```

O perfil `FUNCIONARIO` existe na modelagem, mas ainda não possui permissões próprias.

## Clientes

Clientes representam quem compra os produtos.

Campos principais:

- nome;
- e-mail;
- telefone;
- documento;
- endereço;
- status ativo;
- gestor que cadastrou.

Clientes não pertencem a um gestor como dono do cadastro. O backend apenas registra `gestorId` e `gestorNome` para mostrar quem cadastrou.

Endpoints:

```txt
POST   /api/v1/clientes
GET    /api/v1/clientes
GET    /api/v1/clientes/{id}
PUT    /api/v1/clientes/{id}
DELETE /api/v1/clientes/{id}
```

## Fornecedores

Fornecedores representam empresas ou pessoas que vendem matéria-prima, embalagens ou outros insumos.

Campos principais:

- nome;
- e-mail;
- telefone;
- documento;
- endereço;
- status ativo;
- gestor que cadastrou.

Fornecedores não pertencem a um gestor como dono do cadastro. O backend apenas registra `gestorId` e `gestorNome` para mostrar quem cadastrou.

Endpoints:

```txt
POST   /api/v1/fornecedores
GET    /api/v1/fornecedores
GET    /api/v1/fornecedores/{id}
PUT    /api/v1/fornecedores/{id}
DELETE /api/v1/fornecedores/{id}
```

## Produtos

Produtos são os itens finais vendidos pela empresa.

Produtos esperados para a operação atual:

- paçoca;
- biriba;
- fondant de leite.

Campos principais:

- nome;
- descrição;
- unidade de medida;
- preço de venda;
- estoque atual;
- status ativo;
- gestor dono do produto;
- gabarito de produção.

O estoque do produto aumenta quando uma produção é registrada e diminui quando uma venda é registrada.

Endpoints:

```txt
POST   /api/v1/produtos
GET    /api/v1/produtos
GET    /api/v1/produtos/{id}
PUT    /api/v1/produtos/{id}
DELETE /api/v1/produtos/{id}
```

## Gabarito De Produção

O gabarito é a receita/tutorial de produção de um produto.

Estrutura:

- produto;
- quantidade base;
- observação ou modo de preparo;
- lista de matérias-primas necessárias.

Cada item do gabarito possui:

- matéria-prima;
- quantidade necessária para a quantidade base.

Exemplo conceitual:

```txt
Produto: Paçoca
Quantidade base: 100 unidades
Amendoim: 5 kg
Açúcar: 2 kg
Embalagem: 100 unidades
```

Ao lançar uma produção, o backend calcula proporcionalmente:

```txt
fator = quantidadeProduzida / quantidadeBase
quantidadeUtilizada = quantidadeNecessaria * fator
```

Exemplo:

```txt
Base: 100 unidades usa 5 kg de amendoim
Produção: 300 unidades
Uso calculado: 15 kg de amendoim
```

O gabarito fica dentro do cadastro/edição de produto.

## Matérias-Primas

Matérias-primas são os insumos usados na produção.

Exemplos:

- amendoim;
- açúcar;
- embalagem;
- leite;
- chocolate.

Campos principais:

- nome;
- descrição;
- unidade de medida;
- estoque atual;
- estoque mínimo;
- custo médio;
- status ativo;
- gestor dono do cadastro.

O estoque da matéria-prima aumenta em compras e diminui em produções.

Endpoints:

```txt
POST   /api/v1/materias-primas
GET    /api/v1/materias-primas
GET    /api/v1/materias-primas/{id}
PUT    /api/v1/materias-primas/{id}
DELETE /api/v1/materias-primas/{id}
```

## Compras De Matéria-Prima

Uma compra registra entrada de matéria-prima no estoque.

Ela pode estar vinculada a um fornecedor, mas o fornecedor só precisa existir. Ele não precisa pertencer ao gestor que está lançando a compra.

Uma compra possui:

- fornecedor;
- data da compra;
- forma de pagamento;
- status de pagamento;
- observação;
- valor total;
- lista de itens comprados.

Ao registrar uma compra:

1. O backend valida o gestor.
2. O backend valida o fornecedor, se informado.
3. O backend valida cada matéria-prima do gestor.
4. O estoque da matéria-prima aumenta.
5. O custo médio da matéria-prima é recalculado.
6. A compra é salva.

Endpoints:

```txt
POST /api/v1/compras-materias-primas
GET  /api/v1/compras-materias-primas
GET  /api/v1/compras-materias-primas/{id}
```

## Produções

Uma produção registra a transformação de matérias-primas em produto final.

Fluxo recomendado:

1. O frontend mostra os cards de produtos, como paçoca, biriba e fondant de leite.
2. O usuário escolhe o produto.
3. O usuário informa a quantidade produzida.
4. O backend usa o gabarito do produto para calcular os insumos.
5. O backend baixa o estoque das matérias-primas.
6. O backend aumenta o estoque do produto final.
7. O backend calcula o custo estimado.

Payload recomendado:

```json
{
  "produtoId": 1,
  "dataProducao": "2026-07-05",
  "quantidadeProduzida": 300,
  "observacao": "Produção da manhã"
}
```

Também existe suporte a insumos manuais no payload, caso seja necessário sobrescrever o gabarito em uma produção específica.

Endpoints:

```txt
POST /api/v1/producoes
GET  /api/v1/producoes
GET  /api/v1/producoes?produtoId=1
GET  /api/v1/producoes/{id}
```

Uso esperado no frontend:

- `GET /api/v1/producoes`: histórico geral;
- `GET /api/v1/producoes?produtoId=1`: histórico individual do card do produto.

## Vendas

Uma venda registra saída de produto final e receita financeira.

Ela pode estar vinculada a um cliente, mas o cliente só precisa existir. Ele não precisa pertencer ao gestor que está lançando a venda.

Uma venda possui:

- cliente;
- data da venda;
- forma de pagamento;
- status de pagamento;
- valor total;
- observação;
- lista de itens vendidos.

Ao registrar uma venda:

1. O backend valida o gestor.
2. O backend valida o cliente, se informado.
3. O backend valida cada produto do gestor.
4. O backend verifica se existe estoque suficiente do produto.
5. O estoque do produto é reduzido.
6. O total da venda é calculado.
7. A venda é salva.

Endpoints:

```txt
POST /api/v1/vendas
GET  /api/v1/vendas
GET  /api/v1/vendas/{id}
```

## Lançamentos Genéricos

`Lancamento` é um registro financeiro ou operacional genérico.

Tipos:

```txt
VENDA
COMPRA_PRODUTO
PRODUCAO
GASTO_GERAL
```

Ele foi mantido para casos simples e gastos gerais. As operações principais usam entidades próprias:

- `Venda`;
- `CompraMateriaPrima`;
- `Producao`.

Endpoints:

```txt
POST   /api/v1/lancamentos
GET    /api/v1/lancamentos
GET    /api/v1/lancamentos/{id}
PUT    /api/v1/lancamentos/{id}
DELETE /api/v1/lancamentos/{id}
```

## Dashboard

O dashboard resume dados por período.

Endpoint:

```txt
GET /api/v1/dashboard/resumo?inicio=2026-07-01&fim=2026-07-31
```

Retorna:

- total de vendas;
- total de compras de matéria-prima;
- total de produção em custo estimado;
- total de gastos gerais;
- saldo estimado;
- total pendente;
- quantidade de registros.

## Insights

Insights são mensagens simples geradas por regras fixas. Ainda não existe integração com IA externa.

Endpoints:

```txt
POST /api/v1/insights/gerar
GET  /api/v1/insights
```

O backend analisa:

- quantidade de registros operacionais;
- vendas;
- compras;
- gastos;
- pagamentos pendentes;
- estoque de matéria-prima abaixo do mínimo.

## Controle De Estoque

Entrada de matéria-prima:

```txt
CompraMateriaPrima -> aumenta estoque de MateriaPrima
```

Consumo de matéria-prima:

```txt
Producao -> reduz estoque de MateriaPrima
```

Entrada de produto final:

```txt
Producao -> aumenta estoque de Produto
```

Saída de produto final:

```txt
Venda -> reduz estoque de Produto
```

Regras importantes:

- venda não pode passar do estoque disponível do produto;
- produção não pode passar do estoque disponível da matéria-prima;
- compra recalcula custo médio da matéria-prima;
- produção automática usa o gabarito do produto;
- produção calcula custo estimado com base no custo médio dos insumos.

## Fluxo Principal Do Sistema

1. Cadastrar gestor.
2. Fazer login.
3. Cadastrar fornecedores.
4. Cadastrar clientes.
5. Cadastrar matérias-primas.
6. Cadastrar produtos com gabarito.
7. Registrar compras de matérias-primas.
8. Registrar produções pela quantidade produzida.
9. Registrar vendas de produtos.
10. Consultar dashboard.
11. Gerar insights.

## Banco E Migrations

O banco é versionado com Flyway e o Hibernate usa `validate`.

Migrations atuais:

```txt
V1__create_initial_schema.sql
V2__create_produto_gabarito_itens.sql
V3__normalize_produto_gabaritos.sql
```

Qualquer alteração estrutural futura deve ser feita por nova migration.

## Situação Atual Da Segurança

Nesta versão:

- não há JWT;
- não há Spring Security;
- a senha ainda está em texto puro;
- o usuário é identificado pelo header `X-Usuario-Id`.

Próximos passos recomendados:

- implementar Spring Security;
- usar BCrypt para senhas;
- implementar JWT;
- remover o header temporário `X-Usuario-Id`;
- criar permissões reais para funcionários.

## Resumo

O backend já possui uma base para:

- cadastros principais;
- gabarito de produção por produto;
- estoque;
- compra;
- produção automática por gabarito;
- venda;
- dashboard;
- insights;
- versionamento de banco.

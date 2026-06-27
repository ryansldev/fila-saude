# fila-saude

Vamos tornar a espera nos postos de saúde mais tranquila? 💙

Monorepo com a API (Fastify), o frontend (Next.js) e pacotes compartilhados. O gerenciamento de tarefas é feito com [Turborepo](https://turbo.build/).

## Estrutura do projeto

```
fila-saude/
├── apps/
│   ├── api/           # API REST (Fastify + Drizzle + PostgreSQL)
│   └── web/           # Frontend (Next.js + React + Tailwind CSS)
└── packages/
    └── schemas/       # Schemas Zod compartilhados (@fila-saude/schemas)
```

## Pré-requisitos

- [Node.js](https://nodejs.org/) >= 24.x
- [Docker](https://www.docker.com/) (para o PostgreSQL local)
- npm 11.x (gerenciado via `packageManager` no `package.json` raiz)

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

A API carrega variáveis a partir de arquivos `.env.{NODE_ENV}` em `apps/api/`. Crie ou ajuste os arquivos conforme o ambiente:

| Arquivo              | Uso                          |
| -------------------- | ---------------------------- |
| `.env.development`   | Desenvolvimento local        |
| `.env.test`          | Testes de integração         |

Variáveis obrigatórias:

| Variável             | Descrição                              |
| -------------------- | -------------------------------------- |
| `POSTGRES_USER`      | Usuário do PostgreSQL                  |
| `POSTGRES_PASSWORD`  | Senha do PostgreSQL                    |
| `POSTGRES_DB`        | Nome do banco de dados                 |
| `POSTGRES_PORT`      | Porta do PostgreSQL                    |
| `POSTGRES_HOST`      | Host do PostgreSQL                     |
| `DATABASE_URL`       | URL de conexão completa                |

Exemplo (`apps/api/.env.development` e `apps/api/.env.test`):

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres_dev
POSTGRES_PORT=5432
POSTGRES_HOST=localhost
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres_dev
```

### 3. Subir o banco de dados

```bash
npm run services:up
```

Isso inicia um container PostgreSQL 18 via Docker Compose (`apps/api/infra/compose.yml`).

Ao rodar `npm run dev`, `npm run dev -w @fila-saude/api` ou `npm test`, o PostgreSQL é iniciado automaticamente.

### 4. Aplicar o schema do banco (quando houver migrations)

```bash
npm run db:push      # sincroniza o schema com o banco
npm run db:generate  # gera arquivos de migration
npm run db:migrate   # executa migrations pendentes
```

## Desenvolvimento

Inicia a API e o frontend em paralelo:

```bash
npm run dev
```

| Serviço  | URL                     |
| -------- | ----------------------- |
| API      | http://localhost:3333   |
| Frontend | http://localhost:3000   |

Para rodar apenas um workspace:

```bash
npm run dev -w @fila-saude/api
npm run dev -w @fila-saude/web
```

## API

### Endpoints

#### `GET /v1/status`

Retorna o status da API e das dependências (banco de dados). A resposta é validada pelo schema compartilhado em `@fila-saude/schemas/status`.

**Resposta de exemplo:**

```json
{
  "updated_at": "2026-06-26T12:00:00.000Z",
  "dependencies": {
    "database": {
      "version": "18.4",
      "connections": {
        "max": 100,
        "total": 1,
        "idle": 0,
        "waiting": 0
      }
    }
  }
}
```

As rotas são carregadas automaticamente pelo `@fastify/autoload` a partir de `apps/api/routes/`.

## Testes

Os testes de integração sobem o PostgreSQL, iniciam a API e executam o Vitest automaticamente:

```bash
npm test
```

Outros comandos:

```bash
npm run test:watch     # modo watch
npm run test:coverage  # cobertura de código
```

## Scripts disponíveis

| Script              | Descrição                                      |
| ------------------- | ---------------------------------------------- |
| `dev`               | Inicia todos os apps em modo desenvolvimento   |
| `build`             | Build de produção                              |
| `lint`              | Verifica lint em todos os workspaces           |
| `lint:fix`          | Corrige problemas de lint                      |
| `format`            | Formata o código (Biome)                       |
| `test`              | Sobe serviços, API e executa testes da API     |
| `test:watch`        | Testes em modo watch                           |
| `test:coverage`     | Testes com cobertura de código                 |
| `services:up`       | Sobe o PostgreSQL via Docker                   |
| `services:stop`     | Para os containers                             |
| `services:down`     | Remove os containers                           |
| `db:push`           | Sincroniza schema Drizzle com o banco          |
| `db:generate`       | Gera migrations Drizzle                        |
| `db:migrate`        | Executa migrations                             |
| `commit`            | Commit interativo com Commitizen               |

## CI

Em pull requests, o GitHub Actions executa:

- **Linting** — `npm run lint` (Biome) e validação de mensagens de commit (Commitlint)
- **Testes** — `npm run test` (Vitest com PostgreSQL via Docker)

## Stack

| Camada     | Tecnologias                                      |
| ---------- | ------------------------------------------------ |
| API        | Fastify, Drizzle ORM, PostgreSQL, Zod, Vitest    |
| Frontend   | Next.js 16, React 19, Tailwind CSS 4             |
| Monorepo   | Turborepo, npm workspaces                        |
| Qualidade  | Biome, Husky, Commitlint, Commitizen             |

## Licença

[MIT](LICENSE)

# Docs da API com Fumadocs — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** docs públicas do Fila Saúde em `/docs`, com guias em MDX e a referência da API v1 gerada do código (nunca escrita à mão), prontas para receber uma v2 sem refazer nada.

**Architecture:** cada rota da API declara seus schemas zod no próprio Fastify (`schema: { params, querystring, body, response }`) com o `fastify-type-provider-zod`. O Fastify valida a entrada antes do handler, e um tratador de erro mantém o formato do PD-22. O `@fastify/swagger` monta o OpenAPI 3.1 a partir das rotas registradas, e um script grava o `apps/api/openapi/v1.json`. O `apps/web` recebe o Fumadocs, e o `fumadocs-openapi` lê o `v1.json` dentro de uma pasta-raiz `v1`.

**Tech Stack:** `fastify-type-provider-zod` 7.x, `@fastify/swagger` 9.x, Fumadocs (`fumadocs-core`/`fumadocs-ui` 16.x, `fumadocs-mdx` 15.x, `fumadocs-openapi` 12.x), Next 16, zod 4, Fastify 5, Vitest.

**Base conferida (2026-11-18):** `fastify-type-provider-zod` 7 pede `fastify ^5.5`, `zod >=4.1.5` e `@fastify/swagger >=9.5.1`. Os peers do Fumadocs aceitam `next 16.x`, `react ^19.2` (temos 19.3.0) e `zod 4.x`. Versões no Fumadocs são pastas-raiz no `meta.json` (`root`), trocáveis entre si. O `fumadocs-openapi` aceita vários documentos num `input` em forma de record (`{ v1: ..., v2: ... }`).

## Decisões

Aprovadas em 2026-11-18:

| ID | Decisão |
|---|---|
| DOC1 | As docs ficam no `apps/web`, em `/docs` |
| DOC2 | Os schemas são declarados no Fastify (`fastify-type-provider-zod`), e o OpenAPI sai do `@fastify/swagger`. Sem catálogo à parte |
| DOC3 | Mudança que só acrescenta fica na v1; mudança que quebra vai para `/v2`, lançada junto com o app que já usa a v2. A v1 continua no ar por 6 meses depois disso, com os cabeçalhos `Deprecation` e `Sunset` |
| DOC4 | A referência cobre toda a `/v1` menos `/v1/test` (PD-19), agrupada por público: Município, Paciente, Painel, TV |
| DOC5 | Texto em português; caminhos e campos em inglês |

DOC1 a DOC5 viraram a AD-066, a AD-067 e a AD-068 em `decisions.md`. O que eu decidir sozinho no caminho vai para `decisoes-para-revisar.md`.

## Global Constraints

- TDD em toda task: o teste falha antes do código.
- **Comportamento da API igual para quem chama:** mesmos status, mesmo corpo de erro (`{ error, message?, fields? }`, PD-22), mensagens em português. Os testes de integração atuais (364) passam sem mudar as asserções. Se algum precisar mudar, isso vai para `decisoes-para-revisar.md`.
- Next 16: ler `node_modules/next/dist/docs/` antes de criar rota ou layout no `apps/web`.
- Testes da API pedem o Docker Desktop no ar (`systemctl --user start docker-desktop`).
- O `v1.json` é gerado: ninguém edita à mão. Ele fica no git (como as tabelas do `specs:gen`), e o `openapi.test.ts` falha se ele ficar para trás das rotas.
- Branch nova a partir da `main` depois do merge do PR #33 (nada novo entra na `feat/v0.1`).
- Code review (`/code-review`) antes de cada commit.

## Review Focus

1. **Erro de validação no formato do PD-22:** o erro do Fastify vira `400 { error: "invalid_input", fields }`. Os campos ficam separados por "." e o erro na raiz em "_", com mensagem em português, como o `validate()` faz hoje. Sem isso, o `handleError` atual devolveria `{ error: "invalid_input" }` sem `fields`, e os formulários do painel e do app perderiam o erro por campo. → Task 1.
2. **Resposta fora do schema:** hoje o `validate()` na saída lança 400; com o serializador do Fastify, vira 500 `internal_error` com log. Isso é bug do servidor, não do cliente, então a mudança é para melhor, mas ela fica registrada e coberta por teste. → Task 1.
3. **Schema com `transform`** (ex.: o CPF de `packages/schemas/cpf.ts`): o handler recebe o valor já transformado, como hoje; o OpenAPI mostra a forma de entrada no corpo e a de saída na resposta. → Task 1 e Task 3.
4. **Toda rota da v1 com schema:** um teste com hook `onRoute` falha se alguma rota `/v1` (fora `/v1/test`) não declarar `schema`. Isso vale para rota nova também. → Task 1.
5. **Multi-tenant (PD-15):** o playground precisa mandar o município. O documento usa `servers` com a variável `{municipality}` no subdomínio, e as rotas `municipalities/:slug` documentam o parâmetro. → Task 3 e Task 5.
6. **Rotas do better-auth** (`/v1/auth`, `/v1/panel/auth`) repassam o pedido para o better-auth e não têm schema nosso. Entram pelo plugin OpenAPI dele, ou ficam fora com um guia em texto; a Task 3 decide. O teste do item 4 as lista como exceção nomeada. → Task 3.
7. **Ordem dos hooks:** o Fastify valida o schema antes do `preHandler`. Rota que hoje autentica no `preHandler` (`requireTenant`, `requirePatient`, `requireLogin`) e valida dentro do handler passa a autenticar no `preValidation`, para que pedido sem login com corpo inválido continue 401/404, e não vire 400. → Task 2, um teste por grupo.
8. **Id inválido no caminho:** continua 404 `not_found`, como o `pathId`: o validador transforma erro em `params` em 404. → Task 1.
9. **Query e params chegam como texto:** schema com número na query usa `z.coerce`, como o `validate()` já pedia. → Task 2.
10. **`v1.json` desatualizado:** o `openapi.test.ts` compara o arquivo do git com o documento das rotas. → Task 3.

---

### Task 1: Base do Fastify com zod

**Files:** `apps/api/package.json`; `apps/api/app.ts`; `apps/api/infra/openapi/compilers.ts` (validador e serializador Zod próprios: o erro já sai como `ApiError`, e a resposta passa por `parse`, porque o `encode` do provider falha nos schemas com `transform`); `apps/api/infra/openapi/coverage.ts`; Test `tests/unit/infra/openapi/compilers.test.ts`, `tests/integration/v1/test/eco-schema/`, `tests/integration/infra/schema-coverage.test.ts`. O `@fastify/swagger` entra na Task 3.

**Interfaces (produz):**
- `zodFields(issues): Record<string, string[]>`: extraído do `validate()` e usado pelos dois caminhos, para que o formato dos campos venha de um lugar só.
- `validatorCompiler`: erro → `ApiError(400, "invalid_input", fields)`; em `params`, `ApiError(404, "not_found")`. Schema que não é Zod falha ao montar a rota.
- `serializerCompiler`: resposta fora do schema → erro, que o `handleError` já transforma em 500 com log.

- [ ] Testes vermelhos: corpo inválido numa rota de teste com schema → 400 com `fields` igual ao do `validate()` (mesmas chaves, mensagens em pt); erro na raiz em "_"; resposta fora do schema → 500 `internal_error`; corpo com transform chega transformado no handler.
- [ ] Teste vermelho da cobertura (Review Focus 4): lista as rotas `/v1` sem `schema`. Ele começa com todas na lista de pendentes (`pending`), e cada task de migração esvazia a sua parte. No fim, a lista guarda só as exceções do better-auth.
- [ ] Implementar; `npm test`, `npm run lint`; commit `feat(api): zod type provider with pd-22 validation errors`.

### Task 2: Migrar as rotas (quatro commits, um por grupo)

Em cada rota, o `validate(x, req.body)` vira `schema.body`, e o `validate(y, resultado)` da saída vira `schema.response`. Os handlers passam a usar `app.withTypeProvider<ZodTypeProvider>()`, então os tipos de `req.body` e `req.params` saem do schema, sem cast. Cada rota ganha `tags` (DOC4), `summary`, `security` e as respostas de erro (`ApiError` comum, Task 3). As rotas dos comandos da estação passam pelo helper `infra/panel/action` (`registerRoutes`), então o schema é declarado ali uma vez.

- [ ] 2a. Município (público): `municipalities/**` sem login, `status`, `captcha`; commit `refactor(api): fastify schemas for the public municipality routes`.
- [ ] 2b. Paciente: as rotas com `requirePatient`, mais `patient/push`; commit `refactor(api): fastify schemas for the patient routes`.
- [ ] 2c. Painel: `panel/**` (inclusive o helper das estações); commit `refactor(api): fastify schemas for the panel routes`.
- [ ] 2d. TV: `tv/**`, `panel/tvs`; commit `refactor(api): fastify schemas for the tv routes`.
- [ ] Em cada grupo: tirar as rotas da lista `pending` do teste de cobertura; os testes de integração do grupo passam sem mudar as asserções; `validate()` só fica onde a validação depende do banco ou do município (anotar onde e por quê). Rotas que hoje não validam a resposta ganham schema de resposta; se o teste mostrar que a resposta real diverge do schema, corrigir o schema, não a resposta.

### Task 3: Gerar o `v1.json`

**Files:** `apps/api/scripts/openapi.ts`; script `docs:openapi` no `package.json` da raiz; saída `apps/api/openapi/v1.json`; Test `apps/api/tests/integration/v1/openapi.test.ts`.

- [ ] Testes vermelhos: o documento passa num validador de OpenAPI 3.1 (`@scalar/openapi-parser`); nenhum caminho `/v1/test`; `components.schemas.ApiError` citado nas respostas de erro; `securitySchemes` com `patientBearer`, `patientCookie` (o app na web), `panelCookie` (`fila-painel`) e `tvBearer`; `servers` com a variável `{municipality}`; as tags do DOC4.
- [ ] O script sobe o app com `buildApp({ background: false, openapi: true })` sem `listen` (nenhuma conexão com o banco), chama `app.swagger()` e grava o arquivo no formato do Biome. O swagger só é registrado nos testes e no script.
- [ ] Decidir as rotas do better-auth (Review Focus 6) e anotar em `decisoes-para-revisar.md`.
- [ ] Commit `feat(api): generate the v1 openapi document`.

### Task 4: Fumadocs no `apps/web`

**Files:** `apps/web/package.json`, `apps/web/source.config.ts`, `apps/web/lib/source.ts`, `apps/web/app/docs/layout.tsx`, `apps/web/app/docs/[[...slug]]/page.tsx`, `apps/web/next.config.ts`, `apps/web/content/docs/`.

- [ ] Ler `node_modules/next/dist/docs/` (rotas e layouts) e o guia atual do Fumadocs para Next.
- [ ] Instalar `fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`; `/docs` com uma página "Começando" e a busca embutida.
- [ ] Tema: cores do `packages/design` nas variáveis do `fumadocs-ui`; o Dr. Lino só em fundo branco.
- [ ] Teste: o `next build` passa e `/docs` responde 200 (smoke no CI, Task 8).
- [ ] Commit `feat(web): docs site with fumadocs at /docs`.

### Task 5: Referência da API v1

**Files:** `apps/web/lib/openapi.ts`, `apps/web/content/docs/api/v1/meta.json` (`"root": "api"`), páginas do `fumadocs-openapi`.

- [ ] Instalar `fumadocs-openapi`; `createOpenAPI({ input: { v1: "../api/openapi/v1.json" } })`. Para as páginas, usar as virtuais (`openapiSource`, sem MDX gerado no git) ou o `generateFiles`, o que o guia atual recomendar, e registrar a escolha.
- [ ] Pasta-raiz `v1` no `meta.json`, já do jeito que permite pôr uma `v2` ao lado (seletor de versão).
- [ ] Playground: o município `exemplo` como padrão do `{municipality}`; `storageKeyPrefix` por versão.
- [ ] Commit `feat(web): api v1 reference from the openapi document`.

### Task 6: Guias

**Files:** `apps/web/content/docs/`: `index.mdx`, `municipios.mdx` (endereço por subdomínio ou `municipalities/:slug`, PD-15), `autenticacao.mdx` (paciente e painel), `erros.mdx` (PD-22, com `fields` e `message`), `versoes.mdx` (DOC3), `limites.mdx` (tentativas e captcha, AD-063 a AD-065).

- [ ] Os guias são para quem integra: sem os IDs internos (RN/PD/AD/DA), que um leitor de fora não consegue consultar; cada código citado foi conferido no código da API.
- [ ] Commit `docs(web): guides for tenants, auth, errors, versions and limits`.

### Task 7: Painel e app continuam iguais

- [ ] `npm run test:painel`, `npm run test:mobile`, `npm -w @fila-saude/schemas run test`: nada muda para quem chama a API, mas a Task 2 mexe em todas as rotas. Rodar o [roteiro](../../../features/mvp-filas/roteiro-v01.md) nos formulários com erro por campo (cadastro, login, unidade, sessão) para ver as mensagens aparecendo no lugar certo.

### Task 8: CI e limpeza

- [ ] `.github/workflows/tests.yml`: o `next build` do `apps/web` (o `v1.json` já é conferido pelo `npm test`).
- [ ] DOC2 e DOC3 viram AD em `decisions.md`; `npm run specs:check` limpo.
- [ ] `STATE.md`: trocar a linha do próximo passo. Este plano vai para `.specs/arquivo/planos/docs-api/`.
- [ ] `/code-review` no diff e `git status` sem arquivo solto.

## Fora deste plano

- Os cabeçalhos `Deprecation`/`Sunset` no código: só fazem sentido quando houver uma v2. A política fica escrita agora (DOC3).
- Docs do app e do painel para o usuário final (outra feature).
- Deploy e domínio do `apps/web` (junto com a [hospedagem](../../../features/mvp-filas/discovery-hospedagem.md)).

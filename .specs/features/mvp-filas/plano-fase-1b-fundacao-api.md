# Fase 1B — Fundação da API (multi-tenant, auth e permissões) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar `apps/api` pronta para receber as regras: um banco central e um banco por município, com migrations, `tenant:create` e resolução do tenant por requisição; login do paciente na central (CPF + senha, e-mail confirmado, recuperação, bloqueio) aceito pelos tenants; login do painel por município, perfis com escopo, guard pela matriz de permissões e auditoria na mesma transação.

**Architecture:** Um processo Fastify 5 (autoload em `routes/`) atende a central e os tenants. Cada requisição resolve o município (pelo `Host` no web, pelo caminho no app; PD-15) e pega um pool Drizzle do banco dele num LRU. Dois conjuntos de schema e de migrations (`central`, `municipal`) com um runner que migra todos e retoma por tenant (PD-16). better-auth em duas configurações (PD-05): a central emite, além da sessão, um JWT EdDSA curto que o tenant confere pelo JWKS da central (PD-17); a do painel é uma instância por tenant em cache. Toda rota do painel que muda algo passa por `acaoDoPainel`, que confere a permissão com `pode()` do domínio e grava a auditoria na mesma transação (PD-18).

**Tech Stack:** TypeScript (strict, ESM, Node 24), Fastify 5 + `@fastify/autoload`, Drizzle ORM + `pg`, drizzle-kit, better-auth (plugins `username`, `emailOTP`, `jwt`), `jose` (JWKS remoto), `lru-cache`, Zod 4 (`packages/schemas`), Vitest 4 contra servidor real (`concurrently`) e Postgres de teste na porta 5433, Biome.

**Spec:** arquitetura em [`plan.md`](plan.md) (PD-03, PD-04, PD-05, PD-12, PD-13; §4 e §5), backlog T1.7–T1.9 em [`tasks.md`](tasks.md), regras em [`specs/identidade`](../../specs/identidade/spec.md) (RN-ID-01/02/04/05), [`specs/permissoes`](../../specs/permissoes/spec.md) (RN-PERF-01..03 e matriz), [`specs/modelo`](../../specs/modelo/spec.md) (INV-11, INV-12), [`specs/nao-funcionais`](../../specs/nao-funcionais/spec.md) (RNF-DADOS-01/02, RNF-SEG-03/04), decisões AD-017, AD-019, AD-035 em [`decisions.md`](../../decisions.md), discovery de [identidade](discovery-identidade.md). Consome o plano [1A](plano-fase-1a-dominio.md): `pode`, `Perfil`, `Acao`, `MATRIZ` (Task 12 da 1A).

**Fora deste plano:** telas do painel, CRUD de configuração, worker e TV (fase 2, [plano 2](plano-fase-2-configuracao.md)); plugin Expo e app (T3.1); bloqueio de conta usurpada e redefinição de acesso pela recepção (T7.3); gov.br (depois do piloto); e-mail transacional de produção e infra (fase 4).

## Global Constraints

- **TDD sempre** (constituição, processo 1; [tasks.md](tasks.md#tasks-mvp-filas-ubspoliclínicas)): cada passo de código vem depois de um teste rodado e visto falhando pelo motivo certo (não por import ou digitação). Todo task segue teste → rodar e ver FAIL → implementar → rodar e ver PASS → commit.
- Na API o ciclo é pelo **teste de integração da rota** (`apps/api/tests/integration`, servidor real em `:3333` via `concurrently`, `fetch` de verdade). Infra sem rota (runner de migrations, LRU, `tenant:create`) é testada no processo do Vitest contra o Postgres de teste real; nada de mock de banco. Concorrência, quando houver, com dois escritores reais (L-003).
- Limites numéricos testados dos dois lados (L-004): tamanho do slug, tentativas de login, tamanho de senha, expiração do JWT.
- Um teste por arquivo de rota/método, no padrão `tests/integration/v1/<caminho>/<metodo>.test.ts`; os de infra em `tests/integration/infra/<modulo>.test.ts`. Nome do teste cita o ID da regra quando houver (ex.: `"RN-ID-02: CPF já usado é recusado"`).
- Rodar um arquivo: `VITEST_ARGS=<caminho> npm -w @fila-saude/api run test` (a Task 1 cria a variável). Suíte inteira: `npm -w @fila-saude/api run test`.
- Banco central nunca guarda sintoma, documento nem dado de fila (INV-11): nenhuma tabela do schema central tem esses campos; a Task 1 cria um teste que lista as colunas do central e falha se aparecer uma coluna fora da lista permitida.
- Erros sempre no formato da PD-22 (`{ erro: <codigo>, mensagem?: string, campos?: … }`), códigos em `snake_case` português.
- Identificadores em português como nas specs (tabelas `municipio`, `pessoa_local`, `perfil_usuario`, `auditoria`); tabelas do better-auth mantêm os nomes que o adapter espera, salvo onde a task diz.
- `npx biome check apps/api packages/schemas` limpo e `npm run specs:check` sem erros ao fim de cada task.

## Decisões desta fase

Registradas como PD-14..PD-23 na tabela do [plan.md](plan.md#1-decisões-de-arquitetura); aqui com o detalhe.

| ID | Decisão | Por quê | Custa se errado |
| --- | --- | --- | --- |
| PD-14 | **Um servidor Postgres em dev e teste, com `fila_central` e um banco por município `fila_t_<slug>`** (hífen do slug vira `_`). Em produção, VPS separadas (PD-12). O central guarda uma **referência** ao banco do tenant, não a URL: `template:<banco>` em dev/teste, expandida por `TENANT_DATABASE_URL_TEMPLATE` (`postgresql://…:5433/{banco}`), e `env:<VAR>` em produção (segredo no ambiente). A suíte de testes cria e derruba os próprios bancos | Isolamento real por banco já no dev (RNF-DADOS-01) sem um contêiner por município; segredo nunca no banco | Baixo: trocar a referência é só o resolvedor `urlDoBanco`; os bancos não mudam |
| PD-15 | **Resolução do tenant: web pelo `Host`** (`<slug>.<TENANT_BASE_DOMAIN>`; `localhost` em dev/teste, `filasaude.com.br` em produção) **e app pelo caminho** `/v1/municipios/:slug/…`. Rotas da central (auth do paciente, catálogo) ficam no host raiz. Com os dois presentes e diferentes → `400 municipio_divergente`. `TENANT_MODE=single` (PD-12) fixa o tenant por `TENANT_SLUG` e ignora o catálogo | Painel e TV já nascem no subdomínio (PD-04) e o cookie fica preso a ele. No app, o caminho funciona igual na central (modo multi) e na VPS do município (modo single), aparece em log, passa por `EventSource` sem cabeçalho customizado (SSE, PD-07) e é testável com `fetch` puro. Cabeçalho descartado: invisível em log e exige suporte a header no cliente SSE do app | Médio: mudar o app de caminho para outra forma mexe em todas as rotas `municipios/_slug`; o plugin de resolução isola a regra num lugar só |
| PD-16 | **Dois conjuntos de schema e de migrations**: `infra/database/central/{schema,migrations}` e `infra/database/municipal/{schema,migrations}`, cada um com seu `drizzle.<conjunto>.config.ts`. O runner `migrarTodos` aplica o central e depois cada tenant em sequência; o estado fica no `__drizzle_migrations` de cada banco e o resultado em `municipio.migracao_versao` / `migracao_erro`; um tenant com erro não para os outros e a próxima execução retoma | Migration que falha no meio dos tenants (risco do plan §13) vira um tenant marcado, não um parque inconsistente | Baixo: é o formato padrão do drizzle-kit; a migration inicial do central substitui a `0000_create-users-and-auth` (ainda sem produção) |
| PD-17 | **Login feito na central aceito no tenant por token assinado**: o better-auth central, com o plugin `jwt`, emite um JWT **EdDSA (Ed25519), 15 min**, com `sub` = id do paciente, `cpf`, `verificado` e `iss` = URL da central; publica o JWKS em `/v1/auth/jwks`. O tenant confere com `createRemoteJWKSet` (`jose`, cache e renovação automática) apontado para `CENTRAL_URL`; no modo multi (um processo só) o mesmo verificador lê as chaves direto do banco central, sem HTTP. O app troca a sessão pelo token em `GET /v1/auth/token` e renova antes de vencer | Fecha o item em aberto do plan ("VPS do município aceita login feito na central") sem a VPS do município consultar a central a cada requisição; revogação em até 15 min é aceitável para fila | Médio: token curto demais gera muita renovação no app; longo demais atrasa bloqueio de conta (T7.3). O prazo é uma variável de ambiente |
| PD-18 | **Auditoria na mesma transação** (INV-12, RNF-SEG-04): toda rota do painel que muda estado declara `config.acao` e usa `acaoDoPainel(req, { acao, alvo, motivo }, fn(tx))`, que confere a permissão, abre a transação no banco do tenant, roda `fn` e insere em `auditoria` antes do commit. Um teste lista as rotas registradas e falha se alguma rota mutável sob `/v1/painel` não declarar `config.acao` | Sem auditoria possível sem a ação, e vice-versa; o teste de rotas impede esquecer | Baixo: o helper é o único caminho; mudar o formato da auditoria é uma migration |
| PD-19 | **Testes da API em série e isolados por banco**: `fileParallelism: false` no Vitest (todos compartilham o Postgres de 5433 e o servidor de 3333); cada arquivo cria municípios com slug único (`t<timestamp36><n>`) e derruba os bancos no `afterAll` com `DROP DATABASE … WITH (FORCE)`; o `globalSetup` cria e migra `fila_central` e apaga sobras `fila_t_%`. **Rotas só de teste** ficam em `apps/api/test-routes/`, registradas com prefixo `/v1/teste` apenas quando `NODE_ENV=test` | Testes de integração determinísticos sem servidor por arquivo; rotas de teste exercitam o caminho real (resolução, pool, guard, auditoria) antes de existir rota de produto | Baixo: suíte mais lenta; se pesar, dá para paralelizar por arquivo com servidor por worker |
| PD-20 | **Mailer de desenvolvimento grava no banco central** (`correio_dev`: para, assunto, corpo, código, criado em) quando `MAILER=banco` (dev e teste); os testes leem o último e-mail pelo `orchestrator`. Interface `Mailer { enviar(msg) }`; o provedor transacional entra na T4.1 | O servidor roda em outro processo; o banco é o único lugar que os dois enxergam sem rota extra | Baixo: trocar o mailer é configuração |
| PD-21 | **Senha e bloqueio** (RN-ID-04): mínimo 8 caracteres; **5 erros seguidos bloqueiam a conta por 15 min** (contador próprio em `tentativa_login`, porque o better-auth limita por IP, não por conta); acerto zera o contador. Limite por IP do better-auth ligado nas rotas de login e cadastro (RNF-SEG-03), lendo o IP de `x-forwarded-for` só atrás do proxy | Valores comuns e explicáveis à recepção; o bloqueio por conta protege contra força bruta distribuída | Baixo: os três números são configuráveis por ambiente |
| PD-22 | **Contratos e erros**: entrada e saída validadas com os schemas Zod de `packages/schemas` por um helper `validar(schema, valor)` (sem type provider). Erros: `400 entrada_invalida` (com `campos`), `401 nao_autenticado`, `403 sem_permissao`, `404 municipio_desconhecido` / `nao_encontrado`, `409 <CodigoErro do domínio>` (PD-13), `423 conta_bloqueada` | Um formato só para painel e app; o código do domínio passa direto ao cliente | Baixo |
| PD-23 | **Contas**: o paciente é a tabela do usuário do better-auth central renomeada para `paciente` (`user.modelName`) com campos extras (`cpf`, `nascimento`, `telefone`, `verificado_em`, `verificado_metodo`, `verificado_municipio`); `username` = CPF só com dígitos. O usuário do painel é a tabela do usuário do better-auth do tenant (`usuario_painel`), com login por `username`; quando não houver e-mail real, grava `<login>@painel.invalid` (exigência do adapter) | Uma linha por pessoa, sem tabela paralela para sincronizar; o domínio `.invalid` nunca recebe e-mail | Baixo: renomear ou separar depois é uma migration |

## Review Focus

1. **Vazamento entre tenants:** dado gravado no tenant A nunca aparece no B, nem por `Host` nem por caminho; usuário do painel de A não loga em B; cookie de A enviado para B não autentica. Testes nas Tasks 8 e 15.
2. **Host e caminho divergentes, host desconhecido, município suspenso:** nunca caem no banco errado nem no central por engano; respondem 400/404 sem dizer se o município existe. Testes nas Tasks 7 e 8.
3. **Bloqueio de login nos dois lados do limite:** 4 erros e acerto entra; 5 erros e acerto não entra; depois de 15 min entra. Teste na Task 13.
4. **JWT da central no tenant:** vencido, assinado por outra chave, com `iss` errado ou sem `sub` → 401; chave rotacionada na central passa a valer sem reiniciar o tenant. Teste na Task 14.
5. **Auditoria atômica:** ação que falha depois de gravar não deixa nem a mudança nem a auditoria; ação que passa deixa exatamente uma linha. Teste na Task 18.

---

## Estrutura de arquivos

```
apps/api/
  server.ts                          registra plugins (erros, tenant) e, em NODE_ENV=test, test-routes/
  drizzle.central.config.ts          substitui drizzle.config.ts
  drizzle.municipal.config.ts
  .env.development · .env.test       + TENANT_DATABASE_URL_TEMPLATE, TENANT_BASE_DOMAIN, TENANT_MODE, TENANT_SLUG,
                                       CENTRAL_URL, MAILER, TENANT_CACHE_TTL_MS, AUTH_JWT_TTL; POSTGRES_DB=fila_central
  infra/env.ts                       schema Zod das variáveis novas
  infra/erros.ts                     ErroApi, validar(), handler de erro (PD-22)
  infra/database/
    index.ts                         banco central (mantém o export usado por /v1/status)
    central/schema/{auth.ts, municipio.ts, correio.ts, tentativa-login.ts}
    central/migrations/
    municipal/schema/{auth.ts, pessoa-local.ts, perfil.ts, auditoria.ts}
    municipal/migrations/
    tenants.ts                       urlDoBanco(), PoolsDosTenants (LRU)
    migrar.ts                        migrarBanco(), migrarTodos()
  infra/tenant/
    slug.ts                          validarSlug(), bancoDoSlug()
    criar.ts                         criarTenant()
    resolver.ts                      resolverTenant(req, config) (Host, caminho, single)
    plugin.ts                        decora req.tenant = { slug, db }
  infra/auth/
    central.ts                       better-auth dos pacientes (username, emailOTP, jwt)
    painel.ts                        authDoTenant(slug) com cache
    verificar-paciente.ts            verificador do JWT (JWKS remoto ou local)
    fastify.ts                       montarAuth(app, url, auth) → handler fetch do better-auth
  infra/mailer.ts                    Mailer, MailerBanco
  infra/painel/
    sessao.ts                        usuário do painel e perfis da requisição
    guard.ts                         exigir(acao, escopo)
    acao.ts                          acaoDoPainel() (permissão + transação + auditoria)
  infra/scripts/{tenant-create.ts, db-migrate.ts}
  routes/v1/auth/route.ts            better-auth central em /v1/auth/*
  routes/v1/painel/auth/route.ts     better-auth do tenant em /v1/painel/auth/*
  routes/v1/painel/eu/route.ts       GET: usuário logado e perfis
  test-routes/                       só NODE_ENV=test (PD-19): tenant, pessoas, paciente/eu, acao-painel
  tests/global-setup.ts              cria e migra fila_central; apaga fila_t_% de execuções antigas
  tests/orchestrator.ts              + criarMunicipio(), derrubarMunicipios(), ultimoEmail(), cookies, origemDoTenant()
  tests/integration/infra/*.test.ts
  tests/integration/v1/**/*.test.ts
packages/schemas/
  cpf.ts                             cpfValido(), cpfSchema
  erros.ts                           erroSchema (PD-22)
  auth.ts                            cadastroPacienteSchema, euPainelSchema
```

---

### Task 1: Banco central, variáveis e harness de testes (T1.7; PD-14, PD-16, PD-19)

**Files:**
- Create: `apps/api/drizzle.central.config.ts`, `infra/database/central/schema/{auth.ts,municipio.ts}`, `infra/database/central/migrations/0000_*.sql`, `tests/global-setup.ts`, `tests/integration/infra/central.test.ts`
- Modify: `infra/env.ts`, `.env.development`, `.env.test`, `infra/database/index.ts`, `vitest.config.ts` (`fileParallelism: false`, `globalSetup`), `package.json` da API (script `test` com `"vitest run $VITEST_ARGS"`; scripts `db:generate:central`, `db:generate:municipal`), `tests/orchestrator.ts`
- Delete: `drizzle.config.ts`, `infra/database/schemas/auth.ts`, `infra/migrations/` (substituídos; sem produção)

**Interfaces:**
- Produces:
  - Env: `TENANT_DATABASE_URL_TEMPLATE: string` (contém `{banco}`), `TENANT_BASE_DOMAIN: string`, `TENANT_MODE: "multi" | "single"` (padrão `multi`), `TENANT_SLUG?: string`, `TENANT_DATABASE_URL?: string`, `CENTRAL_URL: string`, `MAILER: "banco" | "smtp"`, `TENANT_CACHE_TTL_MS: number` (0 em teste), `AUTH_JWT_TTL: string` (padrão `"15m"`).
  - Tabela central `municipio`: `id uuid pk`, `slug text unique`, `nome`, `uf char(2)`, `fuso text` (padrão `America/Sao_Paulo`), `banco_ref text`, `status "criando" | "ativo" | "suspenso"`, `migracao_versao text null`, `migracao_erro text null`, `criado_em`.
  - `tests/global-setup.ts`: conecta no banco `postgres` do servidor de teste, cria `fila_central` se não existir, aplica as migrations centrais e apaga bancos `fila_t_%`.
- [ ] **Step 1: Testes** em `tests/integration/infra/central.test.ts`: `"PD-16: banco central migrado tem municipio e as tabelas do better-auth"` (consulta `information_schema.tables` do `fila_central`); `"INV-11: o central só tem colunas permitidas"` (lista `table_name.column_name` do schema `public` e compara com uma lista explícita no teste; coluna nova exige atualizar a lista de propósito). O teste existente de `GET /v1/status` continua, agora contra `fila_central`.
- [ ] **Step 2:** `npm -w @fila-saude/api run test` → FAIL (`municipio` não existe).
- [ ] **Step 3:** Variáveis e `env.ts`; schema central (mover o `auth.ts` atual para `central/schema/auth.ts`, sem renomear ainda) e `municipio.ts`; `drizzle.central.config.ts` (`schema: ./infra/database/central/schema`, `out: ./infra/database/central/migrations`); `npm run db:generate:central`; `global-setup.ts`; `fileParallelism: false`. `orchestrator.clearDatabase` passa a limpar só as tabelas do central (`TRUNCATE … CASCADE`), sem `drop schema`.
- [ ] **Step 4:** Rodar → PASS (inclusive `GET /v1/status`); biome.
- [ ] **Step 5:** Commit `feat(api): central database, env and serial integration harness`.

### Task 2: Schema municipal e `migrarBanco` (T1.7; PD-16, AD-035)

**Files:**
- Create: `apps/api/drizzle.municipal.config.ts`, `infra/database/municipal/schema/pessoa-local.ts`, `infra/database/municipal/migrations/0000_*.sql`, `infra/database/migrar.ts`, `tests/integration/infra/migrar.test.ts`

**Interfaces:**
- Produces:
  - Tabela municipal `pessoa_local`: `id uuid pk`, `nome`, `nascimento date`, `cpf text null`, `paciente_id text null` (id central, AD-035), `documento_conferido_por text null`, `documento_conferido_em timestamptz null`, `criado_em`; índice único parcial em `cpf` quando não nulo.
  - `migrarBanco(url: string, conjunto: "central" | "municipal"): Promise<{ versao: string }>` (aplica `migrate()` do `drizzle-orm/node-postgres/migrator` com a pasta do conjunto; devolve a última migration aplicada).
- [ ] **Step 1: Testes** `"PD-16: migrarBanco cria as tabelas municipais num banco vazio"` (o teste cria um banco `fila_t_<slug único>` com `CREATE DATABASE`, migra e confere `pessoa_local`); `"PD-16: migrar de novo não muda nada"` (segunda chamada devolve a mesma versão, sem erro); `"INV-11: schema municipal não cria tabela no central"` (o central continua com as mesmas tabelas).
- [ ] **Step 2:** `VITEST_ARGS=tests/integration/infra/migrar.test.ts npm -w @fila-saude/api run test` → FAIL.
- [ ] **Step 3:** Schema, config do drizzle-kit, `npm run db:generate:municipal`, `migrarBanco`. `afterAll` derruba o banco com `WITH (FORCE)`.
- [ ] **Step 4:** PASS; biome.
- [ ] **Step 5:** Commit `feat(api): municipal schema and per-database migrator`.

### Task 3: `criarTenant` e `tenant:create` (T1.7; PD-14)

**Files:**
- Create: `infra/tenant/slug.ts`, `infra/tenant/criar.ts`, `infra/scripts/tenant-create.ts`, `tests/integration/infra/criar-tenant.test.ts`
- Modify: `package.json` da API e raiz (`"tenant:create"`), `tests/orchestrator.ts` (`criarMunicipio(opcoes?)`, `derrubarMunicipios()`, `slugUnico()`)

**Interfaces:**
- Consumes: `migrarBanco`.
- Produces:
  - `validarSlug(slug: string): boolean` — `^[a-z][a-z0-9-]{1,28}[a-z0-9]$` (3 a 30 caracteres, sem hífen no fim); `bancoDoSlug(slug): string` → `fila_t_` + slug com `-` → `_`.
  - `criarTenant(dados: { slug: string; nome: string; uf: string; fuso?: string }, deps: { central: Db; template: string }): Promise<{ municipioId: string }>` — passos idempotentes: grava `municipio` com `status: "criando"` e `banco_ref: "template:<banco>"` → `CREATE DATABASE` se não existe → `migrarBanco` → `status: "ativo"`. Slug inválido → `ErroApi("slug_invalido")`; slug ativo existente → `ErroApi("municipio_existe")`; slug em `criando` → retoma do ponto onde parou. (O primeiro gestor entra na Task 15.)
  - CLI: `npm run tenant:create -- --slug pref-a --nome "Prefeitura A" --uf SP`.
- [ ] **Step 1: Testes** `"T1.7: tenant:create cria o banco, migra e registra ativo"`; `"slug: 3 e 30 caracteres aceitos, 2 e 31 recusados"` (L-004); `"slug: maiúscula, underscore, hífen no começo ou no fim recusados"`; `"slug repetido é recusado"`; `"criação interrompida é retomada"` (o teste insere `municipio` em `criando` e cria o banco vazio; `criarTenant` termina e deixa `ativo`).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar `slug.ts`, `criar.ts` e o script; `orchestrator.criarMunicipio()` chama `criarTenant` no processo do Vitest (mesmo Postgres que o servidor usa).
- [ ] **Step 4:** PASS; biome.
- [ ] **Step 5:** Commit `feat(api): tenant creation with resumable steps`.

### Task 4: `migrarTodos` e `db:migrate` retomável (T1.7; PD-16)

**Files:**
- Modify: `infra/database/migrar.ts`; Create: `infra/scripts/db-migrate.ts`, `tests/integration/infra/migrar-todos.test.ts`; Modify `package.json` (`db:migrate` passa a chamar o script)

**Interfaces:**
- Consumes: `migrarBanco`, `urlDoBanco` (forma mínima aqui: `template:`; `env:` na Task 5).
- Produces: `migrarTodos(deps): Promise<{ central: string; tenants: { slug: string; ok: boolean; versao?: string; erro?: string }[] }>` — migra o central, depois cada `municipio` com status `ativo` ou `criando`, um por vez; grava `migracao_versao` ou `migracao_erro` no central; o script sai com código 1 se algum falhar.
- [ ] **Step 1: Testes** `"PD-16: migra o central e todos os tenants"` (dois municípios criados, versão gravada nos dois); `"PD-16: tenant com banco inacessível é marcado e os outros seguem"` (um `municipio` com `banco_ref` para um banco inexistente: os outros migram, ele fica com `migracao_erro`); `"PD-16: a próxima execução retoma e limpa o erro"` (cria o banco que faltava, roda de novo, `migracao_erro` volta a nulo).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): migrate central and every tenant, resumable`.

### Task 5: Pools por tenant em LRU e `urlDoBanco` (T1.7; PD-03, PD-14)

**Files:**
- Create: `infra/database/tenants.ts`, `tests/integration/infra/tenants.test.ts`; Modify: `package.json` da API (`lru-cache`)

**Interfaces:**
- Produces:
  - `urlDoBanco(ref: string, env): string` — `template:<banco>` → template com `{banco}`; `env:<VAR>` → `process.env[VAR]` (ausente → erro); outro prefixo → erro.
  - `class PoolsDosTenants { constructor(opcoes: { max: number; conexoesPorTenant: number; central: Db; ttlCatalogoMs: number }); obter(slug: string): Promise<{ slug; municipioId; fuso; db: Db } | null>; encerrar(): Promise<void> }` — `null` para slug desconhecido, `criando` ou `suspenso`; uma instância Drizzle por pool; ao sair do LRU o pool é encerrado (`dispose` → `pool.end()`).
- [ ] **Step 1: Testes** `"PD-14: urlDoBanco expande template e env, recusa prefixo desconhecido"`; `"pool: mesmo slug devolve a mesma instância"`; `"pool: com max 2, o terceiro tenant encerra o menos usado"` (confere `pool.ended`); `"pool: slug desconhecido, criando ou suspenso → null"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): per-tenant connection pools in an LRU`.

### Task 6: Formato de erro, validação e rotas de teste (PD-19, PD-22)

**Files:**
- Create: `infra/erros.ts`, `packages/schemas/erros.ts`, `test-routes/eco/route.ts`, `tests/integration/v1/teste/eco/post.test.ts`
- Modify: `server.ts` (handler de erro; registra `test-routes/` com prefixo `/v1/teste` só em `NODE_ENV=test`; o `listen` passa a escutar em `localhost` explicitamente)

**Interfaces:**
- Produces: `class ErroApi extends Error { status: number; codigo: string; campos?: Record<string, string[]> }`; `validar<T>(schema: ZodType<T>, valor: unknown): T` (lança `ErroApi(400, "entrada_invalida", campos)`); `erroSchema = z.object({ erro: z.string(), mensagem: z.string().optional(), campos: z.record(z.string(), z.array(z.string())).optional() })`; rota 404 padrão devolve `{ erro: "nao_encontrado" }`.
- [ ] **Step 1: Testes** `"PD-22: corpo inválido → 400 entrada_invalida com os campos"`; `"PD-22: rota inexistente → 404 nao_encontrado"`; `"PD-19: rotas de teste existem em NODE_ENV=test"` (o próprio `POST /v1/teste/eco` responde). Um teste de unidade de `server.ts` não é necessário: a ausência fora do teste é garantida pelo `if` e revisada no code review.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): error format, validation helper and test-only routes`.

### Task 7: Resolução do tenant pelo `Host` (T1.7; PD-04, PD-15)

**Files:**
- Create: `infra/tenant/resolver.ts`, `infra/tenant/plugin.ts`, `test-routes/tenant/route.ts`, `tests/integration/v1/teste/tenant/get.test.ts`
- Modify: `server.ts` (registra o plugin), `tests/orchestrator.ts` (`origemDoTenant(slug)` → `http://<slug>.localhost:3333`)

**Interfaces:**
- Consumes: `PoolsDosTenants`.
- Produces:
  - `resolverTenant(entrada: { host: string | undefined; slugDoCaminho: string | undefined }, config: { modo: "multi" | "single"; dominioBase: string; slugFixo?: string }): { slug: string } | { erro: "sem_tenant" | "municipio_divergente" }` — puro; `pref-a.localhost:3333` → `pref-a`; `localhost:3333` → `sem_tenant`; `a.b.localhost` → `sem_tenant`.
  - Plugin Fastify: `req.tenant: { slug; municipioId; fuso; db } | null`; decorator `app.exigirTenant` (preHandler) → `404 municipio_desconhecido` quando nulo (inclusive suspenso, para não revelar existência).
  - Rota de teste `GET /v1/teste/tenant` (exige tenant) → `{ slug, banco: current_database() }`.
- [ ] **Step 1: Testes** `"PD-15: Host do tenant A usa o banco de A"` e o mesmo para B; `"PD-15: host raiz em rota de tenant → 404"`; `"PD-15: slug desconhecido e município suspenso → 404 municipio_desconhecido"` (corpo idêntico nos dois); `resolverTenant` com porta, sem porta, subdomínio duplo e domínio de produção.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): resolve the tenant from the Host header`.

### Task 8: Resolução pelo caminho, modo single e isolamento entre dois tenants (T1.7; PD-15, RNF-DADOS-01)

**Files:**
- Create: `test-routes/municipios/_slug/pessoas/route.ts` (POST e GET de `pessoa_local`), `tests/integration/v1/teste/municipios/pessoas.test.ts`, `tests/integration/infra/resolver.test.ts`
- Modify: `infra/tenant/resolver.ts`, `infra/tenant/plugin.ts`

**Interfaces:**
- Produces: o plugin lê `req.params.slug` nas rotas `municipios/_slug/*`; `Host` de tenant + caminho de outro tenant → `400 municipio_divergente`; modo `single` usa `TENANT_SLUG` e `TENANT_DATABASE_URL`, recusa caminho de outro slug com 404 e não consulta o central.
- [ ] **Step 1: Testes** `"T1.7: pessoa gravada no A nunca aparece no B"` (POST em `/v1/teste/municipios/<A>/pessoas`, GET em `/v1/teste/municipios/<B>/pessoas` vazio; o mesmo pelo `Host`); `"PD-15: Host de A com caminho de B → 400 municipio_divergente"`; em `resolver.test.ts`: `"PD-15: modo single ignora o catálogo e recusa outro slug"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): tenant from the path, single mode and isolation test`.

### Task 9: CPF pelos dígitos (T1.8; RN-ID-01)

**Files:**
- Create: `packages/schemas/cpf.ts`, `packages/schemas/test/cpf.test.ts`, `packages/schemas/vitest.config.ts`; Modify: `packages/schemas/package.json` (scripts `test`, devDependency `vitest`)

**Interfaces:**
- Produces: `normalizarCpf(texto: string): string` (só dígitos); `cpfValido(texto: string): boolean` (11 dígitos, não todos iguais, dois dígitos verificadores); `cpfSchema = z.string().transform(normalizarCpf).refine(cpfValido, "cpf_invalido")`.
- [ ] **Step 1: Testes** `"RN-ID-01: CPF válido com e sem máscara"`; `"RN-ID-01: dígito verificador errado (1º e 2º) é recusado"`; `"RN-ID-01: 10 e 12 dígitos recusados; 11 iguais recusados"` (L-004).
- [ ] **Step 2:** `npm -w @fila-saude/schemas run test` → FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(schemas): CPF check digits`.

### Task 10: better-auth central montado e cadastro do paciente (T1.8; RN-ID-01, RN-ID-02, RN-ID-05, AD-017, PD-23)

**Files:**
- Create: `infra/auth/central.ts`, `infra/auth/fastify.ts`, `routes/v1/auth/route.ts`, `packages/schemas/auth.ts`, `tests/integration/v1/auth/cadastro.test.ts`
- Modify: `infra/database/central/schema/auth.ts` (tabela `paciente` com os campos extras, `username`), nova migration central; Delete: `infra/auth.ts`; Modify `tests/orchestrator.ts` (`cadastrarPaciente()`, `cookiesDe(resposta)`)

**Interfaces:**
- Consumes: `cpfValido`, `normalizarCpf`.
- Produces:
  - `authCentral` = `betterAuth({ basePath: "/v1/auth", baseURL: CENTRAL_URL, user: { modelName: "paciente", additionalFields: { cpf, nascimento, telefone, verificadoEm, verificadoMetodo, verificadoMunicipio } }, emailAndPassword: { enabled: true, minPasswordLength: 8 }, plugins: [username({ usernameValidator: cpfValido, minUsernameLength: 11, maxUsernameLength: 11 })] })`. `cpf` e `username` são o mesmo valor normalizado; `verificadoEm` nunca vem do cliente (`input: false`).
  - `montarAuth(app, prefixo, obterAuth: (req) => Auth)`: rota `GET|POST <prefixo>/*` que converte a requisição Fastify em `Request` e responde com `auth.handler`.
  - `cadastroPacienteSchema` (cpf, nome, e-mail obrigatório, telefone, nascimento, senha).
  - Hook `before` em `/sign-up/email`: CPF inválido → `400 cpf_invalido`; CPF já usado → `409 cpf_em_uso` com `mensagem: "Procure a recepção da sua unidade para contestar."` (RN-ID-02).
- [ ] **Step 1: Testes** `"RN-ID-01: cadastro com CPF válido cria conta"`; `"RN-ID-01: CPF inválido → 400 cpf_invalido"`; `"RN-ID-02: CPF já usado → 409 cpf_em_uso com orientação da recepção"` (mesmo CPF com e sem máscara); `"RN-ID-01: e-mail é obrigatório"`; `"RN-ID-05: conta nasce não verificada"` (consulta `paciente.verificado_em` nulo); `"RN-ID-05: cliente não consegue mandar verificadoEm"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar; `npm run db:generate:central`. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): patient sign-up on the central auth`.

### Task 11: Mailer de desenvolvimento e e-mail confirmado antes do login (T1.8; RN-ID-01, PD-20)

**Files:**
- Create: `infra/mailer.ts`, `infra/database/central/schema/correio.ts` (+ migration), `tests/integration/v1/auth/confirmar-email.test.ts`
- Modify: `infra/auth/central.ts` (plugin `emailOTP` com `sendVerificationOTP` pelo `Mailer`; `emailAndPassword.requireEmailVerification: true`; `emailVerification.sendOnSignUp: true`), `tests/orchestrator.ts` (`ultimoEmail(para): Promise<{ assunto; corpo; codigo }>`)

**Interfaces:**
- Produces: `interface Mailer { enviar(m: { para: string; assunto: string; corpo: string; codigo?: string }): Promise<void> }`; `MailerBanco` grava em `correio_dev`; `mailerDoAmbiente(env)`; textos sem dado clínico.
- [ ] **Step 1: Testes** `"RN-ID-01: login antes de confirmar o e-mail → 403 email_nao_confirmado"`; `"RN-ID-01: código do e-mail confirma e libera o login"` (lê o código pelo `orchestrator.ultimoEmail`); `"código errado não confirma"`; `"login por CPF com e sem máscara"` (`/v1/auth/sign-in/username`).
- [ ] **Step 2:** FAIL. **Step 3:** implementar (nomes exatos dos endpoints do `emailOTP` conferidos na versão instalada do better-auth). **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): dev mailer and required email confirmation`.

### Task 12: Recuperação de senha por código no e-mail (T1.8; RN-ID-01, AD-019)

**Files:**
- Create: `tests/integration/v1/auth/recuperar-senha.test.ts`; Modify: `infra/auth/central.ts` (tipo `forget-password` do `emailOTP`)

**Interfaces:**
- Produces: pedido de recuperação pelo CPF ou e-mail → código no e-mail cadastrado; troca de senha com o código; sessões antigas revogadas (`revokeSessionsOnPasswordReset: true`).
- [ ] **Step 1: Testes** `"RN-ID-01: código no e-mail troca a senha; a antiga deixa de entrar"`; `"RN-ID-01: pedido para CPF ou e-mail inexistente responde igual ao existente"` (mesmo status e corpo, nenhum e-mail gravado); `"código usado uma vez não serve de novo"`; `"sessão aberta antes da troca deixa de valer"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (pedido por CPF: hook que resolve o e-mail da conta antes de chamar o `emailOTP`). **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): password recovery by email code`.

### Task 13: Política de senha, bloqueio por conta e limite por IP (T1.8; RN-ID-04, RNF-SEG-03, PD-21)

**Files:**
- Create: `infra/database/central/schema/tentativa-login.ts` (+ migration), `infra/auth/bloqueio.ts`, `tests/integration/v1/auth/bloqueio.test.ts`
- Modify: `infra/auth/central.ts` (hooks `before`/`after` em `/sign-in/username`; `rateLimit` com regras para login e cadastro; `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]`)

**Interfaces:**
- Produces: tabela `tentativa_login(paciente_id pk, erros_seguidos int, bloqueado_ate timestamptz null)`; `registrarErro`, `registrarAcerto`, `estaBloqueado(pacienteId, agora)`; resposta de conta bloqueada: `423 conta_bloqueada` com `mensagem` dizendo quando tentar de novo (sem dizer se a senha estava certa). Constantes `ERROS_PARA_BLOQUEIO = 5`, `BLOQUEIO_MIN = 15` em env com esses padrões.
- [ ] **Step 1: Testes** (L-004) `"RN-ID-04: senha de 7 caracteres recusada, de 8 aceita"`; `"RN-ID-04: 4 erros seguidos e acerto entra e zera o contador"`; `"RN-ID-04: 5 erros seguidos bloqueiam; acerto recebe 423"`; `"RN-ID-04: bloqueio vencido libera"` (o teste move `bloqueado_ate` para 1 s no passado; e para 1 s no futuro continua 423); `"RNF-SEG-03: muitas tentativas do mesmo IP → 429"` (cada teste usa um `x-forwarded-for` próprio para não afetar os outros).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): password policy, per-account lockout and IP limit`.

### Task 14: JWT da central, JWKS e verificação no tenant (T1.8; PD-17)

**Files:**
- Create: `infra/auth/verificar-paciente.ts`, `test-routes/municipios/_slug/paciente/eu/route.ts`, `tests/integration/v1/auth/jwt.test.ts`, `tests/integration/infra/verificar-paciente.test.ts`
- Modify: `infra/auth/central.ts` (plugin `jwt` com `jwks.keyPairConfig: { alg: "EdDSA", crv: "Ed25519" }`, `jwt.expirationTime: AUTH_JWT_TTL`, `jwt.issuer: CENTRAL_URL`, `definePayload` → `{ cpf, verificado }`), schema central (tabela `jwks` + migration), `infra/tenant/plugin.ts` (preHandler `autenticarPaciente` nas rotas `municipios/_slug/paciente/*`); `package.json` (`jose`)

**Interfaces:**
- Produces:
  - `GET /v1/auth/token` (com sessão) → `{ token }`; `GET /v1/auth/jwks`.
  - `criarVerificador(opcoes: { modo: "local"; central: Db } | { modo: "remoto"; jwksUrl: string }, emissor: string): (token: string) => Promise<{ pacienteId: string; cpf: string; verificado: boolean } | null>`.
  - `req.paciente` nas rotas de app; sem `Authorization: Bearer` válido → `401 nao_autenticado`.
  - Rota de teste `GET /v1/teste/municipios/:slug/paciente/eu` → `req.paciente`.
- [ ] **Step 1: Testes** `"PD-17: token da central autentica no tenant"`; `"PD-17: sem token, token vencido (TTL de teste 1 s, espera 2 s), assinado por outra chave, iss errado → 401"`; `"PD-17: token ainda dentro do prazo passa"` (o outro lado do limite); `"PD-17: verificador remoto aceita o mesmo token pelo JWKS HTTP"` (em `verificar-paciente.test.ts`, `modo: "remoto"` apontando para `http://localhost:3333/v1/auth/jwks`); `"PD-17: chave nova na central passa a valer sem reiniciar o verificador"` (rotaciona a chave no banco central; token novo é aceito).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): central-issued EdDSA token verified by tenants`.

### Task 15: better-auth do painel por tenant e primeiro gestor (T1.9; PD-05, PD-23)

**Files:**
- Create: `infra/database/municipal/schema/auth.ts` (tabelas do better-auth com `usuario_painel`; + migration municipal), `infra/auth/painel.ts`, `routes/v1/painel/auth/route.ts`, `tests/integration/v1/painel/auth/login.test.ts`
- Modify: `infra/tenant/criar.ts` (dados opcionais `gestor: { login; nome; senha }`), `infra/scripts/tenant-create.ts` (`--gestor-login`, `--gestor-nome`; senha pedida no terminal), `tests/orchestrator.ts` (`loginPainel(slug, login, senha)` → cookie)

**Interfaces:**
- Consumes: `PoolsDosTenants`, `montarAuth`.
- Produces:
  - `authDoTenant(slug: string, db: Db): Auth` — `betterAuth({ basePath: "/v1/painel/auth", baseURL: "http(s)://<slug>.<dominio>", database: drizzleAdapter(db, schema municipal), user: { modelName: "usuario_painel" }, emailAndPassword: { enabled: true, minPasswordLength: 8, disableSignUp: true }, plugins: [username()] })`, em cache por slug (sai do cache junto com o pool).
  - `criarUsuarioPainel(db, { login; nome; senha; email? })` (servidor; usado pelo `tenant:create` e pela T2.2).
- [ ] **Step 1: Testes** `"T1.9: gestor criado no tenant:create loga no próprio município"`; `"T1.9: usuário de A não loga em B"` (mesmo login e senha no `Host` de B → 401); `"T1.9: cookie de sessão de A enviado ao Host de B não autentica"`; `"T1.9: cadastro aberto pelo painel é recusado"` (`disableSignUp`).
- [ ] **Step 2:** FAIL. **Step 3:** implementar; `npm run db:generate:municipal`. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): per-tenant panel auth and first manager`.

### Task 16: Perfis com escopo e `GET /v1/painel/eu` (T1.9; RN-PERF-01, specs/modelo atores e perfis)

**Files:**
- Create: `infra/database/municipal/schema/perfil.ts` (+ migration), `infra/painel/sessao.ts`, `routes/v1/painel/eu/route.ts`, `tests/integration/v1/painel/eu/get.test.ts`; Modify: `packages/schemas/auth.ts` (`euPainelSchema`), `infra/tenant/criar.ts` (gestor recebe perfil `gestor`, escopo município)

**Interfaces:**
- Consumes: `Perfil` (1A Task 12).
- Produces:
  - Tabela `perfil_usuario(id, usuario_id, perfil text, unidade_id uuid null /* null = município */, concedido_por, concedido_em)`; único em `(usuario_id, perfil, unidade_id)`. `unidade_id` sem chave estrangeira até a T2.2 criar `unidade`.
  - `usuarioDoPainel(req): Promise<{ id; nome; perfis: { perfil: Perfil; unidadeId: string | null }[] } | null>`.
  - `GET /v1/painel/eu` → `euPainelSchema` ou `401 nao_autenticado`.
- [ ] **Step 1: Testes** `"T1.9: eu devolve os perfis com escopo"`; `"sem sessão → 401"`; `"perfil acumulado: agendador e recepção aparecem os dois"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): panel profiles with unit scope`.

### Task 17: Guard de permissões pela matriz (T1.9; RN-PERF-01, specs/permissoes)

**Files:**
- Create: `infra/painel/guard.ts`, `test-routes/painel/protegida/route.ts`, `tests/integration/v1/teste/painel/protegida.test.ts`
- Modify: `apps/api/package.json` (dependência `@fila-saude/domain`)

**Interfaces:**
- Consumes: `pode(perfis, acao)`, `Acao`, `Perfil` (1A Task 12). **Depende da Task 12 da 1A já integrada.**
- Produces: `exigir(acao: Acao, escopo?: (req) => string | null /* unidadeId do recurso */)`: preHandler. Sem sessão → 401; nenhum perfil cujo escopo cubra a unidade com `pode([perfil], acao)` → `403 sem_permissao`. Escopo: perfil com `unidade_id` nulo cobre todas as unidades do município; com `unidade_id` cobre só aquela. Perfis que cobrem a unidade somam permissões (RN-PERF-01).
  - Rota de teste `POST /v1/teste/painel/unidades/:unidadeId/protegida?acao=<Acao>`.
- [ ] **Step 1: Testes** `"RN-PERF-01: perfil com a ação na matriz passa"` (ex.: admin na ação de configurar serviços); `"RN-PERF-01: perfil sem a ação → 403 sem_permissao"` (ex.: profissional na mesma ação); `"RN-PERF-01: admin da unidade 1 → 403 na unidade 2"`; `"RN-PERF-01: gestor (escopo município) cobre qualquer unidade nas ações dele"`; `"perfis acumulados somam"` (agendador + recepção passam nas ações dos dois); `"sem sessão → 401"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): permission guard from the domain matrix`.

### Task 18: Auditoria na mesma transação (T1.9; INV-12, RNF-SEG-04, RN-PERF-03, PD-18)

**Files:**
- Create: `infra/database/municipal/schema/auditoria.ts` (+ migration), `infra/painel/acao.ts`, `test-routes/painel/acao/route.ts`, `tests/integration/v1/teste/painel/acao.test.ts`, `tests/integration/infra/rotas-auditadas.test.ts`

**Interfaces:**
- Consumes: `exigir`, `usuarioDoPainel`.
- Produces:
  - Tabela `auditoria(id, usuario_id, acao text, alvo_tipo text, alvo_id text, unidade_id uuid null, motivo text null, dados jsonb, em timestamptz default now())` — sem dado clínico.
  - `acaoDoPainel<T>(req, meta: { acao: Acao; alvo: { tipo: string; id: string }; unidadeId?: string | null; motivo?: string | null; exigeMotivo?: boolean }, fn: (tx) => Promise<T>): Promise<T>` — sem motivo quando `exigeMotivo` → `400 motivo_obrigatorio` (RN-PERF-03); confere a permissão, roda `fn` e grava a auditoria na mesma transação.
  - Convenção: rotas mutáveis do painel declaram `config: { acao }`; `listarRotasSemAcao(app)` usado pelo teste de rotas.
  - Rota de teste `POST /v1/teste/painel/acao` (grava uma `pessoa_local`; `?falhar=depois` lança depois de gravar).
- [ ] **Step 1: Testes** `"INV-12: ação do painel grava uma auditoria com quem, o quê, quando e alvo"`; `"INV-12: ação que falha depois de gravar não deixa nem o dado nem a auditoria"`; `"RN-PERF-03: ação que exige motivo sem motivo → 400 e nada gravado"`; `"INV-12: auditoria do A não aparece no B"`; em `rotas-auditadas.test.ts`: `"PD-18: toda rota POST/PUT/PATCH/DELETE sob /v1/painel declara config.acao"` (sobe a app Fastify no processo do teste, sem `listen`, e percorre as rotas pelo hook `onRoute`; `/v1/painel/auth/*` fica de fora).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome; `npm run specs:check`. **Step 5:** Commit `feat(api): audit trail in the same transaction as each panel action`.

---

## Paralelismo

As tasks de API compartilham o Postgres de teste (5433), a porta 3333 e as pastas de migrations: **rodam em sequência**, uma por vez, na ordem acima.

| Grupo | Tasks | Pode rodar junto com |
| --- | --- | --- |
| **API (sequencial)** | 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 | Grupo schemas; tasks de `packages/domain` da fase 2 |
| **Schemas (independente)** | 9 (só `packages/schemas`, sem banco) | Qualquer task de API; a Task 10 consome o resultado |

Dependências externas: a Task 17 precisa da Task 12 da 1A (`pode`, `MATRIZ`) integrada; a Task 16 usa o tipo `Perfil` da mesma task (se ainda não estiver integrada, a Task 16 usa um `string` temporário e a Task 17 troca pelo tipo). Nada desta fase depende da Task 11 da 1A (`tokenQr`), que a T3.6 consome.

## Verificação ao fim da fase

- `npm -w @fila-saude/api run test`, `npm -w @fila-saude/schemas run test`, `npm run test:domain` verdes.
- Critérios da [tasks.md](tasks.md): T1.7 (Tasks 3 e 8), T1.8 (Tasks 10, 13), T1.9 (Tasks 15, 17, 18).
- Manual: `npm run tenant:create -- --slug pref-a …` em dev, `curl http://pref-a.localhost:3333/v1/painel/eu` com o cookie do login.

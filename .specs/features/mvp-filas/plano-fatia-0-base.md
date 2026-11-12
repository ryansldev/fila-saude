# Fatia 0 da demo — Base (painel por perfil, tabelas municipais e `demo:seed`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao fim da fatia, `npm run demo:seed` cria o município `demo` com unidade, serviços (um com triagem), estações, uma sessão pública amanhã, uma privada, um usuário do painel por perfil e pacientes na lista de espera, e cada perfil entra no painel em `http://demo.localhost:3000` e vê o próprio menu.

**Architecture:** Primeiro a `feat/fase-2-configuracao` (fase 2, Tasks 1–8) é juntada à `feat/domain-fase-1a`, e o domínio e o painel são adaptados à API revisada da 1A. Depois, em sequência na API: as tabelas municipais (unidade, serviço, estação, sessão, entrada) só com schema e migration; o better-auth do painel por tenant, perfis com escopo, o guard pela matriz (com as ressalvas de `condicoes()`) e a auditoria na mesma transação (1B Tasks 15–18); o CORS do painel (fase 2 Task 9); o guard da sessão do paciente (PD-33); e o `demo:seed`, que usa `criarTenant`, `criarUsuarioPainel`, o handler do better-auth central e `criarEntrada` do domínio, sem rotas de CRUD.

**Tech Stack:** TypeScript (strict, ESM, Node 24); API: Fastify 5 + `@fastify/autoload`, Drizzle + `pg`, better-auth 1.6 (plugin `username`), `@fastify/cors`; painel: Next 16.2, React 19.2, Vitest + jsdom + Testing Library; Zod 4 (`packages/schemas`); Vitest 4 contra servidor real e Postgres de teste na porta 5433; Biome.

**Spec:** fatia 0 da [trilha da demo](tasks.md#trilha-da-demo-2026-11-11), [PD-32 e PD-33](plan.md#1-decisões-de-arquitetura); Tasks 15–18 do [plano 1B](plano-fase-1b-fundacao-api.md) (aqui atualizadas ao código atual) e a Task 9 e as partes de schema das Tasks 10, 16, 17 e 18 do [plano 2](plano-fase-2-configuracao.md); regras em [`specs/modelo`](../../specs/modelo/spec.md) (entidades, configurações, INV-01, INV-02, INV-11, INV-12), [`specs/permissoes`](../../specs/permissoes/spec.md) (RN-PERF-01, RN-PERF-03 e a matriz), [`specs/identidade`](../../specs/identidade/spec.md) (RN-ID-01, RN-ID-05); decisões provisórias em [decisoes-para-revisar](decisoes-para-revisar.md) (P1: ressalvas da matriz). Ledgers: `.superpowers/sdd/plano-fase-1a-dominio/{progress,final-fix-report}.md` (mudanças de API da 1A), `.superpowers/sdd/plano-fase-1b-fundacao-api/progress.md` e `.superpowers/sdd/plano-fase-2-configuracao/progress.md` (pendências que este plano absorve).

**Fora deste plano:** rotas e telas de configuração (unidades, serviços, estações, sessões, usuários: fase 2 Tasks 10–30); séries e worker; e-mail confirmado, recuperação, bloqueio e JWT do paciente (1B Tasks 11–14); fila do dia, abertura de sessão e app (fatia 1).

## Global Constraints

- **TDD sempre** ([tasks.md](tasks.md#tasks-mvp-filas-ubspoliclínicas)): teste → rodar e ver FAIL pelo motivo certo (não por import ou digitação) → implementar → rodar e ver PASS → commit. Refatoração sem comportamento novo (Task 1) roda com a suíte verde antes e depois.
- **API:** ciclo pelo teste de integração da rota (`apps/api/tests/integration`, servidor real em `:3333`, `fetch` de verdade, `<slug>.localhost:3333` para o tenant, bancos por arquivo criados com `orchestrator.criarMunicipio()` e derrubados no `afterAll`, PD-19). Infra sem rota (tabelas, repositório, seed) é testada no processo do Vitest contra o Postgres de teste; nada de mock de banco.
- Rodar um arquivo: `VITEST_ARGS=<caminho> npm -w @fila-saude/api run test`; suíte inteira: `npm -w @fila-saude/api run test`. Painel: `npm run test:painel`. Domínio: `npm run test:domain`. Schemas: `npm -w @fila-saude/schemas run test`.
- Um teste por arquivo de rota/método (`tests/integration/v1/<caminho>/<metodo>.test.ts`); infra em `tests/integration/infra/<modulo>.test.ts`. O nome do teste cita o ID da regra (`"RN-PERF-01: …"`).
- Limites numéricos dos dois lados (L-004): vagas 0/1, ocupadas = vagas e vagas + 1, prefixo de 3 e 4 letras.
- Erros no formato da PD-22 (`{ erro, mensagem?, campos? }`, códigos `snake_case` em português); `401 nao_autenticado`, `403 sem_permissao`, `404 municipio_desconhecido`.
- **Pendências herdadas (ledger da 1B):** o banco do tenant é de um município só; nada grava nem depende de `Tenant.municipioId` (nulo no modo single). O tipo do banco do tenant é `DbDoTenant` (de `infra/database/tenants`) e cada schema novo entra em `schemaMunicipal`. O `429` já sai como `muitas_tentativas` (`montarAuth`).
- **Perfis do painel** nunca incluem `paciente` (o paciente não tem painel). Ações do painel citam a constante `Acao` da 1A.
- Worktrees: seguir `.superpowers/sdd/worktree-setup.md` com **TARGET_BRANCH = `feat/domain-fase-1a`** para todas as tasks desta fatia (a `feat/fase-2-configuracao` deixa de receber trabalho depois da Task 1).
- `npx biome check` limpo nos pacotes tocados e `npm run specs:check` sem erros ao fim de cada task.

## Decisões desta fatia

Provisórias e reversíveis, como as anteriores. Registradas também no [plan.md](plan.md#1-decisões-de-arquitetura).

| ID | Decisão | Por quê | Custa se errado |
| --- | --- | --- | --- |
| PD-34 | **Guard da sessão do paciente (PD-33):** um decorator `app.exigirPaciente` chama `authCentral.api.getSession({ headers })` com os cabeçalhos da requisição (cookie da sessão central; o cliente Expo da fatia 1 manda o cookie no cabeçalho) e preenche `req.paciente = { pacienteId, cpf, verificado }`, o mesmo formato que o verificador do JWT (PD-17) devolverá. Só no modo multi (lê o banco central) | Uma peça só para trocar pelo JWT depois; as rotas do app não sabem como o paciente foi autenticado | Baixo: troca de um arquivo. Não funciona no modo single, que a demo não usa |
| PD-35 | **Configuração da unidade numa coluna `config jsonb`** (um `ConfigParcial` do domínio, validado por `validarConfig` ao gravar) em vez de uma coluna anulável por campo; sem tabela `config_municipio` nesta fatia (o nível município é `{}` e herda o padrão) | A herança (PD-28) continua igual, calculada por `configEfetiva`; o formato no banco é o mesmo objeto que o domínio recebe | Baixo: virar colunas é uma migration; consultas por campo de configuração não existem |
| PD-36 | **Toda entrada aponta para uma `pessoa_local`** (a pessoa atendida, inclusive o próprio dono da conta, ligado por `paciente_id`, AD-035) e guarda `responsavel_paciente_id` (conta que recebe os avisos, ou nulo). O `Entrada` do domínio vira colunas + `jsonb` (`classificacao`, `prioridade`) por um repositório único (`infra/fila/entradas.ts`) com teste de ida e volta | Uma forma só de achar a pessoa atendida no município (RN-LE-02, INV-01 por pessoa) e um lugar só que converte linha ↔ domínio | Baixo: o repositório isola o formato |
| PD-37 | **`sessao.ocupadas` é um contador gravado** junto com `versao` (trava otimista para as fatias seguintes), com `CHECK (vagas IS NULL OR ocupadas <= vagas)` e `CHECK (vagas >= 1)` | INV-02 também no banco: um erro de contagem na API vira falha da transação, não sessão lotada além do limite | Baixo: recontar a partir das entradas é uma consulta |
| PD-38 | **Guard com ressalvas fechado por padrão** (P1): `exigir(acao, { unidade?, ressalvas? })` só soma os perfis cujo escopo cobre a unidade do recurso (sem unidade, só os de escopo município); com `condicoes()` = `"livre"` passa; com ressalvas, passa só se a rota declarou uma conferência para uma delas e ela devolveu `true`; senão `403 sem_permissao` | Uma rota que esqueça a ressalva nega em vez de vazar (ex.: profissional chamando na triagem) | Baixo: a conferência é por rota |
| PD-39 | **Auth do painel no banco do tenant:** tabelas `usuario_painel`, `sessao_painel`, `conta_painel`, `verificacao_painel` (`sessao` já é a sessão de atendimento); cookies com prefixo `fila-painel`; origem do painel por `PAINEL_ORIGEM_TEMPLATE` (`http://{slug}.localhost:3000` em dev, `https://{slug}.filasaude.com.br` em produção), usada no CORS e no `trustedOrigins` | Sem confusão de nomes no banco nem de cookie com a sessão central (que também responde no subdomínio, ruling da 1B Task 8); uma variável só para dev e produção, como `TENANT_DATABASE_URL_TEMPLATE` | Baixo: renomear tabelas é migration; o prefixo invalida sessões abertas |
| PD-40 | **`demo:seed`** roda só com `NODE_ENV=development` e `TENANT_MODE=multi`; apaga e recria o município `demo` (banco com `DROP … WITH (FORCE)`) e os pacientes da demo no central (por CPF, com contas e sessões em cascata); cria pacientes pelo handler do better-auth central (mesmos hooks do HTTP) e marca o e-mail como confirmado; usuários pelo `criarUsuarioPainel`; configuração gravada direto nas tabelas (PD-33) e sem auditoria (não é ação do painel); senhas fixas impressas no terminal | Repetível antes de cada apresentação, pelos mesmos caminhos do produto onde eles existem | Baixo: só dados de teste; nunca roda em produção |

## Review Focus

1. **Vazamento entre municípios no painel:** usuário, cookie e perfis de A nunca valem em B; origem do painel de B chamando o host de A não recebe CORS. Testes nas Tasks 5, 6 e 9.
2. **Ressalva da matriz esquecida:** perfil que só tem a ação com ressalva (profissional em "chamar", recepção em "ver resposta sobre tirar a própria vida") passa sem conferência. Deve dar 403. Teste na Task 7.
3. **Cookie do lugar errado:** cookie do painel apresentado como paciente, cookie do paciente no `/v1/painel/eu`, sessão encerrada (sign-out) → 401 nos três. Testes nas Tasks 6 e 10.
4. **"Amanhã" no fuso da unidade:** seed rodado às 23:30 de Brasília cria a sessão no dia seguinte local (não no dia seguinte UTC, que já seria depois de amanhã). Teste na Task 11.
5. **Rodar o seed de novo, inclusive depois de uma execução interrompida e com a API no ar:** sem paciente duplicado (`cpf_em_uso`), sem município preso em `criando`, e o login do painel funciona sem reiniciar a API. Testes na Task 11.

---

## Estrutura de arquivos

```
packages/domain/src/{index.ts, configuracao.ts, lista.ts}   merge + adaptação (Task 1)
packages/schemas/auth.ts                                     + euPainelSchema (Task 2)
apps/painel/lib/{sessao.tsx, api.ts}                         login por `login`, contratos de packages/schemas (Task 2)
apps/painel/components/formulario-login.tsx
apps/api/
  app.ts                                 construirApp() sem listen (Task 8); server.ts só escuta
  infra/database/municipal/schema/
    unidade.ts · servico.ts · estacao.ts · sessao.ts       (Task 3)
    entrada.ts                                              (Task 4)
    auth.ts                                                 (Task 5)
    perfil.ts                                               (Task 6)
    auditoria.ts                                            (Task 8)
  infra/fila/entradas.ts                 pessoaAtendida(), inserirEntrada(), lerEntrada() (Task 4)
  infra/auth/painel.ts                   authDoTenant(), criarUsuarioPainel() (Task 5)
  infra/auth/sessao-paciente.ts          pacienteDaSessao(), plugin exigirPaciente (Task 10)
  infra/painel/{sessao.ts, guard.ts, acao.ts, cors.ts}      (Tasks 6–9)
  infra/tenant/derrubar.ts               derrubarTenant() (Task 11)
  infra/demo/semear.ts                   semearDemo(), podeSemear() (Task 11)
  infra/scripts/demo-seed.ts
  routes/v1/painel/{auth,eu}/route.ts
  test-routes/painel/{protegida,acao}/route.ts · test-routes/municipios/_slug/paciente/eu/route.ts
```

---

### Task 1: Juntar a fase 2 e adaptar o domínio revisado (PD-32)

Primeira de todas, sozinha. Conflitos conferidos com `git merge-tree` (base `f70134e`): `package-lock.json`, `packages/domain/src/index.ts` e `packages/schemas/package.json`. O resto junta sozinho, mas o `index.ts` resolvido exporta `Origem` duas vezes (`lista.ts`: origem do remanejado; `configuracao.ts`: origem do valor herdado) e não compila.

**Files:**
- Modify (merge): `packages/domain/src/index.ts` (união dos dois blocos: `sessao.ts` da 1A e `servico.ts`/`sessao-config.ts`/`tempo.ts` da fase 2, com `instanteParaLocal` e `localParaInstante`), `packages/schemas/package.json` (um só `scripts`: `test` e `test:watch`), `package-lock.json` (regenerado), `packages/domain/src/configuracao.ts` e `test/configuracao.test.ts` (tipo `Origem` → `OrigemConfig`), `packages/domain/src/lista.ts` (`destinoPorCondicao` delega a `transicaoUnica`, pendência do ruling da fase 2 Task 5)

**Interfaces:**
- Consumes: branches `feat/domain-fase-1a` (1A completa + 1B Tasks 1–10) e `feat/fase-2-configuracao` (fase 2 Tasks 1–8).
- Produces: `export type OrigemConfig = "padrao" | "municipio" | "unidade"` (e `ConfigEfetiva.origem: Record<string, OrigemConfig>`); `Origem` continua sendo a do remanejado. `destinoPorCondicao(de, evento, filtro)` mantém assinatura e comportamento, implementada com `transicaoUnica(TRANSICOES_ENTRADA, de, evento, filtro)` (nenhuma linha → lança como hoje). Regra para o resto: se um teste da fase 2 quebra pela API revisada da 1A (`desistir`, `recusar` com `dia: null`, `liberarVaga`/`ficarElegivel` fora do pacote, `lancarRegulado` sem `config`, `ItemFila.motivoSaida`, `Estimativa` nova, `Entrada.prioridade.grupos` sem idoso), adapta-se o código da fase 2, nunca o da 1A.

- [ ] **Step 1:** `git merge --no-ff feat/fase-2-configuracao`; resolver `index.ts` (união) e `packages/schemas/package.json`; no lockfile, `git checkout --ours package-lock.json` e `npm install --package-lock-only`, depois `npm ci`.
- [ ] **Step 2: Ver falhar:** `npm -w @fila-saude/domain run check-types` → FAIL com identificador `Origem` duplicado no `index.ts` (o motivo certo). `npm run test:domain`, `npm -w @fila-saude/schemas run test`, `npm run test:painel` e `npm -w @fila-saude/api run test` rodam para listar qualquer outra quebra.
- [ ] **Step 3:** Renomear para `OrigemConfig`; adaptar o que mais quebrou pela regra acima. Commit do merge `merge: fase 2 (tasks 1–8) into the demo base`.
- [ ] **Step 4: Refatoração com a suíte como rede:** trocar o corpo de `destinoPorCondicao` por `transicaoUnica`; `npm run test:domain` verde antes e depois (sem teste novo: o comportamento não muda).
- [ ] **Step 5: Verificar:** domínio, schemas, painel e API verdes; `npm -w @fila-saude/painel run build` compila; `npx biome check packages apps/painel`; `npm run specs:check` com 0 erros.
- [ ] **Step 6:** Commit `refactor(domain): one contract row selector after the phase 2 merge` .

### Task 2: Painel no contrato do painel: login por `login` e schemas compartilhados (T2.1; PD-23, PD-31)

**Files:**
- Modify: `packages/schemas/auth.ts` (+ `euPainelSchema`), `packages/schemas/test/auth.test.ts`, `apps/painel/package.json` (dependência `@fila-saude/schemas`), `apps/painel/lib/sessao.tsx`, `apps/painel/lib/api.ts`, `apps/painel/components/formulario-login.tsx`, `apps/painel/test/login.test.tsx`, `apps/painel/test/api.test.ts`

**Interfaces:**
- Consumes: `erroSchema` (`packages/schemas/erros.ts`), `Perfil` (domínio).
- Produces:
  - `euPainelSchema = z.object({ id: z.string(), nome: z.string(), login: z.string(), perfis: z.array(z.object({ perfil: perfilPainelSchema, unidadeId: z.uuid().nullable() })) })`; `type EuPainel`. Substitui o tipo local `EuPainel` do painel (TODO da fase 2 Task 8).
  - `entrar(api, login, senha)` faz `POST /v1/painel/auth/sign-in/username` com `{ username: login, password: senha }` (PD-23: o painel loga por login, não por e-mail); `useLogin(...).enviar(login, senha)`.
  - `useEu` valida a resposta com `euPainelSchema`; corpo fora do contrato → `{ estado: "erro" }`.
  - `criarApi` reconhece o corpo de erro com `erroSchema.safeParse` (remove `ehCorpoDeErro`).
  - Formulário: campo "Login" (`autoComplete="username"`, sem `type="email"`); mensagem de credenciais: "Login ou senha inválidos."
- [ ] **Step 1: Testes** `packages/schemas`: `"euPainelSchema aceita perfis com e sem unidade e recusa perfil paciente"`. Painel: `"login: envia username e password para sign-in/username"` (API falsa confere caminho e corpo); `"login: 401 mostra 'Login ou senha inválidos.'"`; `"eu fora do contrato vira erro, não autenticado"`; `"api: erro no formato da PD-22 vira ErroDaApi com campos"` (já existe; passa a usar `erroSchema`).
- [ ] **Step 2:** `npm -w @fila-saude/schemas run test` e `npm run test:painel` → FAIL (`euPainelSchema` não existe; caminho `sign-in/email`).
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS; `npx biome check apps/painel packages/schemas`; build do painel.
- [ ] **Step 5:** Commit `feat(painel): sign in by login and shared panel contracts`.

### Task 3: Tabelas municipais de unidade, serviço, estação e sessão (T2.2, T2.3, T2.5; specs/modelo; PD-35, PD-37)

Só schema e migration; sem rotas.

**Files:**
- Create: `apps/api/infra/database/municipal/schema/{unidade,servico,estacao,sessao}.ts`, migration municipal (`npm run db:generate:municipal`), `tests/integration/infra/tabelas-configuracao.test.ts`
- Modify: `infra/database/tenants.ts` (`schemaMunicipal` com os novos módulos), `tests/orchestrator.ts` (`bancoDoMunicipio(slug): DbDoTenant` para os testes de infra)

**Interfaces:**
- Consumes: `EstadoSessao`, `TRANSICOES_SESSAO`, `Etapa`, `ModoServico`, `ConfigParcial` (domínio); formatos de `unidadeEntradaSchema` (`horarioSchema`).
- Produces (nomes de coluna em `snake_case`, campos Drizzle em `camelCase`):
  - `unidade(id uuid pk, nome, tipo enum("ubs","policlinica","upa") default "ubs", endereco, lat double, lng double, fuso text, horario jsonb, config jsonb not null default '{}' /* ConfigParcial, PD-35 */, criado_em)`.
  - `servico(id, unidade_id fk, nome, prefixo text check ~ '^[A-Z]{1,3}$', exige_triagem bool default false, modo enum("livre","requisicao","regulado") default "livre", tempo_medio_triagem_min int null, tempo_medio_atendimento_min int not null default 15, ativo bool default true, criado_em)`; único `(unidade_id, prefixo)`.
  - `estacao(id, unidade_id fk, nome, etapa enum("triagem","atendimento"), aberta bool default false, ultimo_sinal_em null, arquivada_em null, criado_em)` e `estacao_servico(estacao_id fk, servico_id fk, pk dos dois)`.
  - `sessao(id, servico_id fk, inicio timestamptz, fim timestamptz check fim > inicio, vagas int null check vagas >= 1, ocupadas int not null default 0 check ocupadas >= 0 and (vagas is null or ocupadas <= vagas), visibilidade enum("publica","privada") default "privada", dispensa_pre_cadastro bool default false check (not dispensa_pre_cadastro or visibilidade = 'publica'), profissional text null, estado enum(EstadoSessao) default "planejada", versao int default 0, criado_em)` e `sessao_estacao(sessao_id fk, estacao_id fk, pk dos dois)`. Séries (`serie_id`, `chave_ocorrencia`) ficam para a fase 2 Task 20.
- [ ] **Step 1: Testes** `"modelo: tenant novo tem unidade, servico, estacao, estacao_servico, sessao e sessao_estacao"`; `"modelo: padrões — serviço livre, sem triagem, 15 min; sessão privada, planejada, sem dispensa"`; `"T2.3: prefixo repetido na mesma unidade é recusado; em outra unidade, aceito"`; `"prefixo de 3 letras aceito, de 4 recusado"`; `"INV-02: vagas 0 recusado, 1 aceito; ocupadas = vagas aceito, vagas + 1 recusado; sem limite aceita"`; `"AD-016: dispensa de pré-cadastro em sessão privada é recusada"`; `"fim antes do início é recusado"`; `"contrato: estados de sessao, modos e etapas no banco são os do domínio"` (compara os valores dos enums do Postgres com os estados que aparecem em `TRANSICOES_SESSAO` e com as listas de `ModoServico`/`Etapa`).
- [ ] **Step 2:** `VITEST_ARGS=tests/integration/infra/tabelas-configuracao.test.ts npm -w @fila-saude/api run test` → FAIL (tabela `unidade` não existe).
- [ ] **Step 3:** Schemas, `npm run db:generate:municipal`, `schemaMunicipal`.
- [ ] **Step 4:** PASS; suíte da API inteira verde; biome.
- [ ] **Step 5:** Commit `feat(api): municipal unit, service, station and session tables`.

### Task 4: Entrada e pessoa atendida no banco (PD-30, PD-36; INV-01, RN-LE-02, AD-035)

**Files:**
- Create: `infra/database/municipal/schema/entrada.ts` (+ migration), `infra/fila/entradas.ts`, `tests/integration/infra/entradas.test.ts`
- Modify: `infra/database/tenants.ts` (`schemaMunicipal`)

**Interfaces:**
- Consumes: `Entrada`, `EstadoEntrada`, `TRANSICOES_ENTRADA`, `NivelRisco`, `Origem`, `criarEntrada` (domínio); `pessoa_local` (1B Task 2); tabelas da Task 3.
- Produces:
  - `entrada(id uuid pk, servico_id fk, pessoa_local_id fk not null, responsavel_paciente_id text null /* id central, sem FK */, estado enum(EstadoEntrada), data_entrada_original timestamptz, classificacao jsonb, risco_confirmado enum(NivelRisco) null, prioridade jsonb, remanejada enum("privada","publica","regulada") null, recusas int default 0, sessao_id fk null, alocada_em, perguntado_em, respondido_em, arquivada_em timestamptz null, sessoes_recusadas uuid[] default '{}', versao int default 0, criado_em)`; índice único parcial `(servico_id, pessoa_local_id)` onde `estado not in ('cancelada','concluida','encerrada_sem_atendimento','arquivada')` (INV-01; arquivada não conta, decisão L2).
  - `pessoaAtendida(db: DbDoTenant | TxDoTenant, p: { nome: string; nascimento: string; cpf: string | null; pacienteId: string | null }): Promise<{ id: string }>` — com CPF, reaproveita a `pessoa_local` do mesmo CPF (preenche `paciente_id` se faltava); sem CPF, cria.
  - `inserirEntrada(db, entrada: Entrada, pessoaLocalId: string): Promise<void>`; `lerEntrada(db, id: string): Promise<Entrada | null>` (junta `pessoa_local` para montar `Entrada.pessoa`). `type TxDoTenant` exportado de `infra/database/tenants`.
- [ ] **Step 1: Testes** `"PD-36: entrada criada pelo domínio volta igual do banco"` (`criarEntrada` com prioridade declarada e classificação; `inserirEntrada`; `lerEntrada` → `toEqual`); `"INV-01: segunda entrada ativa da mesma pessoa no serviço é recusada pelo banco; depois de cancelada, aceita"`; `"RN-LE-02: pessoa atendida com o mesmo CPF é a mesma pessoa_local"`; `"AD-035: dono da conta ganha pessoa_local ligada ao paciente_id"`; `"contrato: estados da entrada no banco são os do domínio"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar; `npm run db:generate:municipal`. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): waitlist entries stored from the domain shape`.

### Task 5: better-auth do painel por tenant e primeiro gestor (1B Task 15; T1.9; PD-05, PD-23, PD-39)

**Files:**
- Create: `infra/database/municipal/schema/auth.ts` (+ migration), `infra/auth/painel.ts`, `routes/v1/painel/auth/route.ts`, `tests/integration/v1/painel/auth/login.test.ts`
- Modify: `infra/database/tenants.ts` (`schemaMunicipal`), `infra/tenant/criar.ts` (`gestor?: { login; nome; senha }`), `infra/scripts/tenant-create.ts` (`--gestor-login`, `--gestor-nome`; senha pedida no terminal), `tests/orchestrator.ts` (`loginPainel(slug, login, senha): Promise<string /* cookie */>`, `criarMunicipio({ gestor })`)

**Interfaces:**
- Consumes: `montarAuth` (`infra/auth/fastify.ts`), `app.exigirTenant`, `DbDoTenant`.
- Produces:
  - Tabelas do better-auth no tenant com os nomes da PD-39 (`user.modelName: "usuario_painel"`, `session.modelName: "sessao_painel"`, `account.modelName: "conta_painel"`, `verification.modelName: "verificacao_painel"`), mais `username`/`display_username`.
  - `authDoTenant(slug: string, db: DbDoTenant): Auth` — `betterAuth({ basePath: "/v1/painel/auth", baseURL: "http://<slug>.<TENANT_BASE_DOMAIN>:3333" em dev (a partir de CENTRAL_URL trocando o host), database: drizzleAdapter(db, schema municipal), emailAndPassword: { enabled: true, minPasswordLength: 8, disableSignUp: true }, disabledPaths: ["/is-username-available"], advanced: { cookiePrefix: "fila-painel" }, plugins: [username()] })`; em cache num `WeakMap<DbDoTenant, Auth>` (sai junto com o pool).
  - Rota `GET|POST /v1/painel/auth/*` com `preHandler: app.exigirTenant` e `montarAuth(app, "/v1/painel/auth", (req) => authDoTenant(req.tenant.slug, req.tenant.db))`.
  - `criarUsuarioPainel(db: DbDoTenant, dados: { login: string; nome: string; senha: string; email?: string }): Promise<{ id: string }>` — pelo `internalAdapter` do contexto do better-auth (`createUser` + conta `credential` com o hash do próprio better-auth); sem e-mail grava `<login>@painel.invalid`. Usado por `criarTenant` (gestor) e pelo seed.
- [ ] **Step 1: Testes** `"T1.9: gestor criado com o município loga no próprio município"` (`POST /v1/painel/auth/sign-in/username` no Host do tenant → 200 e cookie `fila-painel…`); `"T1.9: usuário de A não loga em B"` (mesmo login e senha no Host de B → 401 `credenciais_invalidas`); `"T1.9: cookie de A enviado ao Host de B não autentica"` (`get-session` em B → sem sessão); `"T1.9: cadastro aberto pelo painel é recusado"`; `"senha errada → 401 credenciais_invalidas"`; `"T1.9: tenant:create aceita o gestor"` (em `criar-tenant.test.ts`, chamando `criarTenant` com `gestor`).
- [ ] **Step 2:** FAIL. **Step 3:** implementar; `npm run db:generate:municipal`. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): per-tenant panel auth and first manager`.

### Task 6: Perfis com escopo e `GET /v1/painel/eu` (1B Task 16; T1.9; RN-PERF-01, specs/modelo atores e perfis)

**Files:**
- Create: `infra/database/municipal/schema/perfil.ts` (+ migration), `infra/painel/sessao.ts`, `routes/v1/painel/eu/route.ts`, `tests/integration/v1/painel/eu/get.test.ts`
- Modify: `infra/tenant/criar.ts` (gestor recebe perfil `gestor`, escopo município), `infra/database/tenants.ts`, `tests/orchestrator.ts` (`criarUsuarioComPerfis(slug, login, perfis)`)

**Interfaces:**
- Consumes: `Perfil`, `euPainelSchema` (Task 2), `authDoTenant`, `criarUsuarioPainel` (Task 5), `unidade` (Task 3).
- Produces:
  - `perfil_usuario(id, usuario_id fk usuario_painel, perfil enum("gestor","admin","agendador","recepcao","triagem","profissional"), unidade_id uuid null fk unidade, concedido_por text null, concedido_em)`; único `(usuario_id, perfil, unidade_id)` com `NULLS NOT DISTINCT`; `CHECK ((perfil = 'gestor') = (unidade_id IS NULL))` (gestor é do município; os outros, de uma unidade, specs/modelo).
  - `concederPerfis(db, usuarioId: string, perfis: { perfil: Perfil; unidadeId: string | null }[], concedidoPor: string | null): Promise<void>`.
  - `usuarioDoPainel(req): Promise<{ id: string; nome: string; login: string; perfis: { perfil: Perfil; unidadeId: string | null }[] } | null>` (sessão por `authDoTenant(...).api.getSession({ headers })`; memoizado na requisição).
  - `GET /v1/painel/eu` (`exigirTenant`) → corpo validado por `euPainelSchema`, ou `401 nao_autenticado`.
- [ ] **Step 1: Testes** `"T1.9: eu devolve os perfis com escopo"`; `"RN-PERF-01: perfis acumulados (agendador e recepção) aparecem os dois"`; `"sem sessão → 401"`; `"cookie de sessão do paciente da central → 401"`; `"modelo: gestor com unidade e admin sem unidade são recusados pelo banco"`; `"perfil de A não aparece no eu de B"` (mesmo login criado nos dois).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): panel profiles with unit scope`.

### Task 7: Guard de permissões pela matriz, com ressalvas (1B Task 17; RN-PERF-01, specs/permissoes; decisão P1, PD-38)

**Files:**
- Create: `infra/painel/guard.ts`, `test-routes/painel/unidades/_unidadeId/protegida/route.ts`, `tests/integration/v1/teste/painel/protegida.test.ts`, `tests/unit/infra/painel/guard.test.ts`
- Modify: `apps/api/package.json` (dependência `@fila-saude/domain`, se ainda não houver)

**Interfaces:**
- Consumes: `condicoes`, `Acao`, `Perfil`, `MATRIZ` (domínio); `usuarioDoPainel`.
- Produces:
  - `condicoesNaUnidade(perfis: { perfil: Perfil; unidadeId: string | null }[], acao: Acao, unidadeId: string | null): "livre" | string[] | null` — puro; considera só os perfis de escopo município e, quando `unidadeId` não é nulo, os da mesma unidade; devolve `condicoes(...)` desses.
  - `type Ressalvas = Partial<Record<string /* texto da ressalva na MATRIZ */, (req: FastifyRequest) => boolean | Promise<boolean>>>`.
  - `verificarPermissao(req, acao: Acao, unidadeId: string | null, ressalvas?: Ressalvas): Promise<void>` — sem sessão → `401 nao_autenticado`; `null` → `403 sem_permissao`; `"livre"` → ok; lista → ok só se alguma ressalva da lista tem conferência em `ressalvas` e ela devolve `true`; senão 403.
  - `exigir(acao: Acao, opcoes?: { unidade?: (req) => string | null; ressalvas?: Ressalvas })` → preHandler que chama `verificarPermissao` (as rotas usam `preHandler: [app.exigirTenant, exigir(...)]`).
  - Rota de teste `POST /v1/teste/painel/unidades/:unidadeId/protegida?acao=<Acao>&ressalva=sim|nao` (conferência para todas as ressalvas da matriz devolvendo `ressalva === "sim"`).
- [ ] **Step 1: Testes** (integração) `"RN-PERF-01: admin passa em configurar_servicos_sessoes_estacoes_tv na própria unidade"`; `"RN-PERF-01: profissional na mesma ação → 403 sem_permissao"`; `"RN-PERF-01: admin da unidade 1 → 403 na unidade 2"`; `"RN-PERF-01: gestor (escopo município) passa nas ações dele em qualquer unidade"`; `"RN-PERF-01: perfis acumulados somam"` (agendador + recepção passam em `validar_requisicao` e em `incluir_no_balcao_e_marcar_presenca`); `"P1: profissional em operar_chamadas sem a ressalva conferida → 403; conferida → passa"`; `"P1: recepção em ver_resposta_risco_de_vida ('só ao aplicar no balcão') sem conferência → 403"`; `"sem sessão → 401"`. (Unidade) `condicoesNaUnidade`: `"ação sem unidade só conta perfil de escopo município"` (admin da unidade 1 em `criar_unidades_regras_usuarios` → `null`).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): permission guard from the domain matrix`.

### Task 8: Auditoria na mesma transação (1B Task 18; INV-12, RNF-SEG-04, RN-PERF-03, PD-18)

**Files:**
- Create: `apps/api/app.ts`, `infra/database/municipal/schema/auditoria.ts` (+ migration), `infra/painel/acao.ts`, `test-routes/painel/acao/route.ts`, `tests/integration/v1/teste/painel/acao.test.ts`, `tests/integration/infra/rotas-auditadas.test.ts`
- Modify: `server.ts` (só `const app = await construirApp(); await app.listen(...)`)

**Interfaces:**
- Consumes: `verificarPermissao`, `usuarioDoPainel`, `TxDoTenant`.
- Produces:
  - `construirApp(): Promise<FastifyInstance>` — tudo o que `server.ts` faz hoje, sem `listen` (o teste de rotas sobe a app no processo do Vitest).
  - `auditoria(id, usuario_id text, acao text, alvo_tipo text, alvo_id text, unidade_id uuid null, motivo text null, dados jsonb null, em timestamptz default now())` — sem dado clínico e sem id do município (o banco é do município).
  - `acaoDoPainel<T>(req, meta: { acao: Acao; alvo: { tipo: string; id: string }; unidadeId?: string | null; motivo?: string | null; exigeMotivo?: boolean; ressalvas?: Ressalvas; dados?: Record<string, unknown> }, fn: (tx: TxDoTenant) => Promise<T>): Promise<T>` — sem motivo com `exigeMotivo` → `400 motivo_obrigatorio` (RN-PERF-03); `verificarPermissao`; transação no banco do tenant; `fn`; insere a auditoria antes do commit.
  - Convenção: rotas mutáveis do painel declaram `config: { acao }`; `listarRotasSemAcao(app): string[]`.
  - Rota de teste `POST /v1/teste/painel/acao` (grava uma `pessoa_local`; `?falhar=depois` lança depois de gravar; `?exigeMotivo=1`).
- [ ] **Step 1: Testes** `"INV-12: ação do painel grava uma auditoria com quem, o quê, quando e alvo"`; `"INV-12: ação que falha depois de gravar não deixa nem o dado nem a auditoria"`; `"RN-PERF-03: ação que exige motivo, sem motivo → 400 motivo_obrigatorio e nada gravado"`; `"INV-12: sem permissão → 403 e nenhuma auditoria"`; `"INV-12: auditoria de A não aparece em B"`; em `rotas-auditadas.test.ts`: `"PD-18: toda rota POST/PUT/PATCH/DELETE sob /v1/painel declara config.acao"` (rotas coletadas pelo hook `onRoute`; `/v1/painel/auth/*` fica de fora; o teste também confere que uma rota falsa sem `acao` é apontada).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; suíte inteira; biome. **Step 5:** Commit `feat(api): audit trail in the same transaction as each panel action`.

### Task 9: CORS do painel e login em dois subdomínios (fase 2 Task 9; T2.1; PD-24, PD-39)

**Files:**
- Create: `infra/painel/cors.ts`, `tests/integration/v1/painel/cors.test.ts`
- Modify: `app.ts` (registra o CORS), `infra/env.ts` e `.env.*` (`PAINEL_ORIGEM_TEMPLATE` com `{slug}`), `infra/auth/painel.ts` (`trustedOrigins: [origemDoPainel(slug)]`), `apps/api/package.json` (`@fastify/cors`, versão exata), `tests/orchestrator.ts` (`origemDoPainel(slug)`)

**Interfaces:**
- Produces: `origemDoPainel(slug: string): string` (de `PAINEL_ORIGEM_TEMPLATE`); `origemPermitida(origem: string | undefined, host: string | undefined, config): boolean` — puro: verdadeiro só se o slug do `Host` (pelo `resolverTenant`) existe e `origem === origemDoPainel(slug)`. CORS com `credentials: true`, métodos `GET, POST, PUT, PATCH, DELETE`; preflight `OPTIONS` → 204; origem recusada não recebe `Access-Control-Allow-Origin`.
- [ ] **Step 1: Testes** `"T2.1: login do painel de A pela origem do painel de A funciona e devolve o cookie com CORS"` (`Origin: http://<A>.localhost:3000` → 200, `access-control-allow-origin` igual à origem, `allow-credentials: true`, `set-cookie`); `"T2.1: o mesmo para B; o eu de cada um mostra o próprio usuário"`; `"PD-24: origem do painel de B chamando o Host de A não recebe CORS e o better-auth recusa o login"`; `"PD-24: origem desconhecida não recebe CORS"`; `"PD-24: preflight responde 204"`; unidade de `origemPermitida` (host raiz, porta errada, subdomínio duplo).
- [ ] **Step 2:** `VITEST_ARGS=tests/integration/v1/painel/cors.test.ts npm -w @fila-saude/api run test` → FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): same-tenant CORS for the panel`.

### Task 10: Guard da sessão do paciente (PD-33, PD-34; RN-ID-05)

**Files:**
- Create: `infra/auth/sessao-paciente.ts`, `test-routes/municipios/_slug/paciente/eu/route.ts`, `tests/integration/v1/teste/municipios/paciente-eu.test.ts`
- Modify: `app.ts` (registra o plugin), `tests/orchestrator.ts` (`loginPaciente(cpf, senha): Promise<string /* cookie */>`)

**Interfaces:**
- Consumes: `authCentral`, `paciente` (central), `app.exigirTenant`.
- Produces:
  - `type PacienteAutenticado = { pacienteId: string; cpf: string; verificado: boolean }` (o formato do verificador da PD-17).
  - `pacienteDaSessao(headers: Headers): Promise<PacienteAutenticado | null>` (`verificado = verificadoEm !== null`).
  - Plugin: `req.paciente: PacienteAutenticado | null`; decorator `app.exigirPaciente` (preHandler) → `401 nao_autenticado` sem sessão válida. As rotas do app usam `preHandler: [app.exigirTenant, app.exigirPaciente]` (o 404 do município vem antes do 401).
  - Rota de teste `GET /v1/teste/municipios/:slug/paciente/eu` → `req.paciente`.
- [ ] **Step 1: Testes** `"PD-33: sessão do paciente da central autentica numa rota do município pelo caminho"` (cadastro, `sign-in/username`, cookie na rota do tenant → 200 com `pacienteId` e `cpf`); `"RN-ID-05: conta nova chega como não verificada"`; `"PD-33: sem cookie → 401 nao_autenticado"`; `"PD-33: cookie adulterado → 401; depois do sign-out → 401"`; `"PD-33: cookie de sessão do painel não autentica como paciente"`; `"PD-15: município desconhecido com sessão válida → 404 municipio_desconhecido"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): patient session guard on tenant routes`.

### Task 11: `npm run demo:seed` (fatia 0; PD-33, PD-40)

**Files:**
- Create: `infra/tenant/derrubar.ts`, `infra/demo/semear.ts`, `infra/scripts/demo-seed.ts`, `tests/integration/infra/demo-seed.test.ts`, `tests/unit/infra/demo/pode-semear.test.ts`
- Modify: `apps/api/package.json` (`"demo:seed": "tsx infra/scripts/demo-seed.ts"`), `package.json` raiz (`"demo:seed": "npm -w @fila-saude/api run demo:seed"`)

**Interfaces:**
- Consumes: `criarTenant` (com `gestor`), `migrarBanco`, `criarUsuarioPainel`, `concederPerfis`, `authCentral.handler`, `pessoaAtendida`, `inserirEntrada`, tabelas das Tasks 3–4; domínio `criarEntrada`, `localParaInstante`, `instanteParaLocal`, `validarConfig`; `cpfValido`.
- Produces:
  - `derrubarTenant(slug: string, deps: { central: Db; template: string }): Promise<void>` — `DROP DATABASE IF EXISTS … WITH (FORCE)` e apaga a linha de `municipio` (qualquer status).
  - `podeSemear(env: { NODE_ENV: string; TENANT_MODE: string }): boolean` — só `development` + `multi`.
  - `semearDemo(deps: { central: Db; template: string; agora: number; slug?: string /* padrão "demo" */ }): Promise<ResumoDemo>`; `type ResumoDemo = { painel: string; usuarios: { perfil: Perfil; login: string; senha: string }[]; pacientes: { nome: string; cpf: string; senha: string }[]; sessoes: { servico: string; visibilidade: "publica" | "privada"; inicioLocal: string }[] }`.
  - Passos, nesta ordem: migra o central; apaga os pacientes da demo pelo CPF; `derrubarTenant`; `criarTenant({ slug, nome: "Município Demo", uf: "SP", gestor: { login: "gestor", nome: "Gestora Demo", senha } })`; unidade "UBS Centro" (`ubs`, `America/Sao_Paulo`, seg–sex 07:00–17:00, `config: {}`); serviços "Clínico geral" (`C`, exige triagem, livre, triagem 5 min, atendimento 15) e "Odontologia" (`O`, sem triagem, livre, atendimento 20); estações "Triagem 1" (triagem; Clínico), "Consultório 1" (atendimento; Clínico), "Consultório 2" (atendimento; Odontologia); sessão **pública** do Clínico amanhã 08:00–12:00 local (20 vagas, Triagem 1 + Consultório 1, "Dra. Helena") e **privada** da Odontologia amanhã 13:00–17:00 (4 vagas, Consultório 2, "Dr. Paulo"), "amanhã" = dia seguinte a `agora` no fuso da unidade; usuários `admin`, `agendador`, `recepcao`, `triagem`, `profissional` com escopo na UBS Centro; pacientes Ana Souza (nascida em 1958, idosa), Bruno Lima e Carla Dias (declara gestante) cadastrados por `POST /v1/auth/sign-up/email` via `authCentral.handler` e com `email_verified = true`; entradas `aguardando` na Odontologia pelo `criarEntrada` para os três e para José Pereira (pessoa local sem app, `responsavelId: null`). Todas as senhas: `demo1234`. CPFs fixos no código, válidos pelo `cpfValido`.
  - Script: recusa com mensagem e código 1 quando `!podeSemear(env)`; chama `semearDemo` com `Date.now()`; imprime a URL do painel (`origemDoPainel("demo")` + `/login`), a tabela de usuários, a de pacientes e as sessões em hora local.
- [ ] **Step 1: Testes** (em `demo-seed.test.ts`, com `slug` único e `agora` fixo em `2026-11-11T23:30-03:00`) `"demo: unidade, dois serviços (um com triagem), três estações e as duas sessões"`; `"demo: amanhã é no fuso da unidade"` (pública começa em `2026-11-12T11:00Z`, privada em `2026-11-12T16:00Z`); `"demo: cada perfil loga no painel e o eu mostra o próprio perfil"` (seis logins por HTTP no Host do slug); `"demo: pacientes logam na central e há 4 entradas aguardando na Odontologia; Ana conta como idosa"` (`prioridadeDaEntrada`); `"PD-40: rodar de novo apaga e recria — mesmas contagens, ids novos, a sessão do painel antiga deixa de valer, nenhum cpf_em_uso"`; `"PD-40: depois de uma execução interrompida (município em criando, pacientes já no central), roda de novo e termina"`; `"PD-40: com a API no ar, o login funciona logo depois de re-semear"`. Em `pode-semear.test.ts`: `"PD-40: só development e multi"` (test, production e single recusados).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; suíte inteira da API, painel, domínio e schemas verdes; biome; `npm run specs:check`.
- [ ] **Step 5: Manual (roteiro da fatia):** `npm run db:migrate`; `npm run demo:seed` (confere a saída); `npm run dev`; em `http://demo.localhost:3000/login`, entrar com cada um dos seis logins e conferir o menu (gestor: unidades, usuários, regras; admin: serviços, estações, sessões, TVs; os outros: "Em breve"); rodar `npm run demo:seed` de novo com tudo no ar e entrar outra vez.
- [ ] **Step 6:** Commit `feat(api): demo seed for the local presentation`.

---

## Paralelismo

Regra da [worktree-setup](../../../.superpowers/sdd/worktree-setup.md): tudo o que usa o Postgres de teste (5433), a porta 3333 ou as migrations municipais roda **em sequência**.

| Grupo | Tasks | Pode rodar junto com | Observação |
| --- | --- | --- | --- |
| **Merge (sozinha, primeiro)** | 1 | Nada | Mexe no lockfile, no domínio, nos schemas e no painel |
| **Painel + schemas** | 2 | Tasks 3, 4 e 5 | Só `apps/painel` e `packages/schemas`; precisa estar juntada antes da Task 6, que usa `euPainelSchema` |
| **API (sequencial)** | 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 | Task 2 | Mesmo banco de teste, porta e pasta de migrations. A 10 só depende da 1B Task 10 e pode trocar de lugar com 7–9; a 11 precisa de 3–6 e, para o roteiro manual, de 2 e 9 |

As Tasks 2 e 9 mexem no `package-lock.json` (dependências novas); o segundo merge resolve com `npm install --package-lock-only`.

## Verificação ao fim da fatia

- `npm run test:domain`, `npm -w @fila-saude/schemas run test`, `npm run test:painel`, `npm -w @fila-saude/api run test` verdes; `npx biome check .` limpo; `npm run specs:check` com 0 erros.
- Critérios da [trilha da demo](tasks.md#trilha-da-demo-2026-11-11) para a fatia 0: o Step 5 da Task 11 executado à mão uma vez.
- Ledger: pendências que ficam abertas para a fatia 1 (fila do dia sobre `sessao` e `entrada`; `chamado_item_id` da estação quando existir o item da fila; trocar o guard da PD-34 pelo JWT quando a 1B Task 14 voltar).

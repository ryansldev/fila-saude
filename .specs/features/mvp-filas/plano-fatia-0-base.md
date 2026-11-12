# Fatia 0 da v0.1 — Base (painel por perfil, configuração mínima e `dev:seed`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao fim da fatia, a v0.1 roda local: cada perfil entra no painel em `http://exemplo.localhost:3000`; o gestor cria unidades e usuários com perfis, e o admin configura serviços, estações e sessões avulsas em telas mínimas. `npm run dev:seed` preenche o município `exemplo` com dados de exemplo pelas mesmas funções das rotas: unidade, serviços (um com triagem), estações, uma sessão pública amanhã, uma privada, um usuário por perfil e pacientes na lista de espera.

**Architecture:** Primeiro a `feat/fase-2-configuracao` (fase 2, Tasks 1–8) é juntada à `feat/domain-fase-1a`, e o domínio e o painel são adaptados à API revisada da 1A. Na API, em sequência: as tabelas municipais; o better-auth do painel por tenant, perfis com escopo, o guard pela matriz (com as ressalvas de `condicoes()`) e a auditoria na mesma transação (1B Tasks 15–18); o CORS do painel (fase 2 Task 9); o guard da sessão do paciente (PD-33); e as rotas de configuração. Cada rota mutável é uma casca fina sobre uma **função de serviço** que recebe o contexto do ator e passa por `executarAcao` (permissão + transação + auditoria, PD-41); o `dev:seed` chama essas mesmas funções. No painel, as telas mínimas são testadas com API falsa e correm em paralelo à API depois que os contratos existem.

**Tech Stack:** TypeScript (strict, ESM, Node 24); API: Fastify 5 + `@fastify/autoload`, Drizzle + `pg`, better-auth 1.6 (plugin `username`), `@fastify/cors`; painel: Next 16.2, React 19.2, Tailwind 4, Vitest + jsdom + Testing Library; Zod 4 (`packages/schemas`); Vitest 4 contra servidor real e Postgres de teste na porta 5433; Biome.

**Spec:** fatia 0 da [trilha da v0.1](tasks.md#trilha-da-v01-2026-11-11), [PD-32 e PD-33](plan.md#1-decisões-de-arquitetura); Tasks 15–18 do [plano 1B](plano-fase-1b-fundacao-api.md) (atualizadas ao código atual); do [plano 2](plano-fase-2-configuracao.md), a Task 9 e, enxutas, as Tasks 10, 12, 16, 17, 18, 21 (rotas) e 27, 28, 29 (telas); regras em [`specs/modelo`](../../specs/modelo/spec.md) (entidades, configurações, INV-01, INV-02, INV-11, INV-12), [`specs/permissoes`](../../specs/permissoes/spec.md) (RN-PERF-01, RN-PERF-03 e a matriz), [`specs/identidade`](../../specs/identidade/spec.md) (RN-ID-01, RN-ID-05), [`specs/marcacao`](../../specs/marcacao/spec.md) (RN-ENC-07, RN-PUB-03), [`specs/chamada`](../../specs/chamada/spec.md) (RN-TRI-01, RN-TRI-02, RN-EST-01); decisões provisórias em [decisoes-para-revisar](decisoes-para-revisar.md) (P1: ressalvas da matriz). Ledgers: `.superpowers/sdd/plano-fase-1a-dominio/{progress,final-fix-report}.md`, `.superpowers/sdd/plano-fase-1b-fundacao-api/progress.md` e `.superpowers/sdd/plano-fase-2-configuracao/progress.md`.

**Fora deste plano (adiado na v0.1, sem descarte):**
- Séries de sessões (RFC 5545), "esta e as seguintes" e a materialização de 90 dias (fase 2 Tasks 20, 22, 23 e 29 na parte de séries). O domínio de `recorrencia` já feito fica sem uso até lá.
- Troca do modo do serviço com conversão das entradas e push (fase 2 Tasks 19 e 24; aqui a troca só vale sem entradas ativas, PD-42).
- Regras do município e a tabela `config_municipio` (fase 2 Task 11; o nível município é `{}` e herda o padrão, PD-35).
- Worker, outbox e papéis do processo (fase 2 Tasks 13–15); TV e pareamento (Tasks 25, 26, 30, na fatia 2).
- Cancelamento de sessão com pacientes e remanejamento (T8.1); trocar senha ou desativar usuário do painel.
- E-mail confirmado, recuperação, bloqueio e JWT do paciente (1B Tasks 11–14); fila do dia e app (fatia 1).

## Global Constraints

- **TDD sempre** ([tasks.md](tasks.md#tasks-mvp-filas-ubspoliclínicas)): teste → rodar e ver FAIL pelo motivo certo (não por import ou digitação) → implementar → rodar e ver PASS → commit. Refatoração sem comportamento novo (Task 1) roda com a suíte verde antes e depois.
- **Nada artificial:** é a v0.1 do sistema real. O seed não grava configuração direto nas tabelas nem contorna validação ou auditoria; usa as funções de serviço das rotas (PD-40, PD-41).
- **API:** ciclo pelo teste de integração da rota (`apps/api/tests/integration`, servidor real em `:3333`, `fetch` de verdade, `<slug>.localhost:3333` para o tenant, bancos por arquivo com `orchestrator.criarMunicipio()` derrubados no `afterAll`, PD-19). Infra sem rota (tabelas, repositório, seed) é testada no processo do Vitest contra o Postgres de teste; nada de mock de banco.
- **Rotas de configuração:** a rota valida a entrada com o schema de `packages/schemas` (`validar`), chama a função de serviço e valida a saída; toda rota mutável declara `config: { acao }` (o teste de rotas da Task 9 pega o esquecimento); leitura usa `exigir`. Regras de domínio vêm de `packages/domain` (`validarConfig`, `configEfetiva`, `validarSessao`, `mudarVisibilidade`, `podeMudarExigeTriagem`, `contarAtivas`), nunca reescritas na API.
- **Painel:** lógica (funções puras, hooks e estado das telas) testada com Vitest e Testing Library; layout puro não é testado; cliente da API injetado (PD-31). Datas e horas digitadas são hora local da unidade, convertidas com `localParaInstante`/`instanteParaLocal` do domínio.
- Rodar um arquivo: `VITEST_ARGS=<caminho> npm -w @fila-saude/api run test`; suíte inteira: `npm -w @fila-saude/api run test`. Painel: `npm run test:painel`. Domínio: `npm run test:domain`. Schemas: `npm -w @fila-saude/schemas run test`.
- Um teste por arquivo de rota/método (`tests/integration/v1/<caminho>/<metodo>.test.ts`); infra em `tests/integration/infra/<modulo>.test.ts`. O nome do teste cita o ID da regra (`"RN-PERF-01: …"`).
- Limites numéricos dos dois lados (L-004): vagas 0/1, vagas = ocupadas e ocupadas − 1, prefixo de 3 e 4 letras, K 0/1.
- Erros no formato da PD-22 (`{ erro, mensagem?, campos?, dados? }`, códigos `snake_case` em português): `401 nao_autenticado`, `403 sem_permissao`, `404 municipio_desconhecido` / `nao_encontrado`, `409 <código>`.
- **Pendências herdadas (ledger da 1B):** nada grava nem depende de `Tenant.municipioId` (nulo no modo single). O banco do tenant é `DbDoTenant` e cada schema novo entra em `schemaMunicipal`. O `429` já sai como `muitas_tentativas`.
- **Perfis do painel** nunca incluem `paciente`. Ações citam a constante `Acao` da 1A: "ação de gestão" = `criar_unidades_regras_usuarios`; "ação de configurar" = `configurar_servicos_sessoes_estacoes_tv`; "ação de sessão" = `abrir_cancelar_encerrar_sessao`.
- Worktrees: `.superpowers/sdd/worktree-setup.md` com **TARGET_BRANCH = `feat/domain-fase-1a`** para todas as tasks (a `feat/fase-2-configuracao` para de receber trabalho depois da Task 1).
- `npx biome check` limpo nos pacotes tocados e `npm run specs:check` sem erros ao fim de cada task.

## Decisões desta fatia

Provisórias e reversíveis, registradas com uma linha cada no [plan.md](plan.md#1-decisões-de-arquitetura).

| ID | Decisão | Por quê | Custa se errado |
| --- | --- | --- | --- |
| PD-34 | **Guard da sessão do paciente (PD-33):** decorator `app.exigirPaciente` chama `authCentral.api.getSession({ headers })` (cookie da sessão central; o cliente Expo da fatia 1 manda o cookie no cabeçalho) e preenche `req.paciente = { pacienteId, cpf, verificado }`, o formato que o verificador do JWT (PD-17) devolverá. Só no modo multi | Uma peça só para trocar pelo JWT depois | Baixo: um arquivo. Não funciona no modo single, que a v0.1 não usa |
| PD-35 | **Configuração da unidade numa coluna `config jsonb`** (`ConfigParcial`, validado por `validarConfig` ao gravar), sem `config_municipio` nesta fatia (nível município `{}`) | A herança (PD-28) continua em `configEfetiva`; o banco guarda o mesmo objeto que o domínio recebe | Baixo: virar colunas é uma migration |
| PD-36 | **Toda entrada aponta para uma `pessoa_local`** (inclusive o dono da conta, ligado por `paciente_id`, AD-035) e guarda `responsavel_paciente_id`; o `Entrada` do domínio é convertido num repositório único (`infra/fila/entradas.ts`) | Uma forma só de achar a pessoa atendida (RN-LE-02, INV-01) | Baixo: o repositório isola o formato |
| PD-37 | **`sessao.ocupadas` é um contador gravado** com `versao` (trava otimista) e `CHECK (vagas IS NULL OR ocupadas <= vagas)`, `CHECK (vagas >= 1)` | INV-02 também no banco | Baixo: recontar é uma consulta |
| PD-38 | **Guard com ressalvas fechado por padrão** (P1): só contam os perfis cujo escopo cobre a unidade do recurso (sem unidade, só os de escopo município); `"livre"` passa; ressalva passa só com conferência declarada pela rota que devolve `true`; senão 403 | Rota que esquece a ressalva nega em vez de vazar | Baixo: a conferência é por rota |
| PD-39 | **Auth do painel no banco do tenant:** tabelas `usuario_painel`, `sessao_painel`, `conta_painel`, `verificacao_painel`; cookies com prefixo `fila-painel`; origem do painel por `PAINEL_ORIGEM_TEMPLATE` (`http://{slug}.localhost:3000` em dev), usada no CORS e no `trustedOrigins` | Sem confusão com `sessao` (atendimento) nem com o cookie central no mesmo host | Baixo |
| PD-40 | **`dev:seed` preenche o município `exemplo` pelas mesmas funções das rotas, com auditoria.** Roda só com `NODE_ENV=development` e `TENANT_MODE=multi`; apaga e recria `exemplo` e os pacientes de exemplo no central (por CPF). Cada passo é feito **pelo usuário cujo perfil faz aquilo no produto**: o gestor criado por `criarTenant` cria a unidade e os usuários; o admin que ele criou configura serviços, estações e sessões; a recepção registra a pessoa sem app; os pacientes entram na lista pelo caminho do app (sem auditoria, como a rota do app). Pacientes se cadastram pelo handler do better-auth central e ficam com o e-mail confirmado. Senha fixa `exemplo123`, impressa no terminal | A auditoria do município de exemplo é a mesma que teria se as pessoas tivessem usado o painel; o guard confere cada passo, então o seed não faz o que o perfil não pode. Atribuir tudo ao gestor exigiria dar a ele ações que a matriz não dá | Baixo: só dados de exemplo; nunca roda em produção |
| PD-41 | **Funções de serviço com contexto do ator:** `ContextoDaAcao = { db, ator: { usuarioId, perfis }, agora }`; `executarAcao(ctx, meta, fn)` confere a permissão, abre a transação, roda `fn` e grava a auditoria; `acaoDoPainel(req, …)` só monta o contexto da sessão. Rotas e scripts chamam as mesmas funções em `infra/config/*` | Um caminho só para regra, permissão e auditoria, testável sem HTTP e usável pelo seed | Baixo: a rota continua fina |
| PD-42 | **Troca do modo do serviço ("como é marcado") só sem entradas ativas na v0.1**: com entradas ativas → `409 servico_com_entradas` com `dados.entradasAtivas` (`contarAtivas`); para `regulado` com sessão pública planejada → `409 servico_regulado`. A conversão das entradas (RN-ENC-07, AD-038) vem depois | Protege as entradas sem construir a conversão e o push agora | Baixo: a regra completa já existe no domínio (`mudarModoServico`) e entra no lugar da recusa |

## Review Focus

1. **Vazamento entre municípios:** usuário, cookie, perfis, unidades e serviços de A nunca aparecem nem valem em B; origem do painel de B não recebe CORS do host de A. Testes nas Tasks 6, 7, 10 e 12.
2. **Ressalva da matriz esquecida e escopo de unidade:** profissional em "chamar" sem conferência, admin da unidade 1 mexendo em serviço da unidade 2 pelo id do serviço (sem a unidade no caminho). Deve dar 403. Testes nas Tasks 8 e 14.
3. **Edição que estraga dados existentes:** vagas abaixo das ocupadas, "exige triagem" com sessão aberta, modo do serviço com entradas ativas, estação de triagem com serviço que deixa de exigir triagem, horário de sessão já aberta. Testes nas Tasks 14–16.
4. **"Amanhã" e hora digitada no fuso da unidade:** seed às 23:30 de Brasília cria a sessão no dia seguinte local; a tela de sessão grava 08:00 local como 11:00Z. Testes nas Tasks 19 e 20.
5. **Rodar o seed de novo**, inclusive depois de uma execução interrompida e com a API no ar: sem `cpf_em_uso`, sem município preso em `criando`, login do painel funcionando sem reiniciar. Testes na Task 20.

---

## Estrutura de arquivos

```
packages/domain/src/{index.ts, configuracao.ts, lista.ts}   merge + adaptação (Task 1)
packages/schemas/{auth,unidade,servico,estacao,sessao,usuario}.ts   contratos (Tasks 2, 3)
apps/painel/
  lib/{sessao.tsx, api.ts, unidade-atual.ts}                 (Task 2)
  lib/formularios/{unidade,usuario,servico,estacao,sessao}.ts (Tasks 17–19)
  app/(painel)/{unidades,usuarios,servicos,estacoes,sessoes}/page.tsx
apps/api/
  app.ts                                 construirApp() sem listen (Task 9)
  infra/database/municipal/schema/
    unidade.ts · servico.ts · estacao.ts · sessao.ts (Task 4) · entrada.ts (Task 5)
    auth.ts (Task 6) · perfil.ts (Task 7) · auditoria.ts (Task 9)
  infra/fila/entradas.ts                 pessoaAtendida(), inserirEntrada(), lerEntrada(), entrarNaLista() (Task 5)
  infra/auth/{painel.ts, sessao-paciente.ts}                  (Tasks 6, 11)
  infra/painel/{sessao.ts, guard.ts, acao.ts, cors.ts}        (Tasks 7–10)
  infra/config/{unidades,usuarios,servicos,estacoes,sessoes}.ts  funções de serviço (Tasks 12–16)
  routes/v1/painel/
    auth · eu · unidades · unidades/_unidadeId{,/config,/servicos,/estacoes,/sessoes}
    usuarios · usuarios/_usuarioId/perfis · servicos/_servicoId · estacoes/_estacaoId
    sessoes/_sessaoId{,/visibilidade,/cancelar}
  infra/tenant/derrubar.ts · infra/exemplo/semear.ts · infra/scripts/dev-seed.ts   (Task 20)
```

---

### Task 1: Juntar a fase 2 e adaptar o domínio revisado (PD-32)

Primeira, sozinha. Conflitos conferidos com `git merge-tree` (base `f70134e`): `package-lock.json`, `packages/domain/src/index.ts` e `packages/schemas/package.json`. O `index.ts` resolvido exporta `Origem` duas vezes (`lista.ts`: origem do remanejado; `configuracao.ts`: origem do valor herdado) e não compila.

**Files:**
- Modify (merge): `packages/domain/src/index.ts` (união dos blocos de `sessao.ts` da 1A e `servico.ts`/`sessao-config.ts`/`tempo.ts` da fase 2), `packages/schemas/package.json` (um só `scripts`: `test`, `test:watch`), `package-lock.json` (regenerado), `packages/domain/src/configuracao.ts` e `test/configuracao.test.ts` (`Origem` → `OrigemConfig`), `packages/domain/src/lista.ts` (`destinoPorCondicao` delega a `transicaoUnica`, pendência do ruling da fase 2 Task 5)

**Interfaces:**
- Produces: `export type OrigemConfig = "padrao" | "municipio" | "unidade"` (`ConfigEfetiva.origem: Record<string, OrigemConfig>`); `Origem` segue sendo a do remanejado. `destinoPorCondicao` mantém assinatura e comportamento. Regra: se um teste da fase 2 quebra pela API revisada da 1A (`desistir`, `recusar` com `dia: null`, `liberarVaga`/`ficarElegivel` fora do pacote, `lancarRegulado` sem `config`, `ItemFila.motivoSaida`, `Estimativa` nova, `Entrada.prioridade.grupos` sem idoso), adapta-se o código da fase 2, nunca o da 1A.

- [ ] **Step 1:** `git merge --no-ff feat/fase-2-configuracao`; resolver `index.ts` (união) e `packages/schemas/package.json`; lockfile: `git checkout --ours package-lock.json`, `npm install --package-lock-only`, `npm ci`.
- [ ] **Step 2: Ver falhar:** `npm -w @fila-saude/domain run check-types` → FAIL por `Origem` duplicado (motivo certo); rodar domínio, schemas, painel e API para listar outras quebras.
- [ ] **Step 3:** Renomear para `OrigemConfig`; adaptar o resto pela regra acima. Commit do merge `merge: phase 2 (tasks 1–8) into the v0.1 base`.
- [ ] **Step 4: Refatoração com a suíte como rede:** `destinoPorCondicao` passa a usar `transicaoUnica`; `npm run test:domain` verde antes e depois.
- [ ] **Step 5: Verificar:** domínio, schemas, painel e API verdes; `npm -w @fila-saude/painel run build`; biome; `npm run specs:check`.
- [ ] **Step 6:** Commit `refactor(domain): one contract row selector after the phase 2 merge`.

### Task 2: Painel no contrato do painel: login por `login`, schemas compartilhados e unidade atual (T2.1; PD-23, PD-31)

**Files:**
- Modify: `packages/schemas/auth.ts` (+ `euPainelSchema`), `packages/schemas/test/auth.test.ts`, `apps/painel/package.json` (`@fila-saude/schemas`), `apps/painel/lib/{sessao.tsx,api.ts}`, `apps/painel/components/formulario-login.tsx`, `apps/painel/test/{login.test.tsx,api.test.ts}`
- Create: `apps/painel/lib/unidade-atual.ts`, `apps/painel/test/unidade-atual.test.tsx`

**Interfaces:**
- Consumes: `erroSchema`, `perfilPainelSchema`, `Perfil`.
- Produces:
  - `euPainelSchema = z.object({ id: z.string(), nome: z.string(), login: z.string(), perfis: z.array(z.object({ perfil: perfilPainelSchema, unidadeId: z.uuid().nullable() })) })`, `type EuPainel` (substitui o tipo local da fase 2 Task 8).
  - `entrar(api, login, senha)` → `POST /v1/painel/auth/sign-in/username` com `{ username: login, password: senha }`; `useEu` valida com `euPainelSchema` (fora do contrato → `{ estado: "erro" }`); `criarApi` reconhece erro por `erroSchema.safeParse` (sai `ehCorpoDeErro`).
  - Formulário: campo "Login" (`autoComplete="username"`); credenciais: "Login ou senha inválidos."
  - `unidadesDoUsuario(eu: EuPainel): { todas: boolean; ids: string[] }` (gestor → `todas`); `useUnidadeAtual()` → `{ unidades: { id; nome; fuso }[]; atual: string | null; escolher(id) }` a partir de `GET /v1/painel/unidades`; com uma unidade só, ela já vem escolhida; a escolha fica em `localStorage` protegido por try/catch.
- [ ] **Step 1: Testes** schemas: `"euPainelSchema aceita perfis com e sem unidade e recusa perfil paciente"`. Painel: `"login: envia username e password para sign-in/username"`; `"login: 401 mostra 'Login ou senha inválidos.'"`; `"eu fora do contrato vira erro"`; `"api: erro da PD-22 vira ErroDaApi com campos"`; `"unidade atual: uma unidade já vem escolhida; várias pedem escolha; localStorage indisponível não quebra"`.
- [ ] **Step 2:** `npm -w @fila-saude/schemas run test` e `npm run test:painel` → FAIL. **Step 3:** implementar. **Step 4:** PASS; biome; build do painel. **Step 5:** Commit `feat(painel): sign in by login, shared contracts and current unit`.

### Task 3: Contratos da configuração da v0.1 (T2.2, T2.3, T2.5)

**Files:** Modify `packages/schemas/{unidade,servico,estacao,sessao,usuario}.ts`, `packages/schemas/test/configuracao.test.ts`

**Interfaces:**
- Consumes: os schemas de entrada da fase 2 Task 6 (`unidadeEntradaSchema`, `servicoEntradaSchema`, `estacaoEntradaSchema`, `sessaoEntradaSchema`, `usuarioPainelEntradaSchema`, `configEntradaSchema`).
- Produces (entrada de edição e saída de cada rota das Tasks 12–16):
  - `unidadeEdicaoSchema` (campos de `unidadeEntradaSchema` opcionais; em `config`, `null` num campo = voltar a herdar); `unidadeSchema` (saída: `id` + campos + `config`); `configEfetivaSchema` (`valores` + `origem: Record<string, "padrao" | "municipio" | "unidade">`).
  - `servicoEdicaoSchema` (nome, prefixo, `exigeTriagem`, `modo`, `tempoMedioMin`, todos opcionais); `servicoSchema` (saída, com `unidadeId`, `ativo`).
  - `estacaoEdicaoSchema` (nome, `servicos`; a etapa não muda depois de criada); `estacaoSchema` (saída, com `aberta`).
  - `sessaoEntradaSchema` corrigido: `vagas` inteiro **≥ 1** ou nulo (domínio e banco, PD-37); `sessaoEdicaoSchema` (`inicio`, `fim`, `vagas`, `profissional`, `estacoes`, mais `versao` obrigatório); `visibilidadeEntradaSchema = { visibilidade, dispensaPreCadastro?, versao }`; `sessaoSchema` (saída: `id`, `servicoId`, `inicio`, `fim`, `vagas`, `ocupadas`, `visibilidade`, `dispensaPreCadastro`, `profissional`, `estacoes`, `estado`, `versao`).
  - `perfisEntradaSchema` (`{ perfis: { perfil; unidadeId | null }[] }`, ≥ 1); `usuarioPainelSchema` (saída: `id`, `login`, `nome`, `perfis`).
- [ ] **Step 1: Testes** `"vagas 0 recusado, 1 aceito, nulo aceito"` (L-004); `"edição de sessão sem versao é recusada"`; `"config da unidade aceita null para voltar a herdar"`; `"estacaoEdicaoSchema não aceita etapa"`; um caso válido de cada saída.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(schemas): v0.1 configuration contracts`.

### Task 4: Tabelas municipais de unidade, serviço, estação e sessão (specs/modelo; PD-35, PD-37)

**Files:**
- Create: `apps/api/infra/database/municipal/schema/{unidade,servico,estacao,sessao}.ts`, migration municipal, `tests/integration/infra/tabelas-configuracao.test.ts`
- Modify: `infra/database/tenants.ts` (`schemaMunicipal`), `tests/orchestrator.ts` (`bancoDoMunicipio(slug): DbDoTenant`)

**Interfaces:**
- Consumes: `TRANSICOES_SESSAO`, `Etapa`, `ModoServico`, `ConfigParcial`.
- Produces:
  - `unidade(id uuid pk, nome, tipo enum("ubs","policlinica","upa") default "ubs", endereco, lat double, lng double, fuso, horario jsonb, config jsonb not null default '{}', criado_em)`.
  - `servico(id, unidade_id fk, nome, prefixo check ~ '^[A-Z]{1,3}$', exige_triagem bool default false, modo enum("livre","requisicao","regulado") default "livre", tempo_medio_triagem_min int null, tempo_medio_atendimento_min int not null default 15, ativo bool default true, criado_em)`; único `(unidade_id, prefixo)`.
  - `estacao(id, unidade_id fk, nome, etapa enum("triagem","atendimento"), aberta bool default false, ultimo_sinal_em null, arquivada_em null, criado_em)`; `estacao_servico(estacao_id, servico_id, pk dos dois)`.
  - `sessao(id, servico_id fk, inicio, fim check fim > inicio, vagas int null check vagas >= 1, ocupadas int not null default 0 check ocupadas >= 0 and (vagas is null or ocupadas <= vagas), visibilidade enum default "privada", dispensa_pre_cadastro bool default false check (not dispensa_pre_cadastro or visibilidade = 'publica'), profissional null, estado enum(EstadoSessao) default "planejada", versao int default 0, criado_em)`; `sessao_estacao(sessao_id, estacao_id, pk dos dois)`.
- [ ] **Step 1: Testes** `"modelo: tenant novo tem as seis tabelas"`; `"modelo: padrões — serviço livre, sem triagem, 15 min; sessão privada, planejada, sem dispensa"`; `"T2.3: prefixo repetido na mesma unidade é recusado; em outra, aceito"`; `"prefixo de 3 letras aceito, de 4 recusado"`; `"INV-02: vagas 0 recusado, 1 aceito; ocupadas = vagas aceito, vagas + 1 recusado"`; `"AD-016: dispensa em sessão privada recusada pelo banco"`; `"fim antes do início recusado"`; `"contrato: estados de sessao, modos e etapas no banco são os do domínio"` (enums do Postgres × estados de `TRANSICOES_SESSAO` e listas de `ModoServico`/`Etapa`).
- [ ] **Step 2:** FAIL (`unidade` não existe). **Step 3:** schemas, `npm run db:generate:municipal`. **Step 4:** PASS; suíte inteira; biome. **Step 5:** Commit `feat(api): municipal unit, service, station and session tables`.

### Task 5: Entrada, pessoa atendida e entrada na lista (PD-30, PD-36; INV-01, RN-LE-01, RN-LE-02, RN-LE-05, AD-035)

**Files:**
- Create: `infra/database/municipal/schema/entrada.ts` (+ migration), `infra/fila/entradas.ts`, `tests/integration/infra/entradas.test.ts`
- Modify: `infra/database/tenants.ts` (`schemaMunicipal`, `type TxDoTenant`)

**Interfaces:**
- Consumes: `Entrada`, `TRANSICOES_ENTRADA`, `criarEntrada`, `entradaAtivaDa`, `configEfetiva`, `Respostas`, `Resultado`.
- Produces:
  - `entrada(id uuid pk, servico_id fk, pessoa_local_id fk not null, responsavel_paciente_id text null, estado enum(EstadoEntrada), data_entrada_original, classificacao jsonb, risco_confirmado enum(NivelRisco) null, prioridade jsonb, remanejada enum("privada","publica","regulada") null, recusas int default 0, sessao_id fk null, alocada_em, perguntado_em, respondido_em, arquivada_em null, sessoes_recusadas uuid[] default '{}', versao int default 0, criado_em)`; único parcial `(servico_id, pessoa_local_id)` onde `estado not in ('cancelada','concluida','encerrada_sem_atendimento','arquivada')`.
  - `pessoaAtendida(db: DbDoTenant | TxDoTenant, p: { nome; nascimento; cpf: string | null; pacienteId: string | null }): Promise<{ id: string }>` (com CPF, reaproveita a do mesmo CPF e completa `paciente_id`).
  - `inserirEntrada(db, entrada: Entrada, pessoaLocalId: string): Promise<void>`; `lerEntrada(db, id): Promise<Entrada | null>`.
  - `entrarNaLista(db, cmd: { servicoId: string; pessoa: { nome; nascimento; cpf: string | null; pacienteId: string | null }; responsavelPacienteId: string | null; respostas: Respostas; agora: number }): Promise<Resultado<Entrada>>` — numa transação: lê o serviço e a configuração efetiva da unidade dele, as entradas ativas do serviço, chama `criarEntrada` e grava. É a função que a rota do app (fatia 4) e a do balcão vão chamar.
- [ ] **Step 1: Testes** `"PD-36: entrada criada pelo domínio volta igual do banco"`; `"INV-01: segunda entrada ativa da mesma pessoa no serviço recusada pelo banco; depois de cancelada, aceita"`; `"RN-LE-02: mesmo CPF é a mesma pessoa_local"`; `"AD-035: dono da conta ganha pessoa_local ligada ao paciente_id"`; `"RN-LE-05: entrarNaLista recusa duplicada"`; `"RN-LE-01: serviço regulado e emergência não criam"`; `"contrato: estados da entrada no banco são os do domínio"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): waitlist entries stored from the domain shape`.

### Task 6: better-auth do painel por tenant e primeiro gestor (1B Task 15; T1.9; PD-05, PD-23, PD-39)

**Files:**
- Create: `infra/database/municipal/schema/auth.ts` (+ migration), `infra/auth/painel.ts`, `routes/v1/painel/auth/route.ts`, `tests/integration/v1/painel/auth/login.test.ts`
- Modify: `infra/database/tenants.ts`, `infra/tenant/criar.ts` (`gestor?: { login; nome; senha }`; devolve `{ municipioId, gestorId? }`), `infra/scripts/tenant-create.ts` (`--gestor-login`, `--gestor-nome`; senha no terminal), `tests/orchestrator.ts` (`loginPainel(slug, login, senha): Promise<string>`, `criarMunicipio({ gestor })`)

**Interfaces:**
- Produces:
  - Tabelas do better-auth com os nomes da PD-39 (+ `username`, `display_username`).
  - `authDoTenant(slug: string, db: DbDoTenant): Auth` — `basePath: "/v1/painel/auth"`, `baseURL` do host do tenant, `drizzleAdapter(db, schema municipal)`, `emailAndPassword: { enabled: true, minPasswordLength: 8, disableSignUp: true }`, `disabledPaths: ["/is-username-available"]`, `advanced.cookiePrefix: "fila-painel"`, `plugins: [username()]`; cache em `WeakMap<DbDoTenant, Auth>`.
  - Rota `GET|POST /v1/painel/auth/*` com `exigirTenant` + `montarAuth`.
  - `criarUsuarioPainel(db: DbDoTenant | TxDoTenant, dados: { login; nome; senha; email? }): Promise<{ id: string }>` pelo `internalAdapter` do better-auth (usuário + conta `credential` com o hash dele); sem e-mail grava `<login>@painel.invalid`; login repetido → `ErroApi(409, "login_em_uso")`.
- [ ] **Step 1: Testes** `"T1.9: gestor criado com o município loga no próprio município"` (cookie `fila-painel…`); `"T1.9: usuário de A não loga em B"`; `"T1.9: cookie de A no Host de B não autentica"`; `"T1.9: cadastro aberto pelo painel é recusado"`; `"senha errada → 401 credenciais_invalidas"`; em `criar-tenant.test.ts`: `"T1.9: criarTenant aceita o gestor"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): per-tenant panel auth and first manager`.

### Task 7: Perfis com escopo e `GET /v1/painel/eu` (1B Task 16; T1.9; RN-PERF-01)

Depende da Task 2 (`euPainelSchema`).

**Files:**
- Create: `infra/database/municipal/schema/perfil.ts` (+ migration), `infra/painel/sessao.ts`, `routes/v1/painel/eu/route.ts`, `tests/integration/v1/painel/eu/get.test.ts`
- Modify: `infra/tenant/criar.ts` (gestor recebe `gestor`, escopo município), `infra/database/tenants.ts`, `tests/orchestrator.ts` (`criarUsuarioComPerfis(slug, login, perfis)`, `criarUnidadeDireto(slug)` só para testes anteriores à Task 12)

**Interfaces:**
- Produces:
  - `type PerfilComEscopo = { perfil: Perfil; unidadeId: string | null }`.
  - `perfil_usuario(id, usuario_id fk, perfil enum(perfis do painel), unidade_id null fk unidade, concedido_por null, concedido_em)`; único `(usuario_id, perfil, unidade_id)` `NULLS NOT DISTINCT`; `CHECK ((perfil = 'gestor') = (unidade_id IS NULL))`.
  - `concederPerfis(db, usuarioId, perfis: PerfilComEscopo[], concedidoPor: string | null): Promise<void>`; `perfisDoUsuario(db, usuarioId): Promise<PerfilComEscopo[]>`.
  - `usuarioDoPainel(req): Promise<{ id; nome; login; perfis: PerfilComEscopo[] } | null>` (memoizado na requisição).
  - `GET /v1/painel/eu` → `euPainelSchema` ou `401 nao_autenticado`.
- [ ] **Step 1: Testes** `"T1.9: eu devolve os perfis com escopo"`; `"RN-PERF-01: agendador e recepção acumulados aparecem os dois"`; `"sem sessão → 401"`; `"cookie do paciente da central → 401"`; `"modelo: gestor com unidade e admin sem unidade recusados pelo banco"`; `"perfil de A não aparece no eu de B"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): panel profiles with unit scope`.

### Task 8: Guard de permissões pela matriz, com ressalvas (1B Task 17; RN-PERF-01, specs/permissoes; P1, PD-38)

**Files:**
- Create: `infra/painel/guard.ts`, `test-routes/painel/unidades/_unidadeId/protegida/route.ts`, `tests/integration/v1/teste/painel/protegida.test.ts`, `tests/unit/infra/painel/guard.test.ts`
- Modify: `apps/api/package.json` (`@fila-saude/domain`, se faltar)

**Interfaces:**
- Produces:
  - `condicoesNaUnidade(perfis: PerfilComEscopo[], acao: Acao, unidadeId: string | null): "livre" | string[] | null` (puro: perfis de escopo município e, com `unidadeId`, os da mesma unidade → `condicoes`).
  - `type Ressalvas = Partial<Record<string /* texto da ressalva na MATRIZ */, () => boolean | Promise<boolean>>>`.
  - `permitido(perfis, acao, unidadeId, ressalvas?: Ressalvas): Promise<boolean>` (`"livre"` → true; lista → true só se alguma tem conferência que devolve true).
  - `exigir(acao: Acao, opcoes?: { unidade?: (req) => string | null | Promise<string | null>; ressalvas?: (req) => Ressalvas })` → preHandler: sem sessão 401; `!permitido` → `403 sem_permissao`. Para recurso endereçado pelo próprio id (`/servicos/:servicoId`), `unidade` busca a unidade dele no banco; id inexistente → `404 nao_encontrado`.
  - Rota de teste `POST /v1/teste/painel/unidades/:unidadeId/protegida?acao=<Acao>&ressalva=sim|nao`.
- [ ] **Step 1: Testes** `"RN-PERF-01: admin passa na ação de configurar na própria unidade"`; `"profissional na mesma ação → 403"`; `"admin da unidade 1 → 403 na unidade 2"`; `"gestor (município) passa nas ações dele em qualquer unidade"`; `"perfis acumulados somam"`; `"P1: profissional em operar_chamadas sem a ressalva conferida → 403; conferida → passa"`; `"P1: recepção em ver_resposta_risco_de_vida sem conferência → 403"`; `"sem sessão → 401"`; unidade: `"ação sem unidade só conta perfil de escopo município"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): permission guard from the domain matrix`.

### Task 9: Auditoria na mesma transação e funções de serviço (1B Task 18; INV-12, RNF-SEG-04, RN-PERF-03, PD-18, PD-41)

**Files:**
- Create: `apps/api/app.ts`, `infra/database/municipal/schema/auditoria.ts` (+ migration), `infra/painel/acao.ts`, `test-routes/painel/acao/route.ts`, `tests/integration/v1/teste/painel/acao.test.ts`, `tests/integration/infra/rotas-auditadas.test.ts`, `tests/integration/infra/executar-acao.test.ts`
- Modify: `server.ts` (só `construirApp()` + `listen`)

**Interfaces:**
- Consumes: `permitido`, `usuarioDoPainel`, `perfisDoUsuario`, `TxDoTenant`.
- Produces:
  - `construirApp(): Promise<FastifyInstance>` (tudo do `server.ts` atual, sem `listen`).
  - `auditoria(id, usuario_id text, acao text, alvo_tipo text, alvo_id text, unidade_id uuid null, motivo null, dados jsonb null, em timestamptz default now())`; sem dado clínico nem id do município.
  - `type ContextoDaAcao = { db: DbDoTenant; ator: { usuarioId: string; perfis: PerfilComEscopo[] }; agora: number }`; `contextoDoPainel(req): Promise<ContextoDaAcao>` (401 sem sessão); `contextoDoUsuario(db, usuarioId, agora): Promise<ContextoDaAcao>` (scripts).
  - `executarAcao<T>(ctx, meta: { acao: Acao; alvo: { tipo: string; id: string | ((r: T) => string) }; unidadeId?: string | null; motivo?: string | null; exigeMotivo?: boolean; ressalvas?: Ressalvas; dados?: (r: T) => Record<string, unknown> }, fn: (tx: TxDoTenant) => Promise<T>): Promise<T>` — sem motivo com `exigeMotivo` → `400 motivo_obrigatorio`; `!permitido` → `403 sem_permissao`; transação; `fn`; auditoria antes do commit.
  - `acaoDoPainel(req, meta, fn)` = `executarAcao(await contextoDoPainel(req), meta, fn)`. Convenção `config: { acao }`; `listarRotasSemAcao(app): string[]`.
  - Rota de teste `POST /v1/teste/painel/acao` (grava `pessoa_local`; `?falhar=depois`; `?exigeMotivo=1`).
- [ ] **Step 1: Testes** `"INV-12: ação do painel grava uma auditoria com quem, o quê, quando e alvo"`; `"INV-12: ação que falha depois de gravar não deixa nem o dado nem a auditoria"`; `"RN-PERF-03: sem motivo → 400 e nada gravado"`; `"sem permissão → 403 e nenhuma auditoria"`; `"auditoria de A não aparece em B"`; `executar-acao.test.ts`: `"PD-41: executarAcao fora do HTTP confere a permissão do usuário e audita em nome dele"` (`contextoDoUsuario` de um profissional numa ação de gestão → 403); `rotas-auditadas.test.ts`: `"PD-18: toda rota POST/PUT/PATCH/DELETE sob /v1/painel declara config.acao"` (fora `/v1/painel/auth/*`; uma rota falsa sem `acao` é apontada).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; suíte inteira; biome. **Step 5:** Commit `feat(api): audited service actions in one transaction`.

### Task 10: CORS do painel e login em dois subdomínios (fase 2 Task 9; T2.1; PD-24, PD-39)

**Files:**
- Create: `infra/painel/cors.ts`, `tests/integration/v1/painel/cors.test.ts`
- Modify: `app.ts`, `infra/env.ts` e `.env.*` (`PAINEL_ORIGEM_TEMPLATE` com `{slug}`), `infra/auth/painel.ts` (`trustedOrigins: [origemDoPainel(slug)]`), `apps/api/package.json` (`@fastify/cors`, versão exata), `tests/orchestrator.ts` (`origemDoPainel`)

**Interfaces:**
- Produces: `origemDoPainel(slug): string`; `origemPermitida(origem, host, config): boolean` (puro: só a origem do painel do mesmo slug do `Host`). CORS com `credentials: true`, métodos `GET, POST, PUT, PATCH, DELETE`; preflight → 204; origem recusada sem `Access-Control-Allow-Origin`.
- [ ] **Step 1: Testes** `"T2.1: login do painel de A pela origem do painel de A devolve cookie e CORS"`; `"T2.1: o mesmo para B; o eu de cada um mostra o próprio usuário"`; `"PD-24: origem do painel de B no Host de A não recebe CORS e o login é recusado"`; `"PD-24: origem desconhecida não recebe CORS"`; `"PD-24: preflight 204"`; unidade de `origemPermitida`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): same-tenant CORS for the panel`.

### Task 11: Guard da sessão do paciente (PD-33, PD-34; RN-ID-05)

**Files:**
- Create: `infra/auth/sessao-paciente.ts`, `test-routes/municipios/_slug/paciente/eu/route.ts`, `tests/integration/v1/teste/municipios/paciente-eu.test.ts`
- Modify: `app.ts`, `tests/orchestrator.ts` (`loginPaciente(cpf, senha)`)

**Interfaces:**
- Produces: `type PacienteAutenticado = { pacienteId: string; cpf: string; verificado: boolean }`; `pacienteDaSessao(headers: Headers): Promise<PacienteAutenticado | null>`; `req.paciente`; `app.exigirPaciente` (401 `nao_autenticado`), usado como `preHandler: [app.exigirTenant, app.exigirPaciente]`; rota de teste `GET /v1/teste/municipios/:slug/paciente/eu`.
- [ ] **Step 1: Testes** `"PD-33: sessão do paciente da central autentica numa rota do município pelo caminho"`; `"RN-ID-05: conta nova chega como não verificada"`; `"sem cookie → 401"`; `"cookie adulterado → 401; depois do sign-out → 401"`; `"cookie do painel não autentica como paciente"`; `"PD-15: município desconhecido com sessão válida → 404"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): patient session guard on tenant routes`.

### Task 12: Unidades e configuração herdada (fase 2 Tasks 10 e 11, enxutas; T2.2; PD-28, PD-35)

**Files:**
- Create: `infra/config/unidades.ts`, `routes/v1/painel/unidades/route.ts`, `routes/v1/painel/unidades/_unidadeId/route.ts`, `routes/v1/painel/unidades/_unidadeId/config/route.ts`, `tests/integration/v1/painel/unidades/{post,get,patch}.test.ts`, `tests/integration/v1/painel/unidades/config.test.ts`

**Interfaces:**
- Consumes: `executarAcao`, `exigir`, `validarConfig`, `configEfetiva`, schemas da Task 3.
- Produces:
  - `criarUnidade(ctx, dados: UnidadeEntrada): Promise<Unidade>` (ação de gestão, sem unidade; config inválida → `400 entrada_invalida` com os `campos` de `validarConfig`); `editarUnidade(ctx, id, dados: UnidadeEdicao): Promise<Unidade>` (`null` num campo da config remove a chave); `listarUnidades(ctx): Promise<Unidade[]>` (gestor: todas; os outros: as das suas perfis); `configDaUnidade(ctx, id)` → `configEfetiva({ municipio: {}, unidade: config })`. Auditoria `alvo: { tipo: "unidade" }`.
  - `POST /v1/painel/unidades` (201), `GET /v1/painel/unidades`, `GET|PATCH /v1/painel/unidades/:unidadeId`, `GET /v1/painel/unidades/:unidadeId/config`.
- [ ] **Step 1: Testes** `"T2.2: gestor cria unidade e ela aparece na lista"`; `"T2.2: só o gestor cria ou edita"` (admin → 403); `"T2.2: admin da unidade 1 lista só a unidade 1"`; `"fuso inválido → 400"`; `"K 0 → 400 no campo; K 1 aceito"`; `"modelo: sem valor próprio herda o padrão com origem padrao; com valor, origem unidade; null volta a herdar"`; `"INV-12: criar e editar auditados em nome do gestor"`; `"unidade de A não aparece em B"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): units with inherited configuration`.

### Task 13: Usuários do painel e perfis (fase 2 Task 12; T2.2; RN-PERF-01)

Entra na v0.1: sem esta tela o gestor não cria recepção, triagem e profissional sem o seed.

**Files:**
- Create: `infra/config/usuarios.ts`, `routes/v1/painel/usuarios/route.ts`, `routes/v1/painel/usuarios/_usuarioId/perfis/route.ts`, `tests/integration/v1/painel/usuarios/{post,get}.test.ts`, `tests/integration/v1/painel/usuarios/perfis-put.test.ts`

**Interfaces:**
- Consumes: `criarUsuarioPainel`, `concederPerfis`, `perfisDoUsuario`.
- Produces: `criarUsuario(ctx, dados: UsuarioPainelEntrada): Promise<UsuarioPainel>` (ação de gestão; usuário e perfis na mesma transação; `concedidoPor` = ator); `listarUsuarios(ctx)`; `trocarPerfis(ctx, usuarioId, perfis)`. Regras: perfil de unidade exige unidade existente do tenant (`400`); `gestor` só com escopo município (`400`); tirar o perfil do último gestor → `409 ultimo_gestor`; login repetido → `409 login_em_uso`. `POST|GET /v1/painel/usuarios`, `PUT /v1/painel/usuarios/:usuarioId/perfis`.
- [ ] **Step 1: Testes** `"T2.2: gestor cria recepção da unidade 1 e ela loga e vê o perfil no eu"`; `"perfil de unidade sem unidade ou com unidade inexistente → 400"`; `"último gestor não perde o perfil; com dois, um pode sair"`; `"T2.2: só o gestor gerencia usuários"`; `"login repetido → 409"`; `"INV-12: criação e troca de perfis auditadas"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): panel users and scoped profiles`.

### Task 14: Serviços (fase 2 Tasks 16 e 18, enxutas; T2.3; RN-TRI-01, PD-42)

**Files:**
- Create: `infra/config/servicos.ts`, `routes/v1/painel/unidades/_unidadeId/servicos/route.ts`, `routes/v1/painel/servicos/_servicoId/route.ts`, `tests/integration/v1/painel/servicos/{post,get,patch}.test.ts`

**Interfaces:**
- Consumes: `podeMudarExigeTriagem`, `contarAtivas`, schemas da Task 3.
- Produces: `criarServico(ctx, unidadeId, dados: ServicoEntrada)`, `editarServico(ctx, servicoId, dados: ServicoEdicao)`, `listarServicos(ctx, unidadeId)` (ação de configurar na unidade do serviço). Regras: prefixo repetido → `409 prefixo_em_uso`; mudar `exigeTriagem` com sessão `aberta` → `409 sessao_aberta`; desligar `exigeTriagem` com estação de triagem ligada ao serviço → `409 servico_em_estacao_de_triagem`; trocar `modo` com entradas ativas → `409 servico_com_entradas` com `dados.entradasAtivas`; para `regulado` com sessão pública planejada → `409 servico_regulado` (PD-42). `POST|GET /v1/painel/unidades/:unidadeId/servicos`, `PATCH /v1/painel/servicos/:servicoId`.
- [ ] **Step 1: Testes** `"T2.3: admin cria serviço com prefixo, triagem, modo e tempo médio"`; `"padrões: livre, sem triagem, 15 min"`; `"prefixo repetido na unidade → 409; em outra unidade, aceito"`; `"RN-TRI-01: exige triagem muda com sessões planejadas; com sessão aberta → 409 sessao_aberta"` (sessão `aberta` gravada direto no banco: o estado ainda não tem rota); `"desligar triagem com estação de triagem ligada → 409"`; `"PD-42: modo com entradas ativas → 409 com a contagem; sem entradas, muda"`; `"admin da unidade 2 não edita serviço da unidade 1 pelo id → 403"`; `"recepção não configura → 403"`; `"INV-12: auditoria"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): services per unit with safe changes`.

### Task 15: Estações (fase 2 Task 17; T2.3; RN-EST-01, RN-TRI-02)

**Files:**
- Create: `infra/config/estacoes.ts`, `routes/v1/painel/unidades/_unidadeId/estacoes/route.ts`, `routes/v1/painel/estacoes/_estacaoId/route.ts`, `tests/integration/v1/painel/estacoes/{post,get,patch,delete}.test.ts`

**Interfaces:**
- Produces: `criarEstacao(ctx, unidadeId, dados: EstacaoEntrada)`, `editarEstacao(ctx, id, dados: EstacaoEdicao)`, `arquivarEstacao(ctx, id)`, `listarEstacoes(ctx, unidadeId)` (sem as arquivadas). Regras: serviços da mesma unidade (`400`); estação de triagem só com serviços que exigem triagem (`400`); arquivar estação aberta → `409 estacao_ocupada`. `POST|GET /v1/painel/unidades/:unidadeId/estacoes`, `PATCH|DELETE /v1/painel/estacoes/:estacaoId`.
- [ ] **Step 1: Testes** `"RN-EST-01: estação ligada a etapa e serviços"`; `"RN-TRI-02: estação de triagem com vários serviços que exigem triagem"`; `"triagem com serviço sem triagem → 400"`; `"serviço de outra unidade → 400"`; `"estação aberta não é arquivada"`; `"INV-12: auditoria"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): call stations per unit`.

### Task 16: Sessões avulsas (fase 2 Task 21, enxuta; T2.5; AD-016, RN-PUB-03, PD-37)

**Files:**
- Create: `infra/config/sessoes.ts`, `routes/v1/painel/unidades/_unidadeId/sessoes/route.ts`, `routes/v1/painel/sessoes/_sessaoId/route.ts`, `routes/v1/painel/sessoes/_sessaoId/visibilidade/route.ts`, `routes/v1/painel/sessoes/_sessaoId/cancelar/route.ts`, `tests/integration/v1/painel/sessoes/{post,get,patch,visibilidade,cancelar}.test.ts`

**Interfaces:**
- Consumes: `validarSessao`, `mudarVisibilidade`, schemas da Task 3.
- Produces: `criarSessao(ctx, unidadeId, dados: SessaoEntrada)` (ação de configurar; serviço da unidade; `validarSessao` com o modo do serviço e as estações que o atendem); `editarSessao(ctx, id, dados: SessaoEdicao)` (ação de configurar; horário só em `planejada` → senão `409 transicao_proibida`; vagas abaixo de `ocupadas` → `409 vagas_abaixo_das_ocupadas`; `versao` diferente → `409 versao_desatualizada`); `mudarVisibilidadeDaSessao(ctx, id, dados)` (ação de sessão; `mudarVisibilidade` desliga a dispensa ao virar privada; pública em regulado → `409 servico_regulado`); `cancelarSessao(ctx, id)` (ação de sessão; só `planejada` sem entradas não finais, senão `409 sessao_com_pacientes`); `listarSessoes(ctx, unidadeId, { de, ate })`.
- [ ] **Step 1: Testes** `"T2.5: admin cria sessão avulsa pública com vagas e estações"`; `"vagas 0 → 400; 1 aceito"`; `"AD-016: dispensa em sessão privada → 400"`; `"pública em serviço regulado → 409 servico_regulado"`; `"estação que não atende o serviço → 400"`; `"vagas = ocupadas aceito; ocupadas − 1 → 409"` (ocupadas gravado direto); `"aberta não muda horário → 409"`; `"versao velha → 409"`; `"RN-PUB-03: pública vira privada e perde a dispensa"`; `"cancelar planejada vazia; com entrada → 409"`; `"lista por intervalo de datas"`; `"INV-12: auditoria"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): single sessions created and edited from the panel`.

### Task 17: Telas do gestor: unidades e usuários (fase 2 Task 27, enxuta; PD-31)

**Files:** Create `apps/painel/lib/formularios/{unidade,usuario}.ts`, `app/(painel)/unidades/page.tsx`, `app/(painel)/usuarios/page.tsx`, `test/{unidade-form,usuario-form}.test.tsx`; Modify `lib/navegacao.ts` e `test/navegacao.test.ts` (saem "Regras do município" e "TVs" até as suas fatias)

**Interfaces:**
- Consumes: schemas da Task 3, `euPainelSchema`, `useUnidadeAtual`.
- Produces: `useFormularioUnidade` (valores, erros por campo do schema ou do `campos` da API, envio de criação e edição); `campoHerdado(efetiva, campo): { valor; origem; proprio: boolean }` ("herdado do padrão: 5 min"); formulário de usuário com perfis por unidade.
- [ ] **Step 1: Testes** `"erro 400 da API aparece no campo certo"`; `"campo vazio mostra o valor herdado e a origem"`; `"limpar um valor próprio envia null e volta a herdar"`; `"perfil de unidade exige escolher a unidade"`; `"409 ultimo_gestor e login_em_uso mostram a mensagem"`; `"menu sem Regras do município e TVs"`.
- [ ] **Step 2:** `npm run test:painel` → FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(painel): manager screens for units and users`.

### Task 18: Telas do admin: serviços e estações (fase 2 Task 28, enxuta; PD-31)

**Files:** Create `apps/painel/lib/formularios/{servico,estacao}.ts`, `app/(painel)/servicos/page.tsx`, `app/(painel)/estacoes/page.tsx`, `test/{servico-form,estacao-form}.test.tsx`

**Interfaces:**
- Produces: formulário de serviço (nome, prefixo, exige triagem, como é marcado, tempo médio por etapa; tempo de triagem só com triagem ligada); formulário de estação (etapa só na criação; com etapa triagem, só oferece serviços que exigem triagem); lista com arquivar.
- [ ] **Step 1: Testes** `"409 servico_com_entradas mostra quantas entradas"`; `"409 sessao_aberta mostra 'há sessão aberta'"`; `"tempo de triagem some sem triagem"`; `"etapa triagem filtra os serviços"`; `"409 estacao_ocupada mostra a mensagem"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(painel): services and stations screens`.

### Task 19: Tela do admin: sessões avulsas (fase 2 Task 29, sem séries; PD-26, PD-31)

**Files:** Create `apps/painel/lib/formularios/sessao.ts`, `app/(painel)/sessoes/page.tsx`, `test/sessao-form.test.tsx`

**Interfaces:**
- Consumes: `localParaInstante`, `instanteParaLocal`, fuso da unidade atual.
- Produces: lista das sessões por dia (hora local); formulário com data, início, fim, vagas (vazio = sem limite), visibilidade, dispensa, profissional e estações do serviço; a dispensa some com visibilidade privada e com serviço regulado; serviço regulado não oferece pública; troca de visibilidade e cancelamento com confirmação; edição manda `versao`.
- [ ] **Step 1: Testes** `"08:00 de 12/11/2026 em America/Sao_Paulo vai como 2026-11-12T11:00:00Z e volta como 08:00"`; `"privada esconde e desliga a dispensa"`; `"serviço regulado não oferece pública"`; `"só estações que atendem o serviço"`; `"409 versao_desatualizada pede para recarregar"`; `"409 sessao_com_pacientes no cancelamento mostra a mensagem"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. Manual (com as Tasks 12–16 juntadas): no `npm run dev`, criar uma sessão em `exemplo.localhost:3000/sessoes`. **Step 5:** Commit `feat(painel): single sessions screen`.

### Task 20: `npm run dev:seed` pelas mesmas funções do sistema (PD-33, PD-40, PD-41)

**Files:**
- Create: `infra/tenant/derrubar.ts`, `infra/exemplo/semear.ts`, `infra/scripts/dev-seed.ts`, `tests/integration/infra/dev-seed.test.ts`, `tests/unit/infra/exemplo/pode-semear.test.ts`
- Modify: `apps/api/package.json` (`"dev:seed": "tsx infra/scripts/dev-seed.ts"`), `package.json` raiz (`"dev:seed": "npm -w @fila-saude/api run dev:seed"`)

**Interfaces:**
- Consumes: `criarTenant` (com `gestor`), `migrarBanco`, `contextoDoUsuario`, `executarAcao`, `criarUnidade`, `criarUsuario`, `criarServico`, `criarEstacao`, `criarSessao`, `entrarNaLista`, `authCentral.handler`, `localParaInstante`, `instanteParaLocal`, `cpfValido`.
- Produces:
  - `derrubarTenant(slug, deps: { central: Db; template: string }): Promise<void>` (`DROP DATABASE IF EXISTS … WITH (FORCE)` e apaga a linha de `municipio`).
  - `podeSemear(env: { NODE_ENV: string; TENANT_MODE: string }): boolean` (só `development` + `multi`).
  - `semearExemplo(deps: { central: Db; template: string; agora: number; slug?: string /* "exemplo" */ }): Promise<ResumoExemplo>`; `type ResumoExemplo = { painel: string; usuarios: { perfil: Perfil; login: string; senha: string }[]; pacientes: { nome: string; cpf: string; senha: string }[]; sessoes: { servico: string; visibilidade: "publica" | "privada"; inicioLocal: string }[] }`.
  - Passos (cada um pela função de serviço, com o contexto de quem faz no produto, PD-40): migra o central; apaga os pacientes de exemplo pelo CPF; `derrubarTenant`; `criarTenant({ slug, nome: "Município Exemplo", uf: "SP", gestor: { login: "gestor", nome: "Gestora Exemplo", senha } })`. **Como gestor:** `criarUnidade` "UBS Centro" (`ubs`, `America/Sao_Paulo`, seg–sex 07:00–17:00, `config: {}`); `criarUsuario` para `admin`, `agendador`, `recepcao`, `triagem`, `profissional` com escopo na UBS Centro. **Como admin:** `criarServico` "Clínico geral" (`C`, exige triagem, livre, triagem 5 min, atendimento 15) e "Odontologia" (`O`, sem triagem, livre, atendimento 20); `criarEstacao` "Triagem 1" (triagem; Clínico), "Consultório 1" (atendimento; Clínico), "Consultório 2" (atendimento; Odontologia); `criarSessao` **pública** do Clínico amanhã 08:00–12:00 local (20 vagas, Triagem 1 + Consultório 1, "Dra. Helena") e **privada** da Odontologia amanhã 13:00–17:00 (4 vagas, Consultório 2, "Dr. Paulo"); "amanhã" = dia seguinte a `agora` no fuso da unidade. **Pacientes:** Ana Souza (1958, idosa), Bruno Lima e Carla Dias (declara gestante) por `POST /v1/auth/sign-up/email` via `authCentral.handler`, com `email_verified = true`; cada um entra na lista da Odontologia por `entrarNaLista` como paciente (caminho do app, sem auditoria). **Como recepção:** José Pereira (sem app) por `executarAcao(ctxRecepcao, { acao: "criar_entrada", … }, (tx) => entrarNaLista(tx, …))`. Senha de todos: `exemplo123`. CPFs fixos no código, válidos pelo `cpfValido`.
  - Script: recusa com código 1 quando `!podeSemear(env)`; chama `semearExemplo` com `Date.now()`; imprime a URL do painel (`origemDoPainel("exemplo")` + `/login`), usuários, pacientes e sessões em hora local.
- [ ] **Step 1: Testes** (slug único, `agora` fixo em `2026-11-11T23:30-03:00`) `"exemplo: unidade, dois serviços (um com triagem), três estações e as duas sessões"`; `"exemplo: amanhã é no fuso da unidade"` (pública em `2026-11-12T11:00Z`, privada em `2026-11-12T16:00Z`); `"exemplo: cada perfil loga no painel e o eu mostra o próprio perfil"` (seis logins por HTTP); `"exemplo: pacientes logam na central e há 4 entradas aguardando na Odontologia; Ana conta como idosa"`; `"PD-40: auditoria atribuída a quem fez — gestor (unidade e 5 usuários), admin (2 serviços, 3 estações, 2 sessões), recepção (1 entrada); nenhuma linha para as entradas dos pacientes"`; `"PD-40: rodar de novo apaga e recria — mesmas contagens, ids novos, sessão antiga do painel inválida, nenhum cpf_em_uso"`; `"PD-40: depois de uma execução interrompida (município em criando, pacientes já no central), termina"`; `"PD-40: com a API no ar, o login funciona logo depois de re-semear"`; `pode-semear.test.ts`: `"PD-40: só development e multi"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; suítes da API, painel, domínio e schemas verdes; biome; `npm run specs:check`.
- [ ] **Step 5: Manual (trecho do roteiro da fatia):** `npm run db:migrate`; `npm run dev:seed`; `npm run dev`; em `http://exemplo.localhost:3000/login`, entrar com cada login e conferir o menu (gestor: unidades, usuários; admin: serviços, estações, sessões; os outros: "Em breve"); como gestor, criar um usuário de recepção e entrar com ele; como admin, criar uma sessão avulsa; rodar `npm run dev:seed` de novo com tudo no ar e entrar outra vez.
- [ ] **Step 6:** Commit `feat(api): example data seeded through the service functions`.

---

## Paralelismo

Regra da worktree-setup (`.superpowers/sdd/worktree-setup.md`): tudo o que usa o Postgres de teste (5433), a porta 3333 ou as migrations municipais roda **em sequência**; pacotes sem banco rodam em paralelo, cada um no seu worktree.

| Grupo | Tasks | Pode rodar junto com | Observação |
| --- | --- | --- | --- |
| **Merge (sozinha, primeiro)** | 1 | Nada | Lockfile, domínio, schemas e painel |
| **Contratos e base do painel** | 2, 3 | Entre si (arquivos diferentes de `packages/schemas`) e com a API 4–6 | A Task 7 precisa da 2; as telas 17–19 precisam das duas |
| **API (sequencial)** | 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 20 | Grupos de contratos e de telas | A 11 só depende da 1B Task 10 e pode trocar de lugar com 8–10; 12–16 precisam da 9; a 20 vem por último |
| **Telas do painel** | 17, 18, 19 | Entre si (conflito só no menu, trivial) e com a API | Testes com API falsa; a verificação manual de cada uma espera a rota (17 ← 12, 13; 18 ← 14, 15; 19 ← 16) e a Task 10 (CORS) |

As Tasks 2 e 10 mexem no `package-lock.json`; o segundo merge resolve com `npm install --package-lock-only`.

## Verificação ao fim da fatia

- `npm run test:domain`, `npm -w @fila-saude/schemas run test`, `npm run test:painel`, `npm -w @fila-saude/api run test` verdes; `npx biome check .` limpo; `npm run specs:check` com 0 erros.
- Critério da [trilha da v0.1](tasks.md#trilha-da-v01-2026-11-11) para a fatia 0: o Step 5 da Task 20 executado à mão uma vez.
- Ledger: abertos para a fatia 1 — fila do dia sobre `sessao` e `entrada`; abertura e encerramento da sessão por botão (ação de sessão); `chamado_item_id` da estação quando existir o item da fila; trocar o guard da PD-34 pelo JWT quando a 1B Task 14 voltar.

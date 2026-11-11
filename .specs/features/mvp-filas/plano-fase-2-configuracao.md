# Fase 2 — Configuração (painel, unidades, serviços, worker, sessões e TV) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Com a fundação da 1B pronta, permitir que um município se configure inteiro pelo painel: gestor cria unidades, regras e usuários; admin cria serviços, estações, sessões avulsas e séries recorrentes e pareia a TV; o worker roda por tenant com lock e envia a outbox de push com nova tentativa.

**Architecture:** Três frentes sobre a mesma base. (1) `packages/domain` ganha `recorrencia` (RFC 5545 pela lib `rrule`, sem I/O), `configuracao` (herança município → unidade → serviço → sessão) e as regras de mudança de serviço e de sessão (AD-038), puras e testadas antes da API. (2) `apps/api` ganha as rotas `/v1/painel/*` de configuração (cada uma com `acaoDoPainel`, guard e auditoria, PD-18), as rotas `/v1/tv/*` e o papel `worker` no mesmo processo (PD-25). (3) `apps/painel` nasce em Next 16 no subdomínio do tenant (PD-09), chamando a API com cookie (PD-24); só a lógica das telas é testada.

**Tech Stack:** TypeScript (strict, ESM, Node 24); domínio: Vitest 4, `rrule` 2.8; API: Fastify 5, Drizzle + `pg`, better-auth, `expo-server-sdk`, `@fastify/cors`; painel: Next 16.2, React 19.2, Tailwind 4, shadcn (como `apps/web`), Vitest + jsdom + Testing Library; Biome.

**Spec:** backlog T2.1–T2.6 em [`tasks.md`](tasks.md); arquitetura em [`plan.md`](plan.md) (PD-04, PD-09, PD-10, PD-11, PD-13 e as PD-14..PD-23 do [plano 1B](plano-fase-1b-fundacao-api.md)); regras em [`specs/modelo`](../../specs/modelo/spec.md) (configurações, entidades), [`specs/permissoes`](../../specs/permissoes/spec.md), [`specs/marcacao`](../../specs/marcacao/spec.md) (RN-ENC-05, RN-ENC-07, RN-PUB-03), [`specs/fila-do-dia`](../../specs/fila-do-dia/spec.md#sessão) (sessão), [`specs/chamada`](../../specs/chamada/spec.md) (RN-EST-01, RN-TRI-01/02), [`specs/tv-e-avisos`](../../specs/tv-e-avisos/spec.md) (RN-TV-01/02, RN-NOT-01); decisões AD-011, AD-014, AD-016, AD-038; designs [painel da recepção](design-painel-recepcao.md) e [estação e TV](design-estacao-tv.md) (estados da TV).

**Fora deste plano:** abertura e encerramento de sessão, fila, chamada, SSE e o resto da TV (fase 3); fluxo completo de cancelamento com remanejamento (T8.1: aqui só se cancela ocorrência sem pacientes); catálogo público no central (T3.2); recibos do Expo e avisos de fila (T3.8); telas da recepção, agendador e estação (fases 3, 5 e 7).

## Global Constraints

- **TDD sempre** (constituição, processo 1; [tasks.md](tasks.md#tasks-mvp-filas-ubspoliclínicas)): todo task segue teste → rodar e ver FAIL pelo motivo certo → implementar → rodar e ver PASS → commit. Nenhum código de produção sem teste vermelho antes.
- **Domínio:** as mesmas regras da 1A (sem `Date.now()`, rede ou banco em `src/`; `agora: number`; ações não alteram o que recebem; IDs das regras no nome dos testes). `rrule` é a única dependência de runtime do pacote (PD-10); tudo o que é fuso passa por `tempo.ts`.
- **API:** ciclo pelo teste de integração da rota (padrão da 1B: servidor real, `fetch`, `<slug>.localhost:3333`, bancos por arquivo, `fileParallelism: false`, PD-19). Worker e outbox testados no processo do Vitest contra o Postgres real, com relógio injetado; concorrência com dois escritores reais (L-003). Toda rota mutável do painel usa `acaoDoPainel` com `config.acao` (o teste de rotas da 1B Task 18 pega o esquecimento).
- **Painel:** a lógica (funções puras, hooks e estado das telas) é testada com Vitest e, onde houver estado, Testing Library; layout puro não é testado (regra da [tasks.md](tasks.md)). O cliente da API é injetado; nada de servidor real nos testes do painel.
- Limites numéricos dos dois lados (L-004): vagas 0/1, janela de 90 dias (dentro e fora), código da TV vencido e válido, tentativas da outbox 7/8, K 0/1.
- Ações do painel citam a ação da matriz pela constante da 1A Task 12 (`Acao`); onde este plano diz "ação de configurar", vale a constante da linha "Configurar serviços, sessões, estações; parear e revogar TV" da matriz; "ação de gestão", a da linha "Criar unidades, regras do município e usuários do painel"; "ação de sessão", a da linha "Abrir, cancelar, encerrar sessão; mudar visibilidade".
- `npx biome check` limpo nos pacotes tocados e `npm run specs:check` sem erros ao fim de cada task.

## Decisões desta fase

Registradas como PD-24..PD-31 na tabela do [plan.md](plan.md#1-decisões-de-arquitetura); aqui com o detalhe.

| ID | Decisão | Por quê | Custa se errado |
| --- | --- | --- | --- |
| PD-24 | **Painel ↔ API:** em dev o painel roda em `http://<slug>.localhost:3000` e chama `http://<slug>.localhost:3333` com `credentials: "include"`; a API libera CORS com credenciais **só para a origem do mesmo tenant** (`http://<slug>.localhost:3000`, conferida contra o `Host`). Os cookies do better-auth valem para o host sem olhar a porta, então o login feito pela API vale nas duas. Em produção, mesma origem: o Caddy manda `/v1/*` do subdomínio para a API. `apps/web` passa a `next dev -p 3001` | Sem proxy no Next (que perderia o `Host` com o slug) e sem cookie compartilhado entre municípios | Baixo: trocar por proxy mexe só no cliente da API do painel e na config do CORS |
| PD-25 | **Worker no mesmo processo, ligado por `PAPEIS`** (`http,sse,worker`; padrão `http,worker` em dev; o servidor de teste sobe só `http`). A cada minuto, para cada tenant ativo, pega um cliente dedicado do pool e tenta `pg_try_advisory_lock(hashtext('varredura'))`; quem não consegue pula o tenant; quem consegue roda as tarefas registradas e libera no `finally`. **Outbox** `outbox_push` lida com `FOR UPDATE SKIP LOCKED` em lotes; falha → nova tentativa em `1 min × 2^(tentativas−1)`; na 8ª falha vira `falhou`. Push atrás da interface `EnviadorPush` (Expo em produção, `PushFalso` nos testes) | Uma instância por tenant sem coordenação extra (PD-11); a outbox não perde aviso se o processo cair; os testes rodam a varredura no processo do Vitest com relógio fixo | Médio: muitos tenants num minuto só exigiriam paralelizar a varredura; o lock por tenant já permite várias instâncias |
| PD-26 | **Recorrência em hora local "flutuante"**: a série guarda `DTSTART` local (`AAAA-MM-DDTHH:mm`), duração, `RRULE`, `EXDATE` e `RDATE` locais e o fuso vem da unidade. O `rrule` expande sem `tzid` (hora local tratada como UTC) e cada ocorrência é convertida para instante real por `localParaInstante(local, fuso)`. A **chave da ocorrência** é o início local original (equivale ao `RECURRENCE-ID`); `sessao` tem único `(serie_id, chave_ocorrencia)` | Evita o `tzid` do `rrule`, que depende do fuso da máquina; "toda terça às 8h" continua às 8h mesmo se o fuso mudar de regra; a chave torna a materialização idempotente | Baixo: a conversão está num lugar só e tem teste com fuso de horário de verão |
| PD-27 | **"Esta e as seguintes"** fecha a série antiga com `UNTIL` na véspera da ocorrência escolhida e cria uma série nova a partir dela. Ocorrências futuras já materializadas da série antiga, **planejadas e sem entradas**, são apagadas e a nova série as recria; **com entradas** ficam como estão (com a configuração que tinham) e passam a apontar para a série nova, e o painel mostra quantas | Nunca some uma sessão com paciente (INV-02, INV-10); o resto segue a regra nova | Baixo: o admin edita à mão as poucas sessões mantidas |
| PD-28 | **Herança de configuração**: colunas anuláveis em `config_municipio` (uma linha por tenant), `unidade`, `servico` e `sessao`; a configuração efetiva é calculada no domínio por `configEfetiva(...)` (nulo herda; padrão final é `CONFIG_PADRAO`). O painel mostra o valor herdado e de onde vem | Uma regra só, pura e testada, para API, painel e worker | Baixo |
| PD-29 | **Pareamento da TV**: a página `/tv` pede `POST /v1/tv/dispositivos` e guarda o **token do dispositivo** (opaco, 32 bytes; no banco só o hash) no `localStorage`; recebe um **código de 6 dígitos válido por 10 min**, único entre os pendentes do tenant e renovado quando vence. O admin digita o código no painel para vincular a TV a uma unidade; revogar invalida o token e a TV volta a pedir um código. Até o SSE da T3.5, a TV consulta `GET /v1/tv/estado` a cada 5 s | Código curto para digitar, token longo para autenticar; nada da unidade sai sem pareamento (RN-TV-02) | Baixo: SSE substitui só o polling |
| PD-30 | **Tabela mínima `entrada` já na fase 2** (`id`, `servico_id`, `sessao_id`, `responsavel_paciente_id`, `pessoa_local_id`, `estado` com os valores de `EstadoEntrada`, `vaga_segura`, `data_entrada_original`), porque RN-ENC-07 e AD-038 precisam contar e converter entradas. As fases 3 e 5 estendem a tabela por migration. Os efeitos da troca para "regulado" sobre sessões e séries entram depois das sessões existirem (Task 24), fechando o critério da T2.3 | Testar a regra agora, com dados reais, sem esperar a fase 5 | Baixo: colunas novas são aditivas |
| PD-31 | **Testes do painel** com Vitest + jsdom + Testing Library; o cliente da API é um objeto injetado por contexto React (`ApiProvider`), trocado por um falso nos testes (sem MSW) | Sem dependência extra e sem servidor; o contrato vem de `packages/schemas` | Baixo |

## Review Focus

1. **Recorrência no fuso da unidade:** série semanal com `EXDATE` e `RDATE` gera exatamente as ocorrências esperadas em `America/Sao_Paulo` e num fuso com horário de verão; ocorrência no limite da janela de 90 dias (dentro e fora); materializar duas vezes não duplica. Tasks 1–3 e 23.
2. **Editar uma ocorrência não altera as outras; "esta e as seguintes" nunca apaga sessão com paciente** (PD-27). Tasks 3, 21 e 22.
3. **Duas instâncias do worker:** nunca processam o mesmo tenant ao mesmo tempo; a segunda processa outro tenant. Item da outbox que falha volta com backoff e para na 8ª falha. Tasks 12 e 13.
4. **Mudanças de configuração seguras (AD-038):** "exige triagem" com sessão aberta → 409; troca para "regulado" com entradas ativas → 409 com a contagem; livre ↔ requisição converte as entradas pelo contrato de estado, sem foto retroativa; serviço regulado nunca tem sessão pública; sessão que vira privada perde a dispensa. Tasks 5, 18, 19, 24.
5. **Isolamento da TV:** TV sem pareamento não recebe nada da unidade; TV da unidade 1 nunca recebe dados da 2; revogar devolve a TV ao código. Tasks 25 e 26.

---

## Estrutura de arquivos

```
packages/domain/src/
  tempo.ts            + localParaInstante(), instanteParaLocal()
  recorrencia.ts      Serie, expandir(), ocorrenciasNovas(), dividirSerie()
  configuracao.ts     configEfetiva(), validarConfig()
  servico.ts          mudarModoServico(), podeMudarExigeTriagem()
  sessao-config.ts    validarSessao(), mudarVisibilidade()
packages/domain/test/{recorrencia,configuracao,servico,sessao-config}.test.ts
packages/schemas/
  unidade.ts · config.ts · usuario.ts · servico.ts · estacao.ts · sessao.ts · serie.ts · tv.ts
apps/api/
  infra/database/municipal/schema/
    unidade.ts · config-municipio.ts · servico.ts · estacao.ts · sessao.ts · serie.ts · entrada.ts
    outbox.ts · dispositivo-tv.ts
  infra/database/central/schema/dispositivo-push.ts
  infra/worker/
    varredura.ts      executarVarredura({ tenants, tarefas, agora })
    tarefas.ts        registro das tarefas (enviarOutbox, materializarSeries)
    outbox.ts         enfileirarPush(tx, msg), enviarOutbox(ctx)
    push.ts           EnviadorPush, EnviadorExpo, PushFalso
    papeis.ts         iniciarPapeis(env) (timer do worker)
  infra/painel/cors.ts
  routes/v1/painel/
    municipio/route.ts                        GET/PUT regras do município
    unidades/route.ts                         GET/POST
    unidades/_unidadeId/route.ts              GET/PATCH
    unidades/_unidadeId/config/route.ts       GET (efetiva)
    unidades/_unidadeId/servicos/route.ts     GET/POST
    unidades/_unidadeId/estacoes/route.ts     GET/POST
    unidades/_unidadeId/sessoes/route.ts      GET/POST (avulsa)
    unidades/_unidadeId/series/route.ts       GET/POST
    unidades/_unidadeId/tvs/route.ts          GET/POST (vincular)
    servicos/_servicoId/route.ts              PATCH (inclui modo e exige triagem)
    estacoes/_estacaoId/route.ts              PATCH/DELETE
    sessoes/_sessaoId/route.ts                PATCH (só esta) / cancelar
    sessoes/_sessaoId/visibilidade/route.ts   PUT
    series/_serieId/dividir/route.ts          POST ("esta e as seguintes")
    tvs/_tvId/route.ts                        DELETE (revogar)
    usuarios/route.ts                         GET/POST
    usuarios/_usuarioId/perfis/route.ts       PUT
  routes/v1/tv/{dispositivos,estado,unidade}/route.ts
apps/painel/                                  Next 16 (igual a apps/web) + vitest.config.ts
  proxy.ts                                    slug pelo Host
  lib/{tenant.ts, api.ts, navegacao.ts, formularios/*.ts}
  app/(painel)/painel/{unidades,usuarios,servicos,estacoes,sessoes,tvs}/page.tsx
  app/login/page.tsx · app/tv/page.tsx
  test/*.test.ts(x)
```

---

### Task 1: Hora local e expansão semanal (T2.5; PD-10, PD-26, AD-014)

**Files:**
- Modify: `packages/domain/src/tempo.ts`, `packages/domain/package.json` (dependência `rrule`), `packages/domain/src/index.ts`
- Create: `packages/domain/src/recorrencia.ts`, `packages/domain/test/recorrencia.test.ts`

**Interfaces:**
- Produces:
  - `localParaInstante(local: string /* AAAA-MM-DDTHH:mm */, fuso: string): number`; `instanteParaLocal(instante: number, fuso: string): string`.
  - `type Serie = { dtstart: string; duracaoMin: number; rrule: string /* sem DTSTART, ex.: "FREQ=WEEKLY;BYDAY=TU" */; exdate: string[]; rdate: string[]; fuso: string }`.
  - `type Ocorrencia = { chave: string /* início local */; inicio: number; fim: number }`.
  - `expandir(serie: Serie, janela: { de: number; ate: number }): Ocorrencia[]` (ordenadas por `inicio`; incluem as que começam em `[de, ate)`).
- [ ] **Step 1: Testes** `"AD-014: semanal às terças 08:00 em America/Sao_Paulo gera as terças da janela"` (instantes UTC conferidos à mão: 11:00Z); `"PD-26: hora local se mantém num fuso com horário de verão"` (`America/New_York`, série semanal atravessando a troca de março: 08:00 local antes e depois, instantes UTC diferentes); `localParaInstante`/`instanteParaLocal` ida e volta; `"expandir não altera a série recebida"` (`Object.freeze`).
- [ ] **Step 2:** `npm -w @fila-saude/domain run test -- recorrencia` → FAIL.
- [ ] **Step 3:** Implementar: `RRule.fromString` com `dtstart` como `Date` UTC "flutuante" montado do local; `between` na janela convertida para flutuante (com folga de 1 dia nas pontas) e filtro final pelos instantes reais.
- [ ] **Step 4:** PASS; `npx biome check packages/domain`.
- [ ] **Step 5:** Commit `feat(domain): local-time recurrence expansion`.

### Task 2: EXDATE, RDATE, COUNT, UNTIL e a janela (T2.5; PD-10, C40)

**Files:** Modify `packages/domain/src/recorrencia.ts`, `packages/domain/test/recorrencia.test.ts`

**Interfaces:**
- Produces: `expandir` respeita `EXDATE` (remove a ocorrência com a mesma chave local), `RDATE` (acrescenta; duplicada com a regra aparece uma vez), `COUNT` e `UNTIL` dentro da `rrule`. Constante `JANELA_MATERIALIZACAO_DIAS = 90`.
- [ ] **Step 1: Testes** `"C40: semanal com EXDATE pula só aquela data"`; `"RDATE acrescenta uma data fora da regra; RDATE igual a uma ocorrência não duplica"`; `"COUNT=3 gera 3; UNTIL inclui o próprio dia"`; janela (L-004): ocorrência que começa exatamente em `de` entra, exatamente em `ate` não entra; ocorrência a 89 dias e 23:59 entra e a 90 dias não entra com `ate = agora + 90 dias`; `rrule` inválida → lança `Error("rrule_invalida")` (a API converte em 400).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(domain): exdate, rdate and the materialization window`.

### Task 3: Ocorrências novas (idempotência) e divisão da série (T2.5; PD-26, PD-27)

**Files:** Modify `packages/domain/src/recorrencia.ts`, `packages/domain/test/recorrencia.test.ts`

**Interfaces:**
- Produces:
  - `ocorrenciasNovas(serie: Serie, existentes: Set<string> /* chaves já materializadas, inclusive editadas e canceladas */, janela): Ocorrencia[]`.
  - `dividirSerie(serie: Serie, aPartirDe: string /* chave */): { antiga: Serie; nova: Serie }` — `antiga` ganha `UNTIL` no fim do dia local anterior a `aPartirDe` (substitui `COUNT`, se houver, pela contagem restante na nova); `nova.dtstart = aPartirDe`; `EXDATE`/`RDATE` repartidos pelo lado de cada data. Chave que não é ocorrência da série → lança `Error("ocorrencia_inexistente")`.
  - `separarMaterializadas(chaves: { chave: string; temEntradas: boolean; estado: EstadoSessao }[], aPartirDe: string): { apagar: string[]; manter: string[] }` (PD-27: futuras planejadas sem entradas são apagadas; o resto é mantido).
- [ ] **Step 1: Testes** `"PD-26: ocorrência já materializada, editada ou cancelada não volta"`; `"PD-27: dividir na 3ª ocorrência: a antiga termina na 2ª, a nova começa na 3ª, sem buraco nem repetição"` (concatenação das duas expansões = expansão original); `"PD-27: COUNT é repartido"`; `"PD-27: EXDATE de depois do corte vai para a nova"`; `"PD-27: sessão com entradas é mantida; planejada vazia é apagada; aberta ou encerrada nunca é apagada"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(domain): idempotent occurrences and series split`.

### Task 4: Herança e validação das configurações (T2.2; specs/modelo configurações, PD-28)

**Files:** Create `packages/domain/src/configuracao.ts`, `packages/domain/test/configuracao.test.ts`; Modify `src/index.ts`

**Interfaces:**
- Consumes: `ConfigUnidade`, `CONFIG_PADRAO`.
- Produces:
  - `type ConfigParcial = Partial<ConfigUnidade> & { exigePreCadastro?: boolean; soVinculados?: boolean; umaUnidadePorVez?: boolean }`.
  - `configEfetiva(niveis: { municipio: ConfigParcial; unidade: ConfigParcial }): ConfigUnidade & { exigePreCadastro: boolean; soVinculados: boolean; umaUnidadePorVez: boolean; origem: Record<string, "padrao" | "municipio" | "unidade"> }` — nulo/ausente herda; padrões da tabela de configurações (pré-cadastro ligado, AD-053; vínculo desligado; uma unidade por vez desligado).
  - `validarConfig(c: ConfigParcial): { ok: true } | { ok: false; campos: Record<string, string> }` — K ≥ 1, tolerância ≥ 1 min, "saia de casa" ≥ 1 min, QR entre 10 e 300 s, destaque da TV entre 3 e 60 s, prazo de confirmação ≥ 1 h, faltas ≥ 1 em ≥ 1 dia, fuso IANA válido (`Intl.DateTimeFormat` aceita).
- [ ] **Step 1: Testes** `"modelo: unidade sem valor herda do município; município sem valor herda o padrão"`; `"modelo: origem diz de onde veio cada valor"`; `"AD-053: pré-cadastro ligado por padrão"`; limites (L-004): K 0 recusado e 1 aceito; QR 9/10 e 300/301; destaque 2/3 e 60/61; fuso `America/Sao_Paulo` aceito e `Brasil/Recife` recusado.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(domain): configuration inheritance and validation`.

### Task 5: Regras de mudança de serviço e de sessão (T2.3, T2.5; RN-ENC-05, RN-ENC-07, RN-PUB-03, AD-016, AD-038)

**Files:** Create `packages/domain/src/servico.ts`, `src/sessao-config.ts`, `test/servico.test.ts`, `test/sessao-config.test.ts`; Modify `src/index.ts`

**Interfaces:**
- Consumes: `TRANSICOES_ENTRADA`, `transicionar`, `EstadoEntrada`, `EstadoSessao`, `falha`, `ok`.
- Produces:
  - `type ModoServico = "livre" | "requisicao" | "regulado"`.
  - `podeMudarExigeTriagem(sessoesDoServico: { estado: EstadoSessao }[]): boolean` (falso com alguma `aberta`).
  - `mudarModoServico(de: ModoServico, para: ModoServico, entradas: { id: string; estado: EstadoEntrada; vagaSegura: boolean; sessaoAbriu: boolean }[]): Resultado<{ mudancas: { id: string; para: EstadoEntrada; push: boolean }[] }>` — para `regulado` com entradas ativas (não finais e não arquivadas) → `falha("servico_regulado")` (a API mostra a contagem com `contarAtivas(entradas): number`, também exportada); arquivadas viram `cancelada` com push; `requisicao` → `livre`: `aguardando_encaminhamento` vira `aguardando`, ou `confirmada` com push se tinha vaga segura e a sessão não abriu (linhas da tabela de [marcacao](../../specs/marcacao/spec.md#transições), via `transicionar`); `livre` → `requisicao`: nada muda (AD-038).
  - `type ConfigSessao = { vagas: number | null; visibilidade: "publica" | "privada"; dispensaPreCadastro: boolean; profissional: string | null; estacoes: string[] }`.
  - `validarSessao(servico: { modo: ModoServico; estacoesDoServico: string[] }, c: ConfigSessao): { ok: true } | { ok: false; erro: "servico_regulado" | "entrada_invalida"; campos?: Record<string, string> }` — vagas inteiro ≥ 1 ou nulo; pública em serviço regulado → `servico_regulado`; dispensa só em pública (AD-016); estações só as que atendem o serviço.
  - `mudarVisibilidade(c: ConfigSessao, para: "publica" | "privada", modo: ModoServico): Resultado<ConfigSessao>` — para privada desliga a dispensa (RN-PUB-03); para pública em regulado → `falha("servico_regulado")`.
- [ ] **Step 1: Testes** `"RN-ENC-07: troca para regulado bloqueada com entradas ativas, com a contagem"`; `"RN-ENC-07: arquivadas são canceladas com push"`; `"RN-ENC-07: aguardando encaminhamento vira aguardando ao virar livre"`; `"RN-ENC-07: vaga segura vira confirmada com push antes da abertura"`; `"AD-038: livre para requisição não exige foto de quem já está na lista"`; `"RN-TRI-01: exige triagem não muda com sessão aberta"` (planejada pode, aberta não); `validarSessao`: vagas 0 recusado, 1 aceito, nulo aceito; `"AD-016: dispensa só em pública"`; `"RN-PUB-03: pública vira privada e perde a dispensa"`; `"RN-PUB-03: privada não vira pública em serviço regulado"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (cada mudança de estado da entrada passa por `transicionar`; `null` → `falha("transicao_proibida")`). **Step 4:** PASS; biome. **Step 5:** Commit `feat(domain): safe service and session configuration changes`.

### Task 6: Contratos Zod da configuração (T2.1–T2.6)

**Files:** Create `packages/schemas/{unidade,config,usuario,servico,estacao,sessao,serie,tv}.ts`, `packages/schemas/test/configuracao.test.ts`

**Interfaces:**
- Produces (entrada e saída de cada rota da fase): `unidadeEntradaSchema` (nome, tipo `"ubs" | "policlinica" | "upa"`, endereço, `lat` −90..90, `lng` −180..180, fuso, horário de funcionamento por dia da semana `{ abre: "HH:mm"; fecha: "HH:mm" }[]`, configurações opcionais), `configMunicipioSchema`, `usuarioPainelEntradaSchema` (login 3–30, nome, senha ≥ 8, perfis `{ perfil; unidadeId | null }[]`), `servicoEntradaSchema` (nome, prefixo 1–3 letras maiúsculas, `exigeTriagem`, `modo`, `tempoMedioMin` por etapa ≥ 1), `estacaoEntradaSchema` (nome, etapa, `servicos` ≥ 1), `sessaoEntradaSchema`, `serieEntradaSchema` (`dtstart` local, `duracaoMin` ≥ 1, `rrule`, `exdate`, `rdate`, configuração padrão), `tvEstadoSchema` (`{ estado: "aguardando"; codigo; expiraEm } | { estado: "pareada"; unidade: { id; nome } }`).
- [ ] **Step 1: Testes** um caso válido e os limites de cada campo numérico ou de tamanho dos dois lados (L-004: prefixo 0/1 e 3/4 letras; lat 90/90.0001; login 2/3 e 30/31); `horario.fecha` antes de `abre` recusado.
- [ ] **Step 2:** `npm -w @fila-saude/schemas run test` → FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(schemas): configuration contracts`.

### Task 7: `apps/painel` com tenant pelo Host e cliente da API (T2.1; PD-09, PD-24, PD-31)

**Files:**
- Create: `apps/painel/` (copiar a base de `apps/web`: `package.json` com Next 16.2, React 19.2, Tailwind 4, shadcn, `biome.json`, `tsconfig.json`, `postcss.config.mjs`, `app/globals.css` e os componentes de UI e logo que forem usados), `apps/painel/vitest.config.ts`, `proxy.ts`, `lib/tenant.ts`, `lib/api.ts`, `test/tenant.test.ts`, `test/api.test.ts`
- Modify: `apps/web/package.json` (`dev: next dev -p 3001`), `package.json` raiz (`"test:painel"`)

**Interfaces:**
- Produces:
  - `slugDoHost(host: string, dominioBase: string): string | null` (`pref-a.localhost:3000` → `pref-a`; `localhost:3000` → `null`).
  - `urlDaApi(local: { protocol: string; hostname: string }, env: { NEXT_PUBLIC_API_PORTA?: string }): string` — com porta configurada (dev) `http://<hostname>:3333`; sem porta (produção) `""` (mesma origem).
  - `criarApi(base: string, fetcher = fetch)` → `{ get, post, patch, put, del }` com `credentials: "include"`, JSON, e erro como `ErroDaApi { status; erro; mensagem?; campos? }` (PD-22).
  - `proxy.ts`: sem slug no host → página "município não encontrado"; com slug, segue.
- [ ] **Step 1: Testes** `slugDoHost` (com e sem porta, raiz, subdomínio duplo); `urlDaApi` (dev e produção); `"api: envia cookie e converte 409 em ErroDaApi com o código"` (fetcher falso).
- [ ] **Step 2:** `npm -w @fila-saude/painel run test` → FAIL. **Step 3:** implementar. **Step 4:** PASS; biome; `npm -w @fila-saude/painel run build` compila. **Step 5:** Commit `feat(painel): Next app with tenant from host and API client`.

### Task 8: Login e navegação por perfil (T2.1; PD-09, specs/permissoes)

**Files:** Create `apps/painel/lib/navegacao.ts`, `lib/sessao.tsx` (`ApiProvider`, `useEu`), `app/login/page.tsx`, `app/(painel)/layout.tsx`, `test/navegacao.test.ts`, `test/login.test.tsx`

**Interfaces:**
- Consumes: `pode`, `Perfil` (1A Task 12), `euPainelSchema` (1B Task 16).
- Produces:
  - `menuDoPainel(perfis: { perfil: Perfil; unidadeId: string | null }[]): { rotulo: string; href: string }[]` — gestor: unidades, usuários, regras do município; admin: serviços, estações, sessões, TVs; os demais perfis: um item "em breve" até as fases 3–7. Item só aparece se `pode` permitir a ação correspondente.
  - Formulário de login (`useLogin`): estados `ocioso | enviando | erro(credenciais | bloqueado | rede)`; sucesso redireciona para o primeiro item do menu.
- [ ] **Step 1: Testes** `"menu do gestor tem unidades, usuários e regras; do admin, serviços, estações, sessões e TVs"`; `"perfil acumulado soma os itens sem repetir"`; `"login: 401 mostra credenciais inválidas; erro de rede mostra tentar de novo; sucesso navega"` (Testing Library, API falsa).
- [ ] **Step 2:** FAIL. **Step 3:** implementar (telas sobre os componentes do design system de `apps/web`). **Step 4:** PASS; biome. **Step 5:** Commit `feat(painel): login and role-based navigation`.

### Task 9: CORS do painel e login em dois subdomínios (T2.1; PD-24)

**Files:** Create `apps/api/infra/painel/cors.ts`, `tests/integration/v1/painel/cors.test.ts`; Modify `server.ts`, `infra/auth/painel.ts` (`trustedOrigins` do tenant), `.env.*` (`PAINEL_PORTA=3000`), `package.json` (`@fastify/cors`)

**Interfaces:**
- Produces: CORS com `credentials: true` e `origin` aceita só quando o host da origem é `<slug>.<dominio>:<PAINEL_PORTA>` com o mesmo slug do `Host` da requisição; preflight `OPTIONS` responde 204 com os cabeçalhos; outra origem não recebe `Access-Control-Allow-Origin`.
- [ ] **Step 1: Testes** `"T2.1: login do painel de A pela origem do painel de A funciona e devolve o cookie"`; `"T2.1: o mesmo para B, cada um no seu tenant"` (o `GET /v1/painel/eu` de cada um mostra o próprio usuário); `"PD-24: origem do painel de B chamando o Host de A não recebe CORS"`; `"PD-24: origem desconhecida não recebe CORS"`.
- [ ] **Step 2:** `VITEST_ARGS=tests/integration/v1/painel/cors.test.ts npm -w @fila-saude/api run test` → FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. Manual: `npm run dev`, login em `pref-a.localhost:3000` e `pref-b.localhost:3000`. **Step 5:** Commit `feat(api): same-tenant CORS for the panel`.

### Task 10: Unidades (T2.2; specs/modelo, specs/permissoes)

**Files:** Create `infra/database/municipal/schema/unidade.ts` (+ migration; FK de `perfil_usuario.unidade_id`), `routes/v1/painel/unidades/route.ts`, `routes/v1/painel/unidades/_unidadeId/route.ts`, `tests/integration/v1/painel/unidades/{post,get,patch}.test.ts`

**Interfaces:**
- Consumes: `acaoDoPainel`, `exigir`, `unidadeEntradaSchema`, `validarConfig`.
- Produces: tabela `unidade` (campos do schema + colunas anuláveis de configuração da PD-28); `POST /v1/painel/unidades` (ação de gestão) → 201; `GET` lista (gestor vê todas; perfis de unidade veem as suas); `PATCH /v1/painel/unidades/:unidadeId` (ação de gestão). Auditoria com `alvo: { tipo: "unidade" }`.
- [ ] **Step 1: Testes** `"T2.2: gestor cria unidade e ela aparece na lista"`; `"T2.2: só o gestor cria ou edita"` (admin → 403); `"T2.2: admin da unidade 1 lista só a unidade 1"`; `"fuso inválido → 400"`; `"INV-12: criar e editar geram auditoria"`; `"unidade de A não aparece em B"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): units managed by the municipal manager`.

### Task 11: Regras do município e configuração efetiva da unidade (T2.2; PD-28, AD-004)

**Files:** Create `infra/database/municipal/schema/config-municipio.ts` (+ migration, uma linha criada no `tenant:create`), `routes/v1/painel/municipio/route.ts`, `routes/v1/painel/unidades/_unidadeId/config/route.ts`, `tests/integration/v1/painel/municipio/{get,put}.test.ts`, `tests/integration/v1/painel/unidades/config.test.ts`

**Interfaces:**
- Consumes: `configEfetiva`, `validarConfig`, `configMunicipioSchema`.
- Produces: `GET/PUT /v1/painel/municipio` (ordem risco × legal, alerta de faltas, "ainda precisa?", uma unidade por vez; PUT com a ação de gestão); `GET /v1/painel/unidades/:unidadeId/config` → efetiva com `origem`.
- [ ] **Step 1: Testes** `"T2.2: configurações herdam do nível acima"` (município muda tolerância → unidade sem valor mostra a nova, com `origem: "municipio"`; unidade com valor próprio mantém o seu); `"AD-004: ordem risco × legal é do município"`; `"T2.2: só o gestor muda as regras do município"`; `"K = 0 → 400"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): municipal rules and effective unit configuration`.

### Task 12: Usuários do painel e perfis (T2.2; specs/permissoes, RN-PERF-01)

**Files:** Create `routes/v1/painel/usuarios/route.ts`, `routes/v1/painel/usuarios/_usuarioId/perfis/route.ts`, `tests/integration/v1/painel/usuarios/{post,get}.test.ts`, `tests/integration/v1/painel/usuarios/perfis-put.test.ts`

**Interfaces:**
- Consumes: `criarUsuarioPainel` (1B Task 15), `perfil_usuario`, `usuarioPainelEntradaSchema`.
- Produces: `POST /v1/painel/usuarios` (ação de gestão) cria usuário e perfis; `GET` lista com perfis; `PUT .../perfis` substitui os perfis. Regras: perfil de unidade exige `unidadeId` de uma unidade do tenant; `gestor` só com escopo município; o gestor não remove o próprio perfil de gestor se for o último gestor (`409 ultimo_gestor`).
- [ ] **Step 1: Testes** `"T2.2: gestor cria agendador da unidade 1 e ele loga"`; `"perfil de unidade sem unidade → 400; unidade de outro tenant → 400"`; `"último gestor não perde o perfil"` (com dois gestores, um pode sair); `"T2.2: só o gestor gerencia usuários"`; `"INV-12: auditoria de criação e de troca de perfis"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): panel users and scoped profiles`.

### Task 13: Varredura por tenant com lock consultivo (T2.4; PD-11, PD-25)

**Files:** Create `infra/worker/varredura.ts`, `infra/worker/tarefas.ts`, `tests/integration/infra/varredura.test.ts`

**Interfaces:**
- Consumes: `PoolsDosTenants`, central `municipio`.
- Produces:
  - `type Tarefa = { nome: string; executar(ctx: { slug: string; db: Db; agora: number; push: EnviadorPush; central: Db }): Promise<void> }`.
  - `executarVarredura(deps: { pools; central; tarefas: Tarefa[]; agora: number; push }): Promise<{ slug: string; processado: boolean; erros: { tarefa: string; erro: string }[] }[]>` — por tenant ativo: cliente dedicado, `pg_try_advisory_lock`, tarefas em sequência (erro numa tarefa é registrado e as outras seguem), `pg_advisory_unlock` e devolução do cliente no `finally`.
- [ ] **Step 1: Testes** (L-003, dois escritores reais) `"T2.4: duas varreduras ao mesmo tempo não processam o mesmo tenant"` (tarefa falsa que espera uma barreira; as duas chamadas em paralelo; o tenant aparece `processado` em exatamente uma); `"T2.4: com dois tenants, a segunda varredura processa o que a primeira não segurou"`; `"lock é liberado mesmo se a tarefa lança"` (a varredura seguinte processa); `"tenant suspenso não é varrido"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): per-tenant sweep with advisory lock`.

### Task 14: Outbox de push com nova tentativa (T2.4; PD-25, RN-NOT-01)

**Files:** Create `infra/database/municipal/schema/outbox.ts` (+ migration), `infra/database/central/schema/dispositivo-push.ts` (+ migration), `infra/worker/outbox.ts`, `infra/worker/push.ts`, `tests/integration/infra/outbox.test.ts`; Modify `infra/worker/tarefas.ts`; `package.json` (`expo-server-sdk`)

**Interfaces:**
- Produces:
  - `outbox_push(id, paciente_id text, titulo, corpo, dados jsonb, criado_em, tentativas int, proxima_em timestamptz, enviado_em null, falhou_em null, ultimo_erro null)`; central `dispositivo_push(id, paciente_id, token, criado_em, invalido_em null)`.
  - `enfileirarPush(tx, msg: { pacienteId; titulo; corpo; dados? })` — chamado dentro da transação da ação (PD-13).
  - `interface EnviadorPush { enviar(lote: { token: string; titulo: string; corpo: string; dados?: unknown }[]): Promise<({ ok: true } | { ok: false; erro: string; tokenInvalido?: boolean })[]> }`; `EnviadorExpo` (Expo SDK); `PushFalso` (registra as mensagens; falha programável por token ou por chamada).
  - Tarefa `enviarOutbox`: lote com `FOR UPDATE SKIP LOCKED` onde `enviado_em` e `falhou_em` nulos e `proxima_em <= agora`; busca tokens no central; sem token válido → `enviado_em` com `ultimo_erro: "sem_dispositivo"`; falha → `tentativas + 1`, `proxima_em = agora + 1 min × 2^(tentativas − 1)`; na 8ª falha `falhou_em`; `tokenInvalido` marca `invalido_em` no central.
- [ ] **Step 1: Testes** `"T2.4: item da outbox que falha é tentado de novo depois do backoff"` (antes do prazo não reenvia; no prazo reenvia); `"PD-25: 7ª falha ainda agenda; 8ª marca falhou"` (L-004); `"sucesso marca enviado e não reenvia"`; `"paciente sem dispositivo não fica em loop"`; `"token inválido é marcado no central"`; `"duas varreduras não enviam o mesmo item duas vezes"` (dois tenants não; mesmo tenant: o lock já impede, e o `SKIP LOCKED` é testado com dois `enviarOutbox` diretos no mesmo banco); `"RN-NOT-01: enfileirarPush recusa texto com campo clínico"` (a mensagem só aceita título, corpo e dados com chaves permitidas: `tipo`, `sessaoId`, `entradaId`).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): push outbox with retry and backoff`.

### Task 15: Papéis do processo e timer do worker (T2.4; PD-25)

**Files:** Create `infra/worker/papeis.ts`, `tests/integration/infra/papeis.test.ts`; Modify `server.ts`, `infra/env.ts` (`PAPEIS`, padrão `http,worker`; `.env.test`: `http`)

**Interfaces:**
- Produces: `iniciarPapeis(env, deps): { parar(): Promise<void> }` — `http` registra as rotas e escuta; `worker` agenda `executarVarredura` a cada `WORKER_INTERVALO_MS` (padrão 60 000), sem sobrepor uma varredura que ainda roda; `parar` espera a varredura em curso.
- [ ] **Step 1: Testes** `"PD-25: só worker não escuta HTTP e varre"` (intervalo de 50 ms, conta varreduras); `"PD-25: varredura longa não é sobreposta"`; `"PD-25: só http não varre"`; `"parar espera a varredura em curso"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; suíte inteira da API verde (o servidor de teste sobe só `http`). **Step 5:** Commit `feat(api): process roles and the worker timer`.

### Task 16: Serviços (T2.3; RN-ENC-05, specs/modelo configurações)

**Files:** Create `infra/database/municipal/schema/servico.ts` (+ migration), `routes/v1/painel/unidades/_unidadeId/servicos/route.ts`, `routes/v1/painel/servicos/_servicoId/route.ts`, `tests/integration/v1/painel/servicos/{post,get,patch}.test.ts`

**Interfaces:**
- Consumes: `servicoEntradaSchema`, ação de configurar.
- Produces: tabela `servico(id, unidade_id, nome, prefixo, exige_triagem bool, modo, tempo_medio_triagem_min null, tempo_medio_atendimento_min, ativo, ...)`, prefixo único por unidade; `POST/GET` por unidade; `PATCH` de nome, prefixo e tempos (modo e triagem nas Tasks 18 e 19).
- [ ] **Step 1: Testes** `"T2.3: admin cria serviço com prefixo, triagem, modo e tempo médio"`; `"padrões: livre, sem triagem, 15 min"`; `"prefixo repetido na unidade → 409 prefixo_em_uso; em outra unidade pode"`; `"T2.3: admin da unidade 2 não mexe na unidade 1"`; `"recepção não configura serviço → 403"`; `"INV-12: auditoria"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): services per unit`.

### Task 17: Estações (T2.3; RN-EST-01, RN-TRI-02)

**Files:** Create `infra/database/municipal/schema/estacao.ts` (+ migration; `estacao_servico`), `routes/v1/painel/unidades/_unidadeId/estacoes/route.ts`, `routes/v1/painel/estacoes/_estacaoId/route.ts`, `tests/integration/v1/painel/estacoes/{post,patch,delete}.test.ts`

**Interfaces:**
- Produces: tabela `estacao(id, unidade_id, nome, etapa "triagem" | "atendimento", aberta bool default false, chamado_item_id null, ultimo_sinal_em null)` e `estacao_servico`; `POST`, `PATCH`, `DELETE` (arquivar). Regras: serviços da mesma unidade; estação de triagem só com serviços que exigem triagem; estação de atendimento aceita qualquer serviço da unidade; arquivar estação aberta ou com chamado → `409 estacao_ocupada` (RN-EST-05).
- [ ] **Step 1: Testes** `"RN-EST-01: estação ligada a etapa e serviços"`; `"RN-TRI-02: estação de triagem com vários serviços que exigem triagem"`; `"triagem com serviço sem triagem → 400"`; `"serviço de outra unidade → 400"`; `"RN-EST-05: estação com chamado não é arquivada"` (o teste marca `chamado_item_id` direto no banco).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): call stations per unit`.

### Task 18: Sessões no banco e "exige triagem" travado com sessão aberta (T2.3; RN-TRI-01, AD-038)

**Files:** Create `infra/database/municipal/schema/sessao.ts` (+ migration: `sessao`, `sessao_estacao`), `tests/integration/v1/painel/servicos/exige-triagem.test.ts`; Modify `routes/v1/painel/servicos/_servicoId/route.ts`

**Interfaces:**
- Consumes: `podeMudarExigeTriagem`.
- Produces: tabela `sessao(id, servico_id, serie_id null, chave_ocorrencia null, inicio timestamptz, fim timestamptz, vagas int null, visibilidade, dispensa_pre_cadastro, profissional null, estado EstadoSessao default "planejada", editada bool, versao int default 0)`, único `(serie_id, chave_ocorrencia)`; `PATCH /v1/painel/servicos/:id { exigeTriagem }`.
- [ ] **Step 1: Testes** `"T2.3: exige triagem muda com sessões só planejadas"`; `"T2.3: exige triagem não muda com sessão aberta → 409 sessao_aberta"` (sessão `aberta` inserida direto no banco).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): sessions table and triage lock while open`.

### Task 19: Modo do serviço e entradas existentes (T2.3; RN-ENC-07, AD-038, PD-30)

**Files:** Create `infra/database/municipal/schema/entrada.ts` (+ migration), `tests/integration/v1/painel/servicos/modo.test.ts`; Modify `routes/v1/painel/servicos/_servicoId/route.ts`

**Interfaces:**
- Consumes: `mudarModoServico`, `enfileirarPush`.
- Produces: `PATCH /v1/painel/servicos/:id { modo }` aplica as mudanças da regra na mesma transação (estados das entradas, outbox, auditoria com as contagens); resposta `{ servico, entradasConvertidas: number, entradasCanceladas: number }`; bloqueio → `409 servico_regulado` com `dados.entradasAtivas`.
- [ ] **Step 1: Testes** `"T2.3: troca para regulado bloqueada com entradas ativas, mostrando quantas"`; `"T2.3: arquivadas são canceladas com push 'procure sua UBS'"` (linha na outbox, texto sem dado clínico); `"T2.3: livre ↔ requisição não exige foto retroativa"` (requisição → livre: `aguardando_encaminhamento` vira `aguardando`; com vaga segura vira `confirmada` com push); `"INV-12: auditoria com as contagens"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): service booking mode changes`.

### Task 20: Séries e materialização na criação (T2.5; PD-10, PD-26, AD-014)

**Files:** Create `infra/database/municipal/schema/serie.ts` (+ migration), `infra/worker/materializar.ts`, `routes/v1/painel/unidades/_unidadeId/series/route.ts`, `tests/integration/v1/painel/series/post.test.ts`

**Interfaces:**
- Consumes: `expandir`, `ocorrenciasNovas`, `validarSessao`, `serieEntradaSchema`, fuso da unidade.
- Produces:
  - Tabela `serie(id, servico_id, dtstart_local, duracao_min, rrule, exdate text[], rdate text[], vagas, visibilidade, dispensa_pre_cadastro, profissional, estacoes uuid[], ativa bool)`.
  - `materializarSerie(tx, serie, fuso, agora): Promise<number>` (insere `ocorrenciasNovas` em `[agora, agora + 90 dias)` com `ON CONFLICT DO NOTHING`; devolve quantas criou).
  - `POST /v1/painel/unidades/:unidadeId/series` (ação de configurar) cria a série e materializa na mesma transação; `GET` lista séries com a próxima ocorrência.
- [ ] **Step 1: Testes** `"T2.5: série semanal com EXDATE gera as ocorrências certas no fuso da unidade"` (sessões no banco com os instantes UTC esperados e a data excluída ausente); `"T2.5: vagas 0 → 400; vagas 1 aceito"`; `"T2.5: série pública em serviço regulado → 409 servico_regulado"`; `"rrule inválida → 400"`; `"INV-12: auditoria"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): recurring series materialized on creation`.

### Task 21: Sessão avulsa e edição de uma ocorrência (T2.5; AD-011, AD-016)

**Files:** Create `routes/v1/painel/unidades/_unidadeId/sessoes/route.ts`, `routes/v1/painel/sessoes/_sessaoId/route.ts`, `tests/integration/v1/painel/sessoes/{post,patch,get}.test.ts`

**Interfaces:**
- Consumes: `validarSessao`, `sessaoEntradaSchema`.
- Produces: `POST` avulsa (sem série); `GET` por unidade num intervalo de datas; `PATCH /v1/painel/sessoes/:id` muda horário, vagas, profissional e estações só daquela sessão (marca `editada`); `POST /v1/painel/sessoes/:id/cancelar` só para planejada sem entradas não finais (com entradas → `409 sessao_com_pacientes`; o fluxo com remanejamento é a T8.1). Mudança de horário respeita o contrato da sessão (só `planejada`).
- [ ] **Step 1: Testes** `"T2.5: editar uma ocorrência não altera as outras"`; `"T2.5: ocorrência editada não volta ao original numa nova materialização"`; `"AD-016: dispensa em sessão privada → 400"`; `"sessão avulsa pública com vagas"`; `"cancelar planejada vazia; com paciente → 409"`; `"aberta não muda horário → 409 transicao_proibida"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): single sessions and editing one occurrence`.

### Task 22: "Esta e as seguintes" (T2.5; PD-27)

**Files:** Create `routes/v1/painel/series/_serieId/dividir/route.ts`, `tests/integration/v1/painel/series/dividir.test.ts`

**Interfaces:**
- Consumes: `dividirSerie`, `separarMaterializadas`, `materializarSerie`.
- Produces: `POST /v1/painel/series/:serieId/dividir { aPartirDe: chave; mudancas: Partial<config da série> }` → `{ serieNova, sessoesRecriadas, sessoesMantidas }`, numa transação.
- [ ] **Step 1: Testes** `"PD-27: muda vagas desta e das seguintes; as anteriores ficam"`; `"PD-27: sessão seguinte com paciente é mantida e passa à série nova"` (entrada inserida direto); `"PD-27: aberta nunca é apagada"`; `"chave que não é da série → 400"`; `"INV-12: auditoria"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): this-and-following series edits`.

### Task 23: Materialização de 90 dias no worker (T2.5; PD-10, PD-11)

**Files:** Modify `infra/worker/tarefas.ts`, `infra/worker/materializar.ts`; Create `tests/integration/infra/materializar.test.ts`

**Interfaces:**
- Produces: tarefa `materializarSeries` (todas as séries ativas do tenant, com o fuso da unidade de cada uma).
- [ ] **Step 1: Testes** `"PD-10: avançar o relógio 7 dias materializa a nova semana da janela"`; `"PD-10: rodar duas vezes no mesmo minuto não duplica"`; `"PD-10: duas varreduras concorrentes não duplicam"` (dois escritores reais em dois tenants e, no mesmo tenant, `materializarSerie` em duas transações paralelas: o único `(serie_id, chave_ocorrencia)` segura); `"ocorrência cancelada não volta"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): 90-day materialization in the worker`.

### Task 24: Visibilidade da sessão e efeitos de "regulado" em sessões e séries (T2.3, T2.5; RN-PUB-03, RN-ENC-07, AD-038, PD-30)

**Files:** Create `routes/v1/painel/sessoes/_sessaoId/visibilidade/route.ts`, `tests/integration/v1/painel/sessoes/visibilidade.test.ts`, `tests/integration/v1/painel/servicos/modo-sessoes.test.ts`; Modify `routes/v1/painel/servicos/_servicoId/route.ts`

**Interfaces:**
- Consumes: `mudarVisibilidade`.
- Produces: `PUT /v1/painel/sessoes/:id/visibilidade { visibilidade }` (ação de sessão); a troca de modo para `regulado` (Task 19) passa também a tornar privadas as sessões públicas futuras planejadas sem entradas e o padrão das séries do serviço, e devolve `sessoesTornadasPrivadas` e `seriesTornadasPrivadas`.
- [ ] **Step 1: Testes** `"RN-PUB-03: pública vira privada e perde a dispensa; quem já entrou fica"`; `"RN-PUB-03: privada não vira pública em serviço regulado"`; `"T2.5: sessão de serviço regulado não fica pública"`; `"T2.3: troca para regulado torna privadas as sessões públicas futuras vazias e o padrão das séries"`; `"T2.3: sessão pública com inscrito não muda"`; `"INV-12: auditoria"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): session visibility and regulated-mode effects`.

### Task 25: TV — dispositivo, código e estado (T2.6; RN-TV-01, RN-TV-02, PD-29)

**Files:** Create `infra/database/municipal/schema/dispositivo-tv.ts` (+ migration), `routes/v1/tv/dispositivos/route.ts`, `routes/v1/tv/estado/route.ts`, `routes/v1/tv/unidade/route.ts`, `tests/integration/v1/tv/{dispositivos,estado,unidade}.test.ts`

**Interfaces:**
- Consumes: `tvEstadoSchema`, tenant pelo `Host`.
- Produces:
  - Tabela `dispositivo_tv(id, unidade_id null, nome null, token_hash, codigo char(6) null, codigo_expira_em null, pareada_em null, revogada_em null, ultimo_sinal_em null)`; índice único parcial em `codigo` onde `unidade_id` nulo e `revogada_em` nulo.
  - `POST /v1/tv/dispositivos` (público, limite por IP) → `{ token, codigo, expiraEm }`.
  - `GET /v1/tv/estado` (`Authorization: Bearer <token>`) → `tvEstadoSchema`; código vencido é renovado; atualiza `ultimo_sinal_em`; token revogado ou desconhecido → 401.
  - `GET /v1/tv/unidade` → nome da unidade pareada (a fase 3 acrescenta chamadas e contadores); sem pareamento → `403 tv_nao_pareada` sem nada da unidade.
- [ ] **Step 1: Testes** `"RN-TV-01: TV nova recebe código de 6 dígitos e fica aguardando"`; `"PD-29: código vencido é trocado; dentro do prazo é o mesmo"` (L-004: `codigo_expira_em` 1 s no passado e 1 s no futuro); `"RN-TV-02: sem pareamento, nada da unidade"`; `"token de A não vale no Host de B"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): TV device registration and pairing code`.

### Task 26: TV — vincular, listar e revogar no painel (T2.6; RN-TV-01, RN-TV-02, RNF-SEG-02, C22)

**Files:** Create `routes/v1/painel/unidades/_unidadeId/tvs/route.ts`, `routes/v1/painel/tvs/_tvId/route.ts`, `tests/integration/v1/painel/tvs/{post,delete,get}.test.ts`

**Interfaces:**
- Produces: `POST /v1/painel/unidades/:unidadeId/tvs { codigo, nome }` (ação de configurar) vincula; código inexistente, vencido ou já usado → `404 codigo_invalido` (mesma resposta nos três); `GET` lista TVs da unidade com `online` (sinal há menos de 2 min); `DELETE /v1/painel/tvs/:id` revoga.
- [ ] **Step 1: Testes** `"T2.6: admin digita o código e a TV passa a pareada com a unidade"`; `"T2.6: revogar volta a TV para o código"` (estado → 401; a TV registra de novo e recebe código novo); `"T2.6: TV da unidade 1 nunca recebe dados da 2"` (duas unidades, duas TVs; `GET /v1/tv/unidade` de cada uma só traz a sua); `"código vencido → 404 codigo_invalido"`; `"admin da unidade 2 não pareia na 1"`; `"INV-12: auditoria de vincular e revogar"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(api): pair and revoke TVs from the panel`.

### Task 27: Telas do gestor: unidades, regras e usuários (T2.2; PD-31)

**Files:** Create `apps/painel/lib/formularios/{unidade,config,usuario}.ts`, `app/(painel)/painel/{unidades,usuarios}/page.tsx`, `app/(painel)/painel/municipio/page.tsx`, `test/{unidade-form,config-herdada,usuario-form}.test.ts(x)`

**Interfaces:**
- Consumes: `unidadeEntradaSchema`, `configMunicipioSchema`, `usuarioPainelEntradaSchema`, `configEfetiva` (para mostrar a herança), cliente da API.
- Produces: `useFormularioUnidade` (valores, erros por campo vindos do schema ou do `campos` da API, envio); `campoHerdado(efetiva, campo)` → `{ valor, origem, editavel }` (mostra "herdado do município: 5 min"); formulário de usuário com perfis por unidade.
- [ ] **Step 1: Testes** `"erro 400 da API aparece no campo certo"`; `"campo vazio mostra o valor herdado e a origem"`; `"limpar um valor próprio volta a herdar"`; `"perfil de unidade exige escolher a unidade"`; `"409 ultimo_gestor mostra a mensagem"`.
- [ ] **Step 2:** `npm -w @fila-saude/painel run test` → FAIL. **Step 3:** implementar lógica e telas. **Step 4:** PASS; biome. **Step 5:** Commit `feat(painel): manager screens for units, rules and users`.

### Task 28: Telas do admin: serviços e estações (T2.3; PD-31)

**Files:** Create `apps/painel/lib/formularios/{servico,estacao}.ts`, `app/(painel)/painel/{servicos,estacoes}/page.tsx`, `test/{servico-form,estacao-form}.test.ts(x)`

**Interfaces:**
- Produces: formulário de serviço com confirmação da troca de modo (mostra `entradasAtivas` do 409; mostra as contagens convertidas/canceladas/tornadas privadas no sucesso); formulário de estação que só oferece serviços com triagem quando a etapa é triagem.
- [ ] **Step 1: Testes** `"troca para regulado bloqueada mostra quantas entradas"`; `"sucesso mostra o que mudou"`; `"etapa triagem filtra os serviços"`; `"exige triagem travado mostra 'há sessão aberta'"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(painel): services and stations screens`.

### Task 29: Telas do admin: sessões e séries (T2.5; PD-26, PD-27, PD-31)

**Files:** Create `apps/painel/lib/formularios/{sessao,serie}.ts`, `lib/recorrencia-form.ts`, `app/(painel)/painel/sessoes/page.tsx`, `test/{recorrencia-form,sessao-form}.test.ts(x)`

**Interfaces:**
- Consumes: `expandir`, `instanteParaLocal` (domínio), `serieEntradaSchema`, `sessaoEntradaSchema`.
- Produces: `rruleDoFormulario(f: { frequencia: "semanal" | "mensal"; dias: ("MO" | "TU" | …)[]; ate?: string; vezes?: number }): string` e o inverso `formularioDaRrule`; prévia das próximas 5 ocorrências no fuso da unidade (via `expandir`); escolha "só esta" × "esta e as seguintes" ao editar uma sessão de série; dispensa de pré-cadastro some quando a visibilidade é privada e quando o serviço é regulado.
- [ ] **Step 1: Testes** `"rrule ida e volta: terças e quintas até 30/06"`; `"prévia mostra as 5 próximas, sem a data excluída"`; `"privada esconde e desliga a dispensa"`; `"serviço regulado não oferece pública"`; `"editar sessão de série pergunta só esta ou esta e as seguintes"`; `"resposta da divisão mostra quantas sessões com pacientes foram mantidas"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; biome. **Step 5:** Commit `feat(painel): sessions and recurring series screens`.

### Task 30: Página `/tv` e pareamento no painel (T2.6; RN-TV-01, RN-TV-02, PD-29; estados do [design da TV](design-estacao-tv.md))

**Files:** Create `apps/painel/lib/tv.ts`, `app/tv/page.tsx`, `app/(painel)/painel/tvs/page.tsx`, `test/tv.test.ts`, `test/parear-tv.test.tsx`

**Interfaces:**
- Produces:
  - Máquina de estados pura `proximoEstadoTv(estado, evento)`: `iniciando → registrando → aguardando(codigo) → pareada(unidade)`; `401` em qualquer estado → limpa o token e volta a `registrando`; erro de rede → `reconectando` (sem mostrar dado velho) e volta ao estado anterior quando a rede volta.
  - `guardarToken`/`lerToken` com `localStorage` protegido por try/catch (sem armazenamento: registra de novo a cada carga).
  - Tela de pareamento no painel: digitar 6 dígitos, nome da TV; lista com online/offline e "revogar" com confirmação.
- [ ] **Step 1: Testes** `"RN-TV-01: TV sem token registra e mostra o código"`; `"RN-TV-01: estado pareada mostra a unidade"`; `"T2.6: 401 depois de pareada volta ao código"`; `"reconectando não mostra dado antigo"`; `"localStorage indisponível não quebra"`; `"código com 5 ou 7 dígitos não envia"` (L-004); `"404 codigo_invalido mostra 'código inválido ou vencido'"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (layout da TV na fase 3; aqui só código e estados). **Step 4:** PASS; biome. Manual: parear uma aba em `pref-a.localhost:3000/tv` pelo painel e revogar. **Step 5:** Commit `feat(painel): TV pairing page and panel screen`.

---

## Paralelismo

Regra: tudo o que usa o Postgres de teste (5433), a porta 3333 ou as pastas de migrations roda **em sequência**; pacotes sem banco rodam em paralelo, cada um no seu worktree.

| Grupo | Tasks | Pode rodar junto com | Observação |
| --- | --- | --- | --- |
| **Domínio (independente da API)** | 1 → 2 → 3 (recorrência, em sequência: mesmo arquivo); 4; 5 | Todos os outros grupos; pode começar já, em paralelo com a 1B | 4 e 5 tocam arquivos diferentes de 1–3; conflito só em `src/index.ts`, trivial. A Task 5 usa `transicionar` da 1A (já integrado) |
| **Schemas (independente)** | 6 | Todos | Só `packages/schemas`; as rotas consomem depois |
| **Painel, base (independente da API)** | 7 → 8 | Domínio, schemas, API | Só `apps/painel` e `apps/web/package.json`; testes com API falsa |
| **API (sequencial)** | 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 | Domínio, schemas, painel | Mesmo banco de teste, mesma porta e migrations em sequência. Precisa da 1B inteira. 13–15 (worker) dependem só da 1B e podem vir antes de 10–12 se for útil; 19 precisa de 5; 20–23 precisam de 1–3; 24 precisa de 19 e 21 |
| **Painel, telas** | 27, 28, 29, 30 | Entre si (arquivos diferentes; conflito só no menu, trivial) e com a API | Cada uma testa com API falsa; a verificação manual de cada tela espera a rota correspondente (27 ← 10–12, 28 ← 16–19, 29 ← 20–22, 30 ← 25–26) |

Ordem sugerida com três frentes: **frente A** (API) 9 → 26 em sequência; **frente B** domínio 1–5 e schemas 6, depois telas 29 e 30; **frente C** painel 7–8, depois telas 27 e 28.

## Verificação ao fim da fase

- `npm run test:domain`, `npm -w @fila-saude/schemas run test`, `npm -w @fila-saude/api run test`, `npm run test:painel` verdes; `npm run specs:check` sem erros.
- Critérios da [tasks.md](tasks.md): T2.1 (Tasks 8, 9), T2.2 (10–12), T2.3 (17–19, 24), T2.4 (13, 14), T2.5 (1–3, 20–24), T2.6 (25, 26, 30).
- Manual: `npm run dev`; em `pref-a.localhost:3000` o gestor cria unidade e admin; o admin cria serviço, estação e uma série semanal; abre `pref-a.localhost:3000/tv` em outra aba, pareia e revoga.

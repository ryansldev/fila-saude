# Fase 1A — `packages/domain` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `@fila-saude/domain`, as regras puras do Fila Saúde em TypeScript, com os contratos de estado e a matriz de permissões como dados, cobertos por testes escritos antes do código.

**Architecture:** Funções puras sem I/O nem relógio próprio. Ações recebem `(estado, comando, agora)` e devolvem `Resultado` = `{ ok: true, estado, eventos }` ou `{ ok: false, erro }` (PD-13); consultas devolvem só o valor. Transições e permissões vivem como dados (`contratos.ts`, `permissoes.ts`); as ações consultam esses dados, os testes percorrem cada linha e um script gera as tabelas das specs a partir deles (AD-051).

**Tech Stack:** TypeScript (strict, ESM, Node 24), Vitest 4, Biome, npm workspaces + Turbo. Sem dependências de runtime.

**Spec:** regras em [`.specs/specs/`](../../specs/) (glossário, modelo, lista-espera, marcacao, fila-do-dia, chamada, excecoes, contingencia, permissoes), decisões em [`decisions.md`](../../decisions.md), backlog T1.1–T1.6 em [`tasks.md`](tasks.md), casos C1–C45 do protótipo em [`../prototipo/proofs.md`](../prototipo/proofs.md) e testes em `prototype/tests/engine.test.js`.

**Fora deste plano:** multi-tenant, auth, permissões na API e auditoria (T1.7–T1.9) vão no plano 1B; recorrência RFC 5545 é a T2.5; TV, agenda e privacidade do app viram testes de API nas fases 3 e 7; `simulate` não é portado.

## Global Constraints

- **TDD sempre** (constituição): cada passo de código vem depois de um teste rodado e visto falhando pelo motivo certo.
- Pacote `@fila-saude/domain`, `"type": "module"`, `"private": true`, `"license": "AGPL-3.0-only"`; `tsconfig` com as mesmas opções de `apps/api/tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- Nada de `Date.now()`, `Math.random()`, rede ou banco dentro de `src/`. Tempo entra como `agora: number` (epoch ms, UTC). Regras de dia ("véspera", "no dia", "24 h") usam o `fuso` da unidade (IANA, padrão `America/Sao_Paulo`).
- Ações nunca alteram o que recebem (cópia estrutural; teste com `Object.freeze` profundo no estado de entrada).
- Identificadores em português, como nas specs (`chamarProximo`, `Entrada`, `ItemFila`). Cada regra implementada cita o ID no nome do teste (ex.: `"RN-CHAM-03: 3º pulo tira da fila e gera falta"`).
- Valores padrão (§ Configurações de `specs/modelo`): K = 1; tolerância 5 min; "saia de casa" 30 min; QR 30 s; destaque TV 10 s; prazo de confirmação 24 h; tempo médio inicial 15 min; ordem do município `"risco"`; alerta 2 faltas em 90 dias; "ainda precisa?" 30 dias / 7 dias.
- Biome limpo (`npx biome check packages/domain`) e `npm run specs:check` sem erros ao fim de cada task.

## Review Focus

1. **Empate total na ordem** (mesmo risco, prioridade e número impossível; mesmo risco e prioridade com números diferentes): a ordem é sempre determinística pelo número, e na sugestão de alocação pela data de entrada original e depois pelo `id`. Teste na Task 4.
2. **Ninguém elegível ou nenhuma estação aberta:** `chamarProximo` devolve erro `nenhum_elegivel` sem mudar nada; a estimativa mostra "aguardando início" (RN-ETA-02). Testes nas Tasks 6 e 7.
3. **Sair e voltar repetidas vezes** ("Vou sair" → check-in várias vezes, com e sem chamadas no meio): nunca trava a fila nem ultrapassa a janela (C34). Teste na Task 5.
4. **Duas estações chamando no mesmo estado:** a segunda chamada sobre o estado já devolvido pela primeira nunca pega o mesmo paciente (INV-04). Teste na Task 6.
5. **Limites de tempo nos dois lados** (24 h exatas, véspera à meia-noite no fuso da unidade, idade 60/80 no dia do aniversário, abaixo de 2 anos): cada limite tem um teste do lado de dentro e um do lado de fora (L-004). Testes nas Tasks 1, 2 e 8.

---

## Estrutura de arquivos

```
packages/domain/
  package.json · tsconfig.json · vitest.config.ts
  src/
    index.ts            reexporta a API pública
    tipos.ts            entidades do domínio (Entrada, ItemFila, Sessao, Estacao, Config…)
    resultado.ts        Resultado, Evento, CodigoErro, ok(), falha()
    tempo.ts            dias e horas no fuso da unidade, idade em anos
    questionario.ts     classificação 7.3, opções exclusivas
    prioridade.ts       grupos de prioridade legal (AD-025), pessoa atendida (AD-027), conferência e prazo
    contratos.ts        transições como dados + transicionar()
    ordem.ts            RN-ORD e ordem da sugestão (RN-AL-02)
    fila.ts             elegíveis, janela protegida, atraso, check-in com pendência, "Vou sair"
    chamada.ts          chamar, rechamar, finalizar, não compareceu, conferência na chamada, etapas
    estimativa.ts       posição, tempo, "venha agora", "saia de casa", tempo médio
    lista.ts            entrada na lista, sugestão, alocação, confirmação, lista parada
    sessao.ts           abertura, inscrição pública, reserva, vaga segura, balcão, lançamento regulado
    encerramento.ts     encerrar e cancelar sessão: faltas, remanejados, contingência
    qr.ts               token rotativo do QR
    permissoes.ts       matriz como dados + pode()
  test/                 um arquivo por módulo: <modulo>.test.ts; fixtures.ts com construtores de estado
scripts/specs-gen.mjs   gera as tabelas de transição e de permissões nas specs
```

---

### Task 1: Pacote, `Resultado` e questionário (T1.1)

**Files:**
- Create: `packages/domain/{package.json,tsconfig.json,vitest.config.ts}`, `src/{index.ts,tipos.ts,resultado.ts,tempo.ts,questionario.ts}`, `test/{fixtures.ts,questionario.test.ts,tempo.test.ts}`
- Modify: `package.json` raiz (script `"test:domain": "npm -w @fila-saude/domain run test"`)

**Interfaces:**
- Produces:
  - `type Resultado<E> = { ok: true; estado: E; eventos: Evento[] } | { ok: false; erro: CodigoErro }`, `ok<E>(estado: E, eventos?: Evento[])`, `falha(erro: CodigoErro)`.
  - `type CodigoErro = "transicao_proibida" | "sem_vaga" | "duplicada" | "emergencia" | "servico_regulado" | "sessao_fechada" | "nenhum_elegivel" | "estacao_ocupada" | "estacao_com_chamado" | "qr_invalido" | "requisicao_pendente" | "sem_permissao" | "fora_do_prazo"`.
  - `type Evento = { tipo: TipoEvento; entradaId?: string; itemId?: string; estacaoId?: string; sessaoId?: string; motivo?: string; dados?: Record<string, unknown> }` com `TipoEvento` = `"entrada_criada" | "alocada" | "confirmada" | "recusada" | "vaga_liberada" | "inscrita" | "na_reserva" | "lancada" | "removida" | "senha_emitida" | "presente" | "pendencia" | "pendencia_resolvida" | "nao_conferiu" | "prioridade_retirada" | "saiu" | "chamado" | "rechamado" | "atendido" | "pulado" | "saiu_da_fila" | "falta" | "falta_apagada" | "remanejado" | "saia_de_casa" | "venha_agora" | "alerta_agendador" | "lista_ligacao" | "arquivada" | "reativada" | "cancelada"`.
  - `tipos.ts`: `NivelRisco = "emergencia" | "urgente" | "atencao" | "rotina"`; `Respostas = { alarmes: Alarme[]; motivo: "novo" | "acompanhamento" | "exame" | "receita"; gravidade: "leve" | "moderado" | "forte" | null; condicoes: Condicao[]; grupos: GrupoDeclarado[] }`; `Classificacao = { nivel: NivelRisco; regra: string; apoio: boolean }`.
  - `classificar(respostas: Respostas, idadeAnos: number): Classificacao`, `alternarOpcao(marcadas: string[], opcao: string, exclusiva: string): string[]`.
  - `idadeEm(nascimento: string /* AAAA-MM-DD */, agora: number, fuso: string): number`; `mesmoDia(a: number, b: number, fuso: string): boolean`; `vespera(sessaoInicio: number, fuso: string): number` (00:00 do dia anterior no fuso).

- [ ] **Step 1: Criar o pacote vazio e um teste que importa `classificar`**
  `package.json` com scripts `test: "vitest run"`, `test:watch`, `check-types: "tsc --noEmit"`; devDependencies `typescript`, `vitest` (mesmas versões da API). Teste `test/questionario.test.ts` portando `"classify: alarm sign is emergency"`, `"classify: self-harm is urgent with support"` e `"classify: urgent, attention and routine rules"` do protótipo, com as regras da tabela de `specs/lista-espera` (emergência por item da Tela 1 exceto autolesão; autolesão → `{ nivel: "urgente", apoio: true }`; urgente = problema novo forte, ou gestante com novo moderado; atenção = novo moderado, novo com condição, novo com idade < 2 ou ≥ 60, gestante com novo leve; senão rotina).
- [ ] **Step 2:** `npm -w @fila-saude/domain run test` → FAIL (`classificar` não existe).
- [ ] **Step 3:** Implementar `resultado.ts`, `tipos.ts` (só o que os testes usam) e `classificar` em `questionario.ts`, primeira regra que bate de cima para baixo.
- [ ] **Step 4:** Testes de limite: idade 1 ano e 364 dias (atenção) × 2 anos exatos (rotina); 59 × 60 anos no dia do aniversário, no fuso `America/Sao_Paulo` (`tempo.test.ts` cobre `idadeEm` e `vespera` com sessão às 00:30 e às 23:30). Porta `"quiz: none option is exclusive"` para `alternarOpcao`. Rodar → FAIL; implementar `tempo.ts` e `alternarOpcao`; rodar → PASS.
- [ ] **Step 5:** `npx biome check packages/domain` limpo; commit `feat(domain): add package, Resultado and risk questionnaire`.

### Task 2: Prioridade legal (T1.1, AD-023..025, AD-027)

**Files:** Create `src/prioridade.ts`, `test/prioridade.test.ts`

**Interfaces:**
- Consumes: `idadeEm`, `Respostas`.
- Produces:
  - `type Grupo = "idoso" | "idoso80" | "gestante" | "lactante" | "colo" | "pcd" | "tea" | "mobilidade" | "doador" | "obesidade"`; `GRUPOS: Record<Grupo, { conferencia: "visual" | "documento" | "nascimento" | "a_definir"; expiraEmDias: number | null }>` (idoso/idoso80: `nascimento`, sem prazo; gestante e colo: `visual`, prazo `a_definir` → `null` com TODO de D5 no comentário; pcd e tea: `documento`; lactante, mobilidade, doador, obesidade: `a_definir`).
  - `type PrioridadeLegal = { grupos: Grupo[]; conferida: boolean; conferidaEm: number | null }`.
  - `prioridadeDaPessoa(pessoa: { nascimento: string }, declarados: Grupo[], agora: number, fuso: string): Grupo[]` (idoso/idoso80 pela idade; criança de colo atendida mantém `colo`; nada do acompanhante).
  - `temPrioridade(p: PrioridadeLegal): boolean` (declarada vale até conferência, AD-024/050); `rankPrioridade(p: PrioridadeLegal): 0 | 1 | 2` (2 = 80+, 1 = qualquer outro grupo, 0 = nenhum).
  - `expirada(p: PrioridadeLegal, agora: number): boolean`.
- [ ] **Step 1: Testes** `"RN-RISCO-04: idoso vem da data de nascimento, 80+ acima dos demais"`, `"RN-RISCO-04: entre grupos diferentes não há hierarquia"` (gestante e PcD empatam com rank 1), `"AD-027: prioridade do acompanhante não passa ao atendido"`, `"AD-027: criança de colo atendida mantém colo"`, `"AD-025: mobilidade reduzida e doador de sangue estão na lista"`, limites 59/60 e 79/80 no aniversário.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar `prioridade.ts`.
- [ ] **Step 4:** Rodar → PASS; biome.
- [ ] **Step 5:** Commit `feat(domain): legal priority groups`.

### Task 3: Contratos de estado como dados (núcleo executável, AD-051)

**Files:** Create `src/contratos.ts`, `test/contratos.test.ts`

**Interfaces:**
- Produces:
  - `type EstadoEntrada = "aguardando_encaminhamento" | "aguardando" | "alocada" | "confirmada" | "na_reserva" | "na_fila" | "remanejada" | "arquivada" | "concluida" | "cancelada" | "encerrada_sem_atendimento"`.
  - `type EstadoItem = "remoto" | "presente" | "chamado" | "atendido_na_etapa" | "saiu_da_fila" | "remanejado"` (pendência é campo do item, não estado).
  - `type EstadoSessao = "planejada" | "aberta" | "cancelada" | "encerrada"`.
  - `type Transicao<S extends string> = { de: S | "—"; evento: string; para: S | "(mesmo)" | "(não cria)"; condicao: string; efeitos: string; regra: string; spec: "lista-espera" | "marcacao" | "excecoes" | "fila-do-dia" | "chamada" | "contingencia" }`.
  - `TRANSICOES_ENTRADA: Transicao<EstadoEntrada>[]`, `TRANSICOES_ITEM: Transicao<EstadoItem>[]`, `TRANSICOES_SESSAO: Transicao<EstadoSessao>[]` — uma linha por linha das tabelas "Transições" das specs, com os textos copiados delas.
  - `transicionar<S extends string>(tabela: Transicao<S>[], de: S, evento: string): S | "(mesmo)" | null` (null = proibida).
- [ ] **Step 1: Testes** `"contratos: toda linha das specs está nos dados"` (lê os arquivos `.specs/specs/*/spec.md`, extrai as linhas das tabelas de transição e compara com os dados — o mesmo conjunto de `(de, evento, para)`); `"contratos: transição não listada é proibida"` (ex.: `concluida` + `"Paciente cancela"` → `null`); `"contratos: estados finais não têm saída, exceto a reversão da contingência"`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Escrever os dados a partir das tabelas e `transicionar`. Linhas com "A ou B" na coluna "De" viram uma linha por estado.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat(domain): state contracts as data`.

### Task 4: Ordem (T1.2, RN-ORD, RN-AL-02, AD-004)

**Files:** Create `src/ordem.ts`, `test/ordem.test.ts`

**Interfaces:**
- Consumes: `rankPrioridade`, `temPrioridade`.
- Produces:
  - `type ChaveOrdem = { urgenciaConfirmada: boolean; risco: Exclude<NivelRisco, "emergencia">; prioridade: PrioridadeLegal; numero: number }`.
  - `compararOrdem(a: ChaveOrdem, b: ChaveOrdem, ordemMunicipio: "risco" | "prioridade"): number`.
  - `type ChaveSugestao = { urgenciaConfirmada: boolean; remanejada: boolean; risco: …; prioridade: PrioridadeLegal; dataEntradaOriginal: number; id: string }`; `compararSugestao(a, b, ordemMunicipio): number`.
- [ ] **Step 1: Testes** portando `"priority: municipal rule switches legal before risk"`; `"RN-ORD: urgência confirmada sempre primeiro"`; `"RN-AL-02: urgência, remanejados, depois risco e prioridade, depois data"`; Review Focus 1: empates resolvem por `numero` e, na sugestão, por `dataEntradaOriginal` e depois `id`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `feat(domain): call order and suggestion order`.

### Task 5: Fila do dia — presença, pendência, janela e atraso (T1.2, RN-FILA-05, RN-PRES, AD-010, AD-033, AD-050)

**Files:** Create `src/fila.ts`, `test/fila.test.ts`

**Interfaces:**
- Consumes: `compararOrdem`, `TRANSICOES_ITEM`, `transicionar`.
- Produces:
  - `type Pendencia = "conta" | "pessoa_atendida" | "pre_cadastro" | "prioridade"`.
  - `type ItemFila = { id: string; entradaId: string; senha: string; numero: number; etapa: "triagem" | "atendimento"; estado: EstadoItem; pendencias: Pendencia[]; urgenciaConfirmada: boolean; risco: …; prioridade: PrioridadeLegal; pulos: number; travadoAtras: string[]; saiuEm: number | null; atendidoEmEtapas: ("triagem" | "atendimento")[] }`.
  - `type DiaSessao = { sessaoId: string; estado: EstadoSessao; itens: ItemFila[]; chamadas: { itemId: string; etapa: …; em: number }[]; estacoes: Estacao[]; config: ConfigUnidade; contingencias: { inicio: number; fim: number }[]; proximoNumero: number }` e `Estacao = { id: string; etapa: …; servicos: string[]; aberta: boolean; chamadoItemId: string | null }`.
  - `elegiveis(dia: DiaSessao, estacaoId: string): ItemFila[]` (ordenados, já com a janela protegida).
  - `checkIn(dia, cmd: { itemId: string; pendencias: Pendencia[] }, agora): Resultado<DiaSessao>`; `marcarPresencaSemApp(dia, { itemId }, agora)`; `vouSair(dia, { itemId }, agora)`; `conferirNaRecepcao(dia, { itemId; resultado: "confere" | "nao_confere" | "prioridade_nao_confere" }, agora)`.
- [ ] **Step 1: Testes** portando `"order: RN-ORD-01 protected window"`, `"order: RN-ORD-03 consecutive check-ins"`, `"order: RN-ORD-04 late arrival"`, `"order: confirmed urgency jumps window"`, `"order: leaving and coming back never deadlocks"`, `"order: coming back loses the turn only if it passed in the order"`, `"leave: calls made while present do not cost the turn on return"`; novos: `"RN-FILA-05: check-in com pendência fica presente e elegível"` (evento `pendencia`), `"RN-FILA-05: recepção recusa identidade → saiu_da_fila sem falta"`, `"RN-FILA-05: prioridade não conferida é retirada e o item volta ao lugar sem ela"`, `"RN-CONT-03: chamadas no período de contingência não contam para o atraso de quem estava remoto"`; Review Focus 3: 5 ciclos "Vou sair"/check-in intercalados com chamadas nunca deixam `elegiveis` vazio quando há presentes.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (janela e atraso exatamente como o pseudocódigo de `specs/fila-do-dia`). **Step 4:** PASS. **Step 5:** commit `feat(domain): presence, pending checks, window and lateness`.

### Task 6: Chamada (T1.3, RN-CHAM-01..04, RN-TRI, AD-006, AD-021, AD-039, AD-050)

**Files:** Create `src/chamada.ts`, `test/chamada.test.ts`

**Interfaces:**
- Consumes: `elegiveis`, `DiaSessao`, `transicionar`.
- Produces: `chamarProximo(dia, { estacaoId }, agora)`, `rechamar(dia, { estacaoId }, agora)`, `finalizar(dia, { estacaoId }, agora)`, `naoCompareceu(dia, { estacaoId }, agora)`, `conferirNaChamada(dia, { estacaoId; resultado: "confere" | "nao_confere" | "prioridade_nao_confere" }, agora)`, `fecharEstacao(dia, { estacaoId })` — todas `Resultado<DiaSessao>`; `toleranciaEsgotada(dia, estacaoId, agora): boolean`.
- [ ] **Step 1: Testes** portando `"call: next closes previous and skips remote"`, `"call: three skips"`, `"call: tolerance never skips on its own"`, `"clock: advancing re-evaluates tolerance"`, `"station: cannot close while someone is called"`, `"station: a call from another session is not dropped"`, `"triage: two stages with the same ticket"`; novos: `"RN-CHAM-04: pendência mostrada e resolvida ao conferir"`, `"RN-CHAM-04: não conferiu tira da fila sem falta"`, `"RN-CHAM-04: prioridade não conferida volta ao lugar sem contar pulo"`, `"RN-CHAM-03: 3 pulos somam as etapas"`; Review Focus 2: sem elegível → `falha("nenhum_elegivel")`; Review Focus 4: duas `chamarProximo` de estações diferentes em sequência sobre o mesmo serviço chamam pacientes diferentes.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `feat(domain): calling, skips and call-time checks`.

### Task 7: Estimativa (T1.4, RN-ETA-01..05, AD-002, AD-003, AD-009, AD-043)

**Files:** Create `src/estimativa.ts`, `test/estimativa.test.ts`

**Interfaces:**
- Consumes: `DiaSessao`, `compararOrdem`, `elegiveis`.
- Produces: `type Estimativa = { tipo: "posicao"; posicao: number; minutos: number; consulta?: { minutos: number } } | { tipo: "venha_agora" } | { tipo: "aguardando_inicio" } | { tipo: "modo_manual" }`; `estimar(dia, itemId, agora, opcoes: { modoManual: boolean }): Estimativa`; `tempoMedio(dia, etapa, servicoId, agora): number`; `avisosSaiaDeCasa(dia, agora, opcoes: { modoManual: boolean }): Evento[]` (um por item e etapa; nenhum em modo manual).
- [ ] **Step 1: Testes** portando `"queue: eta and position"`, `"eta: present patient sees real call order"`, `"eta: remote first sees come now"`, `"queue: leave home notice once"`, `"triage: eta sums both stages"`, `"triage: leave home notice per stage"`; novos: `"RN-ETA-05: média dos últimos 10 sem os fora da curva; menos de 3 usa o inicial"`, `"RN-ETA-02: sem estação aberta → aguardando início"`, `"RN-SES-05: modo manual não avisa e não estima"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `feat(domain): estimates and leave-home notices`.

### Task 8: Lista de espera, alocação e confirmação (T1.5, RN-LE, RN-AL, RN-CONF, RN-PARADA, AD-018, AD-032)

**Files:** Create `src/lista.ts`, `test/lista.test.ts`

**Interfaces:**
- Consumes: `classificar`, `compararSugestao`, `TRANSICOES_ENTRADA`.
- Produces:
  - `type Entrada = { id: string; servicoId: string; responsavelId: string | null; pessoa: { nome: string; nascimento: string; cpf: string | null }; estado: EstadoEntrada; dataEntradaOriginal: number; classificacao: Classificacao; riscoConfirmado: NivelRisco | null; prioridade: PrioridadeLegal; remanejada: null | "privada" | "publica" | "regulada"; recusas: number; sessaoId: string | null; alocadaEm: number | null; perguntadoEm: number | null }`.
  - `type Servico = { id: string; modo: "livre" | "requisicao" | "regulado"; exigeTriagem: boolean }`; `type SessaoVagas = { id: string; servicoId: string; visibilidade: "publica" | "privada"; vagas: number | null; inicio: number; ocupadas: number }`.
  - `criarEntrada(entradasAtivas: Entrada[], cmd: { servico: Servico; pessoa; responsavelId; respostas: Respostas; id: string }, agora): Resultado<Entrada>` (erros `emergencia`, `duplicada` por CPF ou nome + nascimento, `servico_regulado`).
  - `sugerir(entradas: Entrada[], sessao: SessaoVagas, config): { entradaId: string; motivos: string[] }[]`.
  - `alocar(entrada, sessao, cmd: { riscoConfirmado?: NivelRisco }, agora): Resultado<{ entrada: Entrada; sessao: SessaoVagas }>` (`sem_vaga` se `ocupadas >= vagas`; véspera no fuso).
  - `confirmar`, `recusar` (`Resultado<…>`), `prazoConfirmacao(entrada, sessao, config): number` (min(alocadaEm + 24 h, inicio)); `pendentesNaAbertura(entradas, sessao): Evento[]`; `perguntarAindaPrecisa`, `arquivar`, `reativar` (até 30 dias).
- [ ] **Step 1: Testes** portando `"waitlist: one active entry per service"`, `"allocation: suggestion order and reasons"`, `"allocation: never exceeds slots"`, `"allocation: refusal keeps original date"`, `"calllist: pending allocation highlighted after 24 h"`, `"calllist: deadline is the session start when it comes before 24 h"`; novos: `"RN-LE-01: serviço regulado recusa entrada pelo app"`, `"RN-LE-05: duplicidade pela pessoa atendida (CPF ou nome + nascimento)"`, `"RN-CONF-04: alocação pendente na abertura volta à lista com a data original"`, `"RN-PARADA: 7 dias sem resposta arquiva; reativa até 30 dias"`; Review Focus 5: prazo de 24 h exatas (dentro e fora), alocação na véspera às 23:59 e às 00:00 do dia da sessão no fuso.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (cada mudança de estado passa por `transicionar`; `null` → `falha("transicao_proibida")`). **Step 4:** PASS. **Step 5:** commit `feat(domain): waitlist, allocation and confirmation`.

### Task 9: Sessão do dia — abertura e formas de entrar (T1.6, RN-FILA-01..04, RN-PUB, RN-ENC-04/06, AD-013, AD-015, AD-037, AD-046..049)

**Files:** Create `src/sessao.ts`, `test/sessao.test.ts`

**Interfaces:**
- Consumes: `Entrada`, `DiaSessao`, `ItemFila`, `transicionar`.
- Produces: `abrir(dia, entradasConfirmadas: Entrada[], agora): Resultado<DiaSessao>` (números pela data de entrada original ou hora da inscrição); `inscreverPublica(sessao: SessaoVagas, entrada, cmd: { fotoAceita: boolean }, agora)` (confirmada, vaga segura ou reserva); `liberarVaga(…)` (primeiro da reserva; sem foto com sessão aberta passa ao próximo); `trocarReserva(…)`; `incluirNoBalcao(dia, cmd: { servico: Servico; … }, agora)` (`servico_regulado` se regulado); `lancarRegulado(sessao, dia | null, cmd: { cpf; contaVerificada: boolean; riscoDaRegulacao?: NivelRisco }, agora)` (confirmada ou direto na fila; evento `lancada` só com push se conta verificada); `removerLancamento(…)`.
- [ ] **Step 1: Testes** portando `"queue: open numbers by original date"`, `"queue: front desk entry is present"`, `"public: patient enrolls without the scheduler and is confirmed"`, `"public: private session, emergency, duplicate and full are refused"`, `"public: day order follows enrollment time, with priority on top"`, `"public: enrolling on the day of an open session enters the queue"`, `"public: referral service reserves the slot until the referral is accepted"`; novos: `"RN-PUB-02: lotada vai para a reserva; vaga liberada vai ao primeiro"`, `"RN-PUB-02: troca de reserva por vaga cancela a reserva"`, `"RN-ENC-04: vaga segura sem aceite é liberada na abertura"`, `"RN-ENC-06: lançamento entra confirmado; com sessão aberta, direto na fila"`, `"RN-ENC-06: conta não verificada é tratada como sem app"`, `"RN-ENC-05: balcão recusado em serviço regulado"`, `"INV-02: nenhum caminho passa das vagas"`, `"INV-05: senha única na sessão, inclusive para quem entra depois da abertura"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `feat(domain): session opening and ways to enter`.

### Task 10: Encerramento, cancelamento, faltas e remanejados (RN-SES-01..04, RN-FALTA, RN-REM, RN-CONT-03, AD-031, AD-033, AD-040, AD-041, AD-045)

**Files:** Create `src/encerramento.ts`, `test/encerramento.test.ts`

**Interfaces:**
- Consumes: `DiaSessao`, `Entrada`, `transicionar`.
- Produces: `encerrar(dia, agora, opcoes: { semSinalSemContingencia: boolean }): Resultado<DiaSessao> & { aviso?: "sinal_perdido" }`; `cancelar(dia, entradas: Entrada[], agora): Resultado<{ dia; entradas }>`; `registrarContingencia(dia, entradas, periodo: { inicio; fim; motivo }, agora): Resultado<…>` (apaga faltas do período registradas no mesmo dia); `titularDaFalta(entrada, conferida: boolean, responsavelVerificado: boolean, lancada: boolean): "pessoa" | "responsavel" | "ninguem"`; `outraData(entrada, agora)`, `desistir(entrada, agora)`, `escolherData(entrada, sessao, …)` para remanejado.
- [ ] **Step 1: Testes** `"RN-SES-02: vez não passou → remanejado"`, `"RN-SES-02: presente nunca leva falta"`, `"RN-SES-02: remoto com a vez passada leva falta"`, `"AD-041: triado que saiu é remanejado, não faltoso"`, `"RN-SES-03: não encerra com estação chamando"`, `"RN-SES-04: avisa sinal perdido sem bloquear"`, `"RN-CONT-03: contingência registrada depois do encerramento apaga a falta e remaneja"`, `"RN-ID-06/AD-040: titular da falta"` (tabela com os 4 casos), `"RN-REM-03: outra data 1ª mantém, 2ª perde a preferência por origem"`, `"RN-REM-05: remanejado de pública escolhe; lotada → topo da reserva"`, `"cancelar: reserva é cancelada, não remanejada"`, `"INV-10: remanejado nunca tira a vaga de quem já está confirmado"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `feat(domain): closing, cancelling, no-shows and rescheduling`.

### Task 11: QR rotativo (RN-PRES-01, RNF-SEG-01)

**Files:** Create `src/qr.ts`, `test/qr.test.ts`

**Interfaces:**
- Produces: `tokenQr(segredo: string, agora: number, intervaloMs = 30_000): Promise<string>` (HMAC-SHA-256 de `floor(agora / intervalo)` via `globalThis.crypto.subtle`, base64url, 16 caracteres); `validarQr(segredos: string[] /* sessões abertas da unidade */, token: string, agora: number, intervaloMs = 30_000): Promise<number | null>` (índice da sessão; aceita a janela atual e a anterior).
- [ ] **Step 1: Testes** portando `"queue: qr current and previous only"` e `"qr: any open session of the same unit accepts the TV code"`; limite: token da janela −2 recusado; token de outra unidade recusado.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `feat(domain): rotating QR token`.

### Task 12: Permissões como dados (RN-PERF, matriz de `specs/permissoes`)

**Files:** Create `src/permissoes.ts`, `test/permissoes.test.ts`

**Interfaces:**
- Produces: `type Perfil = "paciente" | "gestor" | "admin" | "agendador" | "recepcao" | "triagem" | "profissional"`; `type Acao` = uma constante por linha da matriz (ex.: `"lancar_regulado"`, `"anular_falta"`, `"conferir_na_chamada"`…); `MATRIZ: { acao: Acao; texto: string; perfis: Partial<Record<Perfil, true | string>> }[]` (string = ressalva da célula, ex.: `"na chamada"`); `pode(perfis: Perfil[], acao: Acao): boolean`.
- [ ] **Step 1: Testes** `"permissoes: toda linha da matriz da spec está nos dados"` (lê `specs/permissoes/spec.md` e compara textos e células); `"permissoes: recepção não dá prioridade a quem já está na fila"` (ação `dar_prioridade` exige contexto; testar `pode` + regra em `prioridade.ts`); `"permissoes: perfil acumulado soma permissões"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `feat(domain): permission matrix as data`.

### Task 13: Tabelas das specs geradas a partir dos dados (AD-051)

**Files:** Create `scripts/specs-gen.mjs`; Modify `package.json` raiz (`"specs:gen"`), `scripts/specs-check.mjs` (falha se as tabelas geradas estiverem desatualizadas), `.specs/specs/*/spec.md` (tabelas de transição e matriz entre marcadores `<!-- gerado: contratos:<spec> -->` … `<!-- /gerado -->`), `.specs/constitution.md` (processo, item 5: as tabelas são geradas; editar em `contratos.ts`/`permissoes.ts`)

**Interfaces:**
- Consumes: `TRANSICOES_*` e `MATRIZ` (importados do build de `packages/domain` via `tsx` ou pelo `dist`).
- [ ] **Step 1: Teste** em `test/specs-gen.test.ts`: `"gerar e depois checar não muda nada"` (gera para um diretório temporário a partir de uma cópia de `.specs/specs`, roda a verificação e espera zero diferenças).
- [ ] **Step 2:** FAIL. **Step 3:** implementar o gerador; trocar as tabelas manuais pelos marcadores e rodar `npm run specs:gen`. **Step 4:** `npm run specs:check` e o teste → PASS; o teste da Task 3 continua verde. **Step 5:** Commit `feat(specs): generate state and permission tables from domain data`.

---

## Testes do protótipo que não entram neste plano

`agenda: unit shows future sessions…`, `tv: pairing…`, `tv: shows only tickets…`, `tv: shows only its own unit`, `privacy: patient view…`, `patient view: the active ticket wins…` → testes de API nas fases 3 e 7. `flow: admin creates a public or private session`, `triage: admin enables triage and creates a station` → T2.3/T2.5. `presence: time at the unit is tracked` → T8.8 (eventos de fila). `waitlist: referral gates allocation` → T5.2 (requisição pelo app, AD-026). `simulate: …` → não portado.

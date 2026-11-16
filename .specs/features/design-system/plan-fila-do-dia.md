# Fila do dia (unidade inteira, com busca) — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a Fila do dia mostra a unidade inteira numa fila só, com busca, pílulas por serviço e o tempo de espera em cada linha.

**Architecture:** o domínio passa a guardar `presenteDesde` no item. A API ganha `GET /v1/painel/unidades/:unidadeId/fila-de-hoje`, que junta as sessões de hoje e as pessoas numa resposta. O painel ganha dois componentes no kit (`Filtros`, `Busca`), funções puras em `lib/fila.ts`, e a página é reescrita sobre eles.

**Tech Stack:** TypeScript, domínio puro (Vitest), Fastify + Drizzle (API), Next 16 + Tailwind (painel).

**Spec:** [fila-do-dia.md](fila-do-dia.md) (e o design system em [design.md](design.md))

## Global Constraints

- TDD em toda task; modo rápido da v0.1, sem revisão por task.
- Nada de "Info · Info · Info" em seletor; escolha com várias informações = pílula/cartão com ícone, selo e número com rótulo.
- Botões do kit; nenhum `<button>` fora de `apps/painel/components/ui/` (a trava `test/design-system.test.ts` continua valendo).
- Consulta da fila a cada 3 s (PD-33).
- CPF nunca inteiro no painel: a API manda o mascarado `•••.982.247-••` (função `cpfMascarado` em `apps/api/infra/fila/painel.ts`).
- "Todas" é o filtro padrão; filtro lembrado no navegador (`localStorage`, chave `fila-painel:filtro-da-fila`, com try/catch como `fila-painel:estacao`).
- Textos do painel em frase normal.
- Testes da API pedem o Docker Desktop no ar (`systemctl --user start docker-desktop`).

## Review Focus

1. **Duas pessoas com o mesmo nome em serviços diferentes** (Ana em Curativos e no Clínico): a busca mostra as duas, cada uma com o seu serviço. → teste em Task 3 (`buscarNaFila` devolve as duas).
2. **Senha digitada sem hífen ou em minúsculas** ("c002"): acha "C-002". → teste em Task 3.
3. **Filtro guardado de uma sessão que não existe mais** (outro dia, outra unidade): volta para "Todas", sem tela vazia. → teste em Task 3 (`filtroValido`).
4. **Dia gravado antes do campo novo** (item sem `presenteDesde`): a linha sai sem tempo, sem "NaN". → teste em Task 3 (`contextoDaLinha` com `desde: null`).
5. **Nenhuma sessão hoje / ninguém na fila**: "Nenhuma sessão hoje nesta unidade." e, com sessões, "Ninguém na fila ainda." → Task 5, Step 4 (estados vazios) e conferido no print.

---

### Task 1: Domínio — `presenteDesde` no item da fila

**Files:**
- Modify: `packages/domain/src/fila.ts` (tipo `ItemFila`; `ficarElegivel` em `fila.ts:203`; `vouSair` em `fila.ts:~370`)
- Modify: `packages/domain/src/sessao.ts` (`porNaFila`, `sessao.ts:~105`)
- Modify: `packages/domain/src/chamada.ts` (passagem da triagem ao atendimento em `encerrarChamado`, `chamada.ts:~101-114`; `naoCompareceu` quando vai a remoto, `chamada.ts:~229`)
- Test: `packages/domain/test/fila.test.ts`, `packages/domain/test/chamada.test.ts`

**Interfaces:**
- Produces: `ItemFila.presenteDesde?: number | null` — opcional para os dias antigos em jsonb; `undefined` vale `null`.

- [ ] **Step 1: Testes vermelhos** (fixtures de `test/fixtures.ts`):
  - `fila.test.ts` › "presenteDesde: marca a hora em que ficou presente e some ao voltar a remoto": `checkIn` em `agora = T` → item com `presenteDesde: T`; `vouSair` em `T + 60_000` → `presenteDesde: null`; `marcarPresencaSemApp` em `T2` → `presenteDesde: T2`.
  - `fila.test.ts` › "porNaFila: quem entra presente (balcão) já começa a contar": item criado com estado `presente` em `T` → `presenteDesde: T`; criado `remoto` → `null`.
  - `chamada.test.ts` › "da triagem ao atendimento a espera recomeça": finalizar a triagem em `T` → o item, agora `presente` na etapa `atendimento`, tem `presenteDesde: T`.
  - `chamada.test.ts` › "pulado que vai a remoto perde o presenteDesde; o 1º pulo (fica presente) recomeça a contar".
- [ ] **Step 2:** `npm run test:domain` → FAIL nesses quatro.
- [ ] **Step 3:** implementar: em `ficarElegivel`, `presenteDesde: agora`; em `vouSair` e no ramo remoto de `naoCompareceu`, `presenteDesde: null`; em `porNaFila`, `estado === "presente" ? agora : null`; no item triado de `encerrarChamado`, `presenteDesde: agora`.
- [ ] **Step 4:** `npm run test:domain` → PASS (346 + 4).
- [ ] **Step 5: Commit** `feat(domain): queue item remembers since when the person is present`.

### Task 2: API — `GET /v1/painel/unidades/:unidadeId/fila-de-hoje`

**Files:**
- Modify: `packages/schemas/fila.ts` (`filaDeHojeSchema`, `FilaDeHoje`)
- Modify: `apps/api/infra/fila/painel.ts` (`filaDeHoje`)
- Create: `apps/api/routes/v1/painel/unidades/_unidadeId/fila-de-hoje/route.ts`
- Test: `apps/api/tests/integration/v1/painel/fila/fila-de-hoje.test.ts`

**Interfaces:**
- Consumes: `presenteDesde` (Task 1); `hojeNaUnidade`, `daEquipeDaUnidade`, `paraFila` (já em `infra/fila/painel.ts`).
- Produces:
  - `filaDeHojeSchema = { agora: iso, sessoes: SessaoDeHoje[], itens: ItemDeHoje[] }`.
  - `SessaoDeHoje = { id, servico: { id, nome }, inicio: iso, fim: iso, estado, vagas: number | null, ocupadas, reserva, contagens: { naFila, naUnidade, aCaminho, chamados, atendidos } }` — `naFila` = remoto + presente + chamado.
  - `ItemDeHoje = ItemDaFila & { sessaoId: uuid; servico: string; desde: iso | null; estacao: string | null }` — `desde` = hora da última chamada se `chamado`, `presenteDesde` se `presente`, senão `null`; `estacao` = nome da estação do chamado.
  - `filaDeHoje(ctx: ContextoDaAcao, unidadeId: string): Promise<FilaDeHoje>` — sessões de hoje como em `hojeNaUnidade`; para planejada, `itens` vazio e contagens zero (`ocupadas` continua dizendo os inscritos).

- [ ] **Step 1: Teste vermelho** em `fila-de-hoje.test.ts` (cenário como `tests/fila.ts`: `cenarioDaFila()` + uma segunda sessão de outro serviço hoje):
  - `enfermeiro` da unidade → 200; usuário de outra unidade → 403.
  - com as duas sessões abertas, inscritos nas duas e uma presença marcada: `sessoes` tem as duas com `contagens` certas; `itens` traz pessoas das duas, cada uma com `sessaoId` e `servico`.
  - o item presente tem `desde` ISO; o remoto tem `desde: null`; depois de `chamar` na estação, o chamado tem `desde` e `estacao: "Sala 1"`.
  - `itens[*].documento.cpf` continua mascarado (`/^•••\.\d{3}\.\d{3}-••$/`).
- [ ] **Step 2:** `cd apps/api && VITEST_ARGS="tests/integration/v1/painel/fila/fila-de-hoje.test.ts" npm test` → FAIL (404).
- [ ] **Step 3:** schema, `filaDeHoje` e a rota (GET, `contextoDoPainel`, `validar(filaDeHojeSchema, …)`), no padrão de `routes/v1/painel/sessoes/_sessaoId/fila/route.ts`.
- [ ] **Step 4:** o mesmo comando → PASS; `npm test` inteiro em `apps/api` → PASS.
- [ ] **Step 5: Commit** `feat(api): the day's queue for the whole unit in one call`.

### Task 3: Painel — funções puras da fila da unidade

**Files:**
- Modify: `apps/painel/lib/fila.ts`
- Test: `apps/painel/test/fila.test.ts`

**Interfaces:**
- Consumes: `ItemDeHoje`, `SessaoDeHoje` (Task 2).
- Produces:
  - `buscarNaFila<T extends { nome: string; senha: string; documento: { cpf: string | null } }>(itens: T[], termo: string): T[]` — vazio devolve tudo; nome sem acento e sem maiúscula (contém); senha sem hífen e sem maiúscula ("c002" acha "C-002"); termo com 11 dígitos compara os 6 do meio (`digitos.slice(3, 9)`) com os dígitos do CPF mascarado.
  - `contextoDaLinha(i: ItemDeHoje, agora: number): string` — chamado: `"<serviço> · <estação> · há N min"`; presente: `"<serviço> · esperando <a triagem|o atendimento> há N min"`; remoto: `"<serviço> · em casa"`; com pendência de documento: `"<serviço> · documento a conferir"`; `desde: null` → sem o pedaço do tempo.
  - `minutosDesde(iso: string, agora: number): number` (arredonda para baixo, mínimo 0).
  - `pilulaDaSessao(s: SessaoDeHoje, fuso: string): { rotulo: string; detalhe: string; desativada: boolean }` — aberta: `{ rotulo: "Clínico geral", detalhe: "4" }`; planejada: `detalhe: "abre às 13:00"`; encerrada: `detalhe: "encerrada"`; cancelada: `desativada: true`.
  - `filtroValido(guardado: string | null, sessoes: { id: string }[]): string` — devolve `guardado` se existir entre as sessões, senão `"todas"`.
  - `agruparFila` (já existe) passa a aceitar itens de várias sessões sem mudança de assinatura; "encerrados" continua por último.

- [ ] **Step 1: Testes vermelhos** em `test/fila.test.ts`, um `it` por função, com os valores acima e mais:
  - busca: duas "Ana Souza" (Curativos e Clínico) → as duas; `"c002"` e `"C-002"` → o mesmo item; `"529.982.247-25"` → o item com CPF `•••.982.247-••`; `"Ana souza"` com acento diferente ("Âna") → acha.
  - `contextoDaLinha` presente na triagem com `desde` 12 min antes → `"Clínico geral · esperando a triagem há 12 min"`; com `desde: null` → `"Clínico geral · esperando a triagem"`.
  - `filtroValido("x", [{ id: "a" }])` → `"todas"`; `filtroValido("a", [{ id: "a" }])` → `"a"`.
- [ ] **Step 2:** `npm run test:painel` → FAIL.
- [ ] **Step 3:** implementar em `lib/fila.ts`.
- [ ] **Step 4:** `npm run test:painel` → PASS.
- [ ] **Step 5: Commit** `feat(painel): search, row context and service pills for the unit's queue`.

### Task 4: Painel — `Filtros` e `Busca` no kit

**Files:**
- Create: `apps/painel/components/ui/filtros.tsx`, `apps/painel/components/ui/busca.tsx`
- Test: `apps/painel/test/filtros.test.tsx`

**Interfaces:**
- Produces:
  - `Filtros<T extends string>({ rotulo: string; opcoes: { id: T; rotulo: string; detalhe?: string; icone?: LucideIcon; desativada?: boolean }[]; atual: T; mudar: (id: T) => void })` — pílulas (`role="radiogroup"`, cada uma `role="radio"` com `aria-checked`), a escolhida cheia no azul do kit, relevo leve; `detalhe` em peso menor ao lado do rótulo (sem "·" no texto).
  - `Busca({ valor: string; aoMudar: (v: string) => void; placeholder: string; rotulo: string })` — campo com ícone de lupa e botão de limpar (kit `Button variante="texto" tamanho="icone"`) quando há texto; `Esc` limpa.

- [ ] **Step 1: Testes vermelhos** em `test/filtros.test.tsx`:
  - `Filtros` com três opções: a atual tem `aria-checked="true"`; clicar outra chama `mudar` com o id; opção `desativada` não chama.
  - `Busca`: digitar chama `aoMudar`; com valor, o botão "Limpar busca" aparece e chama `aoMudar("")`; `Esc` no campo também.
- [ ] **Step 2:** `npm run test:painel` → FAIL.
- [ ] **Step 3:** implementar os dois em `components/ui/`.
- [ ] **Step 4:** `npm run test:painel` → PASS (inclusive a trava do design system).
- [ ] **Step 5: Commit** `feat(painel): filter pills and search field in the kit`.

### Task 5: Painel — a nova Fila do dia

**Files:**
- Rewrite: `apps/painel/app/(painel)/fila/page.tsx` (e, se passar de ~250 linhas, `components/fila/{grupo-da-fila,linha-da-fila,faixa-da-sessao}.tsx`)
- Modify: `.specs/features/mvp-filas/roteiro-v01.md` (passos da recepção na Fila do dia), `.specs/STATE.md`

**Interfaces:**
- Consumes: `GET …/fila-de-hoje` (Task 2); `buscarNaFila`, `contextoDaLinha`, `pilulaDaSessao`, `filtroValido`, `agruparFila` (Task 3); `Filtros`, `Busca` (Task 4); `acoesDaFila`, `textoDoDocumento`, presença e abrir/encerrar como na página de hoje.

- [ ] **Step 1:** reescrever a página conforme `fila-do-dia.md` ("O desenho"): título e unidade; `Busca` à direita; `Filtros` com "Todas · N" e uma pílula por sessão (`pilulaDaSessao`, ícone `StethoscopeIcon`); faixa da sessão só com uma sessão escolhida e para quem pode abrir/encerrar; grupos com ícone e contagem (`AlertTriangleIcon` recepção, `MegaphoneIcon` chamado, `ArmchairIcon` na unidade, `HouseIcon` a caminho, `CheckIcon` atendidos, este recolhido); linhas com senha, nome, selo de prioridade, `contextoDaLinha` e as ações de presença do kit (`sucesso` "Confere, marcar presença", `textoPerigo` "Não confere", `secundario` "Marcar presença"). Consulta a cada 3 s; `agora` da resposta para os tempos. Busca sem resultado: "Ninguém com '<termo>' na fila de hoje."
- [ ] **Step 2:** some: os quatro quadros grandes de contagem e a frase longa do cabeçalho.
- [ ] **Step 3:** `npm run test:painel` → PASS; `npx tsc --noEmit` em `apps/painel`; `npx biome check apps/painel` sem erros novos (os 8 antigos continuam).
- [ ] **Step 4:** estados vazios e prints: com o seed recém-criado, print da tela (nenhuma sessão aberta: pílulas com "abre às"); depois o cenário da conversa (`cenario-fila.mjs`: abrir as duas sessões, duas presenças, uma chamada) e print como recepção a 1440 px e 1024 px; buscar "c002" e um CPF (print); `npm run dev:seed` no fim.
- [ ] **Step 5:** roteiro e STATE atualizados; todas as suítes (`test:design`, `test:domain`, schemas, `test:painel`, `test:mobile`, API) e `npm run specs:check`.
- [ ] **Step 6: Commit** `feat(painel): the day's queue as the whole unit, with search and service pills`.

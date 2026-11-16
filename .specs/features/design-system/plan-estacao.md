# Estação: chamado, compareceu e a fila à vista — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a Estação em duas fases (chamado → Compareceu → na sala), com a fila por senha e primeiro nome e tudo no design system.

**Architecture:** o domínio ganha `compareceu`/`desfazerCompareceu`, que só gravam `compareceuEm` na última `Chamada` do item (sem estado novo); `finalizar`/`chamarProximo` exigem o comparecimento na triagem e o marcam sozinhos no atendimento. A API expõe os dois comandos e enriquece a operação da estação. O painel reescreve `/estacao` com componentes em `components/estacao/` (botões só do kit).

**Tech Stack:** TypeScript, Fastify + Drizzle, Next 16 + Tailwind, zod, Vitest.

**Spec:** [estacao.md](estacao.md)

## Global Constraints

- TDD em toda task; modo rápido da v0.1.
- Botões do kit: `principal`, `secundario`, `perigoContorno`, `perigo`, `texto`; nenhum `<button>` fora de `apps/painel/components/ui/`; nada de "Info · Info · Info".
- Chips da fila: só senha e primeiro nome.
- Tempo-alvo (min): emergencia 0, muito_urgente 10, urgente 60, atencao 120, rotina 240; sem cor confirmada, 30.
- Testes da API pedem o Docker Desktop no ar (`systemctl --user start docker-desktop`).
- Next 16: ler `node_modules/next/dist/docs/` antes de criar rota ou layout.

## Review Focus

1. **Item rechamado depois de "Não compareceu" (1º pulo) e chamado de novo**: o `compareceuEm` é da chamada nova, não herda o da anterior. → Task 1, teste.
2. **Desfazer sem Compareceu** ou **Compareceu sem ninguém chamado**: recusa sem mudar nada. → Task 1, teste.
3. **Triagem: classificar sem Compareceu**: a API responde 409 `sem_comparecimento` com mensagem, não 500. → Task 2, teste.
4. **Fila com 0 aguardando e 0 a caminho**: `proximos: []`, `aCaminho: []`, `maisAntigo: null`; a tela mostra "ninguém ainda" / "ninguém". → Task 2 e Task 3, testes.
5. **Nome com espaços extras ou vazio**: o primeiro nome sai sem espaço e nunca quebra (vazio vira ""). → Task 2, teste de `primeiroNome`.

---

### Task 1: Domínio — Compareceu

**Files:** Modify `packages/domain/src/fila.ts` (`Chamada.compareceuEm?: number`), `packages/domain/src/chamada.ts`, `packages/domain/src/resultado.ts` (código `"sem_comparecimento"`), `packages/domain/src/contratos.ts` (duas linhas `de: "chamado"`, eventos `"Compareceu"` e `"Desfazer compareceu"`, `para: "(mesmo)"`, spec `chamada`), `packages/domain/src/tipos.ts` (`TEMPO_ALVO_MIN`), exportar no index; `.specs/specs/chamada/spec.md` (`npm run specs:gen` + texto da estação). Test `packages/domain/test/chamada.test.ts`.

**Interfaces (produz):**
- `compareceu(dia: DiaSessao, cmd: { estacaoId: string }, agora: number): Resultado<DiaSessao>` — grava `compareceuEm = agora` na última chamada do item chamado (idempotente: se já tem, devolve o dia igual, sem evento). Evento `{ tipo: "compareceu", ...base, dados: { em } }`.
- `desfazerCompareceu(dia, cmd, agora): Resultado<DiaSessao>` — apaga; sem `compareceuEm` → `transicao_proibida`.
- `compareceuEm(dia: DiaSessao, estacaoId: string): number | null`.
- `TEMPO_ALVO_MIN: Record<NivelRisco, number>`.

- [ ] Testes vermelhos em `chamada.test.ts`:
  - `compareceu` grava `compareceuEm` na última chamada; repetir não muda; sem chamado → `transicao_proibida`; sessão fechada → `sessao_fechada`.
  - `desfazerCompareceu` volta a `undefined`; sem compareceu → `transicao_proibida`.
  - depois de `compareceu`: `rechamar` e `naoCompareceu` → `transicao_proibida`; `toleranciaEsgotada(...)` → `false` mesmo passado o tempo.
  - triagem: `finalizar` e `chamarProximo` com chamado sem compareceu → `sem_comparecimento`; com compareceu → ok como hoje.
  - atendimento: `finalizar` sem compareceu → ok e a chamada fica com `compareceuEm === agora`.
  - Review Focus 1: chamado, não compareceu (1º pulo), chamado de novo → `compareceuEm(dia, est) === null`.
- [ ] Ajustar os testes existentes de triagem que finalizam sem compareceu (chamar `compareceu` antes).
- [ ] Implementar; `npm run specs:gen` e o parágrafo da estação na spec (fases e botões); `npm run test:domain`, `npm run specs:check`; commit `feat(domain): attendance step at the station (compareceu)`.

### Task 2: API — comandos e operação enriquecida

**Files:** `packages/schemas/fila.ts`; `apps/api/infra/fila/estacao.ts`; rotas `apps/api/routes/v1/painel/estacoes/_estacaoId/compareceu/route.ts` e `desfazer-compareceu/route.ts` (`rotaDoComando`); Test `apps/api/tests/integration/v1/painel/estacoes/operacao.test.ts` e `triagem.test.ts`; unit de `primeiroNome` onde ficar (`apps/api/infra/fila/nomes.ts` + teste unitário ao lado dos existentes).

**Interfaces (produz):**
- `comandoEstacaoSchema` += `"compareceu"`, `"desfazer-compareceu"`.
- `chamadoSchema` += `compareceuEm: iso | null`, `prioridade: string[]` (grupos da entrada, qualquer etapa).
- `operacaoEstacaoSchema` += `proximos: { senha, nome, presenteDesde: iso }[]` (até 3, ordem de `elegiveis`), `aCaminho: { senha, nome }[]` (até 3, remotos da etapa por `numero`), `maisAntigo: { presenteDesde: iso, tempoAlvoMin: number } | null` (menor `presenteDesde` entre os elegíveis; alvo: `TEMPO_ALVO_MIN[risco]` se `urgenciaConfirmada` ou etapa `atendimento`, senão 30). `nome` = `primeiroNome(nomeCompleto)`.
- Erro `sem_comparecimento` → 409, mensagem "Marque Compareceu antes de classificar.".

- [ ] Testes vermelhos: `compareceu` → 200 com `chamado.compareceuEm`; `desfazer-compareceu` → `null`; triagem finalizar sem compareceu → 409 `sem_comparecimento`; operação com Ana e Bruno presentes e Carla remota → `proximos` com primeiros nomes na ordem de chamada, `aCaminho: [{ nome: "Carla" }]`, `maisAntigo` preenchido; sem ninguém → `[]`, `[]`, `null`. `primeiroNome("  Ana   Souza ")` → `"Ana"`, `primeiroNome("")` → `""`.
- [ ] Ajustar os testes de triagem existentes (compareceu antes de finalizar/chamar).
- [ ] Implementar; suíte da API; commit `feat(api): attendance commands and the station queue preview`.

### Task 3: Painel — a Estação nova

**Files:** `apps/painel/lib/estacao.ts` (puras) + `test/estacao.test.ts`; `components/estacao/` (`FilaDaEstacao`, `FaixaDoPaciente`, `ClassificacaoDeRisco`, `EstadoVazio`); `components/ui/cartao-da-estacao.tsx` (cartão de uma linha + troca no `PainelLateral`, como `UnidadeNoMenu`); `lib/triagem.ts` (cartões claros: `borda`, `bolinha`, `cheio` no lugar de `classes`); reescrever `app/(painel)/estacao/page.tsx`.

**Interfaces (consome Task 2):** `OperacaoEstacao` novo.
- `faseDoChamado(c: { compareceuEm: string | null }): "chamado" | "na_sala"`.
- `pilulaDoMaisAntigo(m: OperacaoEstacao["maisAntigo"], agora: number): { texto: string; atrasado: boolean } | null` — "o mais antigo há 12 min"; `atrasado` quando minutos > `tempoAlvoMin`.
- `textoDaEspera(presenteDesde: string, agora: number): string` — "há 12 min" ("agora" abaixo de 1 min, como `minutosDesde`).

- [ ] Testes vermelhos das puras; teste do componente da página (jsdom) para: fase 1 mostra Rechamar, Não compareceu, Compareceu e o quadro "A classificação de risco abre quando a pessoa entrar na sala"; fase 2 mostra "na sua sala", "desfazer", a classificação (triagem) e "Finalizar e chamar o próximo"; fila vazia mostra "ninguém ainda".
- [ ] Implementar conforme o design (ordem dos botões: Rechamar, Não compareceu, Compareceu); trava do design system verde.
- [ ] Prints (`print-painel.mjs /estacao`) nas duas fases; roteiro e `decisoes-para-revisar.md` (seção "Estação", ES1–ES5); `.specs/STATE.md`; todas as suítes; commit `feat(painel): station screen with the attendance step and the queue preview`.

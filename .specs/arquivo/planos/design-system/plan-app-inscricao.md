# App: inscrição com o Dr. Lino e a relação com a outra pessoa — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** a inscrição como conversa com o Dr. Lino (caixinha, "nenhum" primeiro, "pronto!" com o Dr. Lino) e, para outra pessoa, um dado por tela e a relação com declaração, guardada na entrada e mostrada na Fila do dia. **Spec:** [app-inscricao.md](../../../features/design-system/app-inscricao.md). **Tech Stack:** zod (`packages/schemas`), Fastify + Drizzle (API, testes de integração com Docker), Next (painel, Vitest + Testing Library), Expo (app, Vitest só em `src/lib`).

## Global Constraints

- TDD; botões só do kit; nada de "Info · Info · Info"; nomes com `nomeProprio`/`primeiroNome`; textos do app em minúsculas; Dr. Lino só no branco, sem caixa.
- Relações (valores fixos): `responsavel_legal` "sou mãe, pai ou responsável legal" / painel "responsável legal"; `cuidador` "sou cuidador(a)" / "cuidador(a)"; `familiar_autorizado` "sou familiar ou amigo, com autorização de {Ana}" / "familiar ou amigo".
- Declaração (provisória até o D5): "declaro que posso inscrever {Ana} e responder por {Ana}".

## Review Focus

1. **Outra pessoa sem relação ou sem declaração** (app antigo ou chamada direta): a API recusa com 400. → Task 1, teste de schema; Task 2, teste de integração.
2. **"para mim"** não exige relação e a Fila do dia não mostra "inscrita por". → Task 2, teste.
3. **Lista de espera** (modo "lista") com outra pessoa: também guarda a relação. → Task 2, teste.
4. **Refazer o questionário** não pede relação nem dados de novo (começa na 1ª pergunta, sem a apresentação). → Task 4, olhar.
5. **Erro do `/verificar` num dado** (ex.: CPF é o da conta): volta para a tela do CPF com a mensagem, não para a da relação. → Task 4, `telaDoErro` testada.

---

### Task 1: schema (`packages/schemas/fila.ts`, teste em `packages/schemas/test/`)

**Interfaces:** `relacaoSchema = z.enum(["responsavel_legal","cuidador","familiar_autorizado"])`, `type Relacao`; `paraQuem` tipo `outra` ganha `relacao: relacaoSchema` e `declarou: z.literal(true)`; `itemDaFilaSchema` ganha `responsavel: z.object({ nome: z.string(), relacao: relacaoSchema }).nullable()`.

- [ ] Testes vermelhos: `outra` sem `relacao` ou com `declarou: false` falha; com os dois passa; `eu` continua sem nada. Implementar; `npm -w @fila-saude/schemas run test`.

### Task 2: API (coluna, gravação e Fila do dia)

**Files:** `infra/database/municipal/schema/entrada.ts` (coluna `relacao_responsavel` text, nula), migração gerada (`db:generate:municipal`, `0013_…`); `infra/fila/app.ts`, `lista-espera.ts`, `inscricao.ts`/`entradas.ts` (gravar a relação da `paraQuem` de outra pessoa); `infra/fila/painel.ts` (`responsavel`: primeiro nome do paciente responsável, do banco central, e a relação, só quando há relação).

- [ ] Testes vermelhos (integração): inscrição de outra pessoa sem relação → 400; com relação → a Fila do dia mostra `responsavel: { nome: <primeiro nome da conta>, relacao }`; "para mim" → `responsavel: null`; lista de espera de outra pessoa guarda a relação. Atualizar os testes existentes que inscrevem outra pessoa (mandam `relacao` e `declarou`).
- [ ] Implementar; `npm test` (Docker) verde.

### Task 3: painel (`components/fila/linha-da-fila.tsx`, `lib/fila.ts`)

**Interfaces:** `textoDaRelacao(r: Relacao): string` em `lib/fila.ts`.

- [ ] Teste vermelho: a linha com `responsavel` mostra a pílula "inscrita por Bruno · responsável legal" (ícone de pessoa); sem `responsavel`, nada. Implementar; `npm run test:painel`.

### Task 4: app

**Files:** `src/lib/inscricoes.ts` (lógica pura, teste `test/inscricoes.test.ts`), `src/lib/questionario.ts` (falas), `src/app/inscricao/[sessaoId].tsx`.

**Interfaces:**
- `RELACOES: readonly { id: Relacao; texto: (nome: string) => string }[]`.
- `type PassoDaPessoa = "nome" | "nascimento" | "cpf" | "relacao"`; `telaDoErro(e: ErroDaVerificacao): PassoDaPessoa` (campo CPF → "cpf"; pessoa → "nome").
- `falaDaPergunta(tela: Tela, quem: "eu" | "outra", nome: string): string` — as falas do spec, com o primeiro nome.
- `tituloDoPronto(passo, quem, nome): { titulo: string; texto: string }` — sem "(a)".

- [ ] Testes vermelhos das três funções e de `RELACOES`; implementar.
- [ ] Tela: `BalaoDoLino` em cada pergunta; `quem` com as pílulas do atendimento; outra pessoa em 4 passos com o selo "dados de quem vai ser atendido" (`Selo` do kit com ícone) nos 3 primeiros; relação + declaração (`Opcao`); `/verificar` depois da relação; apresentação antes do questionário (não no "refazer"); "nenhum" primeiro + "ou marque o que tiver"; "pronto!" com `Mascote` grande, título, texto e pílulas. Mandar `relacao` e `declarou` no envio.
- [ ] `tsc`, `biome`, `npm run test:mobile`; olhar no Android.

### Task 5: spec e arremate

- [ ] `.specs/specs/lista-espera/spec.md`: a regra da relação e da declaração (texto provisório até o D5) na RN de "para quem é"; `decisoes-para-revisar.md` (relação provisória, texto da declaração); `roteiro-v01.md` (o passo da relação); `STATE.md`; `specs:check`; arquivar este plano; commit.

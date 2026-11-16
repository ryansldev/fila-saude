# QR de entrada e unidade no menu — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** QR de entrada para a equipe e para o paciente, com o Dr. Lino; QR estilizado (pontos pretos, coração azul) em todo lugar; a unidade num cartão do menu para o painel inteiro.

**Architecture:** o SVG do Dr. Lino vai para `packages/design`. O painel ganha `lib/qr.ts` (QR estilizado, testado com um leitor de QR), os componentes `QrDeEntrada` e `DrLino` no kit, a tela da equipe `/qr`, a tela do paciente `/qr-paciente` (fora do layout do painel, como `/tv`) e um contexto da unidade no layout com `CartaoDaUnidade` e `TrocaDeUnidade`. A API ganha `GET /v1/painel/unidades/hoje`.

**Tech Stack:** TypeScript, Next 16 + Tailwind, Fastify + Drizzle, Vitest; `qrcode` (matriz), `sharp` + `zxing-wasm` (só nos testes).

**Spec:** [qr-e-unidade.md](qr-e-unidade.md)

## Global Constraints

- TDD em toda task; modo rápido da v0.1.
- Botões do kit; nenhum `<button>` fora de `apps/painel/components/ui/`; nada de "Info · Info · Info".
- Dr. Lino sempre sobre fundo branco. Balão suave: fundo `#eef5fa`, sem borda, pontinha para o Dr. Lino.
- QR: correção H, pontos pretos `#111313`, coração azul `#1a73c8` no centro; deve ser lido a 600 e 160 px.
- Tela do paciente em minúsculas, texto grande (fala ~1,5vw, passos ~1,2vw, aviso ~1vw).
- Testes da API pedem o Docker Desktop no ar.

## Review Focus

1. **QR com conteúdo mais longo** (token maior): ainda lê com o coração no centro. → Task 1, teste com conteúdo de 120 caracteres.
2. **Usuário sem nenhuma unidade** (ou erro ao listar): o cartão do menu diz "Nenhuma unidade" e as páginas não quebram. → Task 4, teste do contexto.
3. **Unidade guardada que a pessoa perdeu acesso**: volta para a primeira disponível. → Task 4, teste `unidadeInicial`.
4. **Tela do paciente sem sessão aberta**: o Dr. Lino diz quando abre, sem QR vencido na tela. → Task 3, `falaSemSessao`.
5. **Nome de unidade longo** no cartão do menu: cortado com "…", nome inteiro no `title`. → Task 4, conferido no print.

---

### Task 1: QR estilizado e o Dr. Lino compartilhado

**Files:** Create `packages/design/lino.ts` (`export const LINO_SVG`), exportar em `packages/design/index.ts`; app passa a importar de `@fila-saude/design` (remove `apps/mobile/src/components/mascote-svg.ts`). Create `apps/painel/lib/qr.ts`; Test `apps/painel/test/qr.test.ts` (`// @vitest-environment node`).

**Interfaces:** `qrEstilizado(conteudo: string): string` — SVG (viewBox em módulos, margem 2).

- [ ] Teste vermelho: `qrEstilizado(x)` rasterizado (sharp, 600 e 160 px) e lido com `zxing-wasm` devolve `x`, para um conteúdo curto e um de 120 caracteres; o SVG contém `#1a73c8` (coração) e não contém `#185b9a`.
- [ ] Implementar (algoritmo do protótipo: pontos `r=.43`, três cantos arredondados, quadrado branco 6,8 com o coração).
- [ ] Verde; `npm run test:painel`, `npm run test:mobile`, `npm run test:design`; commit `feat: styled entry QR and Dr. Lino in the shared design package`.

### Task 2: API — resumo de hoje por unidade

**Files:** `packages/schemas/unidade.ts` (`resumoDeHojeSchema`), `apps/api/infra/fila/painel.ts` (`resumoDeHoje`), rota `apps/api/routes/v1/painel/unidades/hoje/route.ts`; Test `apps/api/tests/integration/v1/painel/unidades/hoje.test.ts`.

**Interfaces:** `GET /v1/painel/unidades/hoje` → `{ unidadeId, abertas, proximaAbertura: iso | null }[]` das unidades que `listarUnidades` devolve à pessoa.

- [ ] Teste vermelho: com uma sessão aberta e outra planejada mais tarde hoje na mesma unidade → `{ abertas: 1, proximaAbertura: <inicio da planejada> }`; outra unidade sem nada → `{ abertas: 0, proximaAbertura: null }`.
- [ ] Implementar; verde; suíte da API; commit `feat(api): today's summary per unit for the unit switcher`.

### Task 3: Painel — QR de entrada (equipe e paciente) e TV

**Files:** Create `components/ui/dr-lino.tsx` (`DrLino({ fala, tamanho })`, fundo branco, balão suave), `components/ui/qr-de-entrada.tsx` (`QrDeEntrada({ conteudo, expiraEm, intervaloSegundos, tamanho })` com moldura e barrinha); rewrite `app/(painel)/qr/page.tsx`; create `app/qr-paciente/page.tsx`; TV usa `qrEstilizado`; `lib/qr.ts` ganha `falaSemSessao(proximaAbertura: string | null, fuso: string): string`.

- [ ] Teste vermelho de `falaSemSessao`: com `proximaAbertura` 13:00 no fuso → `"a fila abre às 13:00."`; `null` → `"hoje não tem atendimento por aqui."`.
- [ ] Implementar e montar as telas conforme o design (equipe: quatro passos para quem atende, botão "Abrir para o paciente (tela cheia)" que abre `/qr-paciente`; paciente: três colunas, QR, Dr. Lino grande, texto grande).
- [ ] Verde; prints de `/qr` e `/qr-paciente` com sessão aberta e sem; commit `feat(painel): entry QR for staff and patient with Dr. Lino; styled QR on the TV`.

### Task 4: Painel — a unidade no menu

**Files:** `lib/unidade-atual.ts` (contexto `ProvedorDaUnidade`, `useUnidadeAtual` lê o contexto; função pura `unidadeInicial(guardada, ids): string | null`), `app/(painel)/layout.tsx` (provedor; menu pela unidade escolhida), create `components/unidade/cartao-da-unidade.tsx` e `troca-de-unidade.tsx`; remove `SeletorDeUnidade` das 8 páginas e o arquivo.

- [ ] Teste vermelho: `unidadeInicial("x", ["a","b"])` → `"a"`; `unidadeInicial("b", ["a","b"])` → `"b"`; `unidadeInicial(null, [])` → `null`; `menuDoPainel` filtrado pela unidade (`perfisNaUnidade(perfis, unidadeId)`): recepção em u1 e agendar em u2 → em u1 "Fila do dia, QR de entrada", em u2 "Agendamento".
- [ ] Implementar; cartão de uma linha (ícone, nome com "…", bolinha verde se `abertas > 0`, seta só com mais de uma); `TrocaDeUnidade` no `PainelLateral` com cartões (nome inteiro, endereço com CEP, tipo, CNES, resumo de hoje).
- [ ] Verde; trava do design system; prints; roteiro/STATE; todas as suítes; commit `feat(painel): the unit as a menu card for the whole panel`.

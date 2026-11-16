# App: página da unidade com a faixa de dias — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** a página da unidade com o cabeçalho em cartão, a faixa de dias (com mês e ano), o calendário do mês numa gaveta, os atendimentos do dia com botões do kit e a lista de espera compacta. **Spec:** [app-unidade.md](app-unidade.md). **Tech Stack:** Expo/React Native, Vitest (só funções puras).

## Global Constraints

- TDD na lógica (`src/lib`); botões do kit; nenhum `<Pressable` fora de `src/components/ui.tsx`; nada de "Info · Info · Info"; fuso `America/Sao_Paulo`.

## Review Focus

1. **Sessão perto da meia-noite UTC** (ex.: 22h em Brasília = 01h UTC do dia seguinte): cai no dia certo de Brasília. → Task 1, teste.
2. **Datas em dois anos** (dez/2026 e jan/2027): mês e ano certos e a grade de janeiro começando no dia da semana certo. → Task 1, teste.
3. **Dia escolhido some** (a sessão foi cancelada e a página atualizou): volta ao primeiro dia com atendimento, sem tela vazia. → Task 1, `diaValido`.
4. **Nenhuma sessão**: sem faixa, a mensagem de hoje. → print.

---

### Task 1: lógica dos dias (`src/lib/dias.ts`, teste `test/dias.test.ts`)

**Interfaces:**
- `type DiaDaFaixa = { chave: string; topo: string; dia: string; mesAno: string }` (`chave` = "2026-11-16" no fuso).
- `chaveDoDia(iso: string, fuso?): string`
- `diasComAtendimento(inicios: string[], agora: number, fuso?): DiaDaFaixa[]` — únicos, em ordem; `topo` "hoje"/"amanhã"/"qua".
- `mesAno(chave: string): string` — "novembro de 2026".
- `diaPorExtenso(chave: string): string` — "quarta, 25 de novembro".
- `gradeDoMes(ano: number, mes: number, comAtendimento: Set<string>, hoje: string): ({ chave: string; dia: number; tem: boolean; hoje: boolean } | null)[][]` — semanas de domingo a sábado.
- `diaValido(escolhido: string | null, dias: DiaDaFaixa[]): string | null`.

- [ ] Testes vermelhos com os valores acima (inclui Review Focus 1–3); implementar; `npm run test:mobile`; commit `feat(mobile): day helpers for the unit page strip and calendar`.

### Task 2: a página (`src/components/ui.tsx`, `src/app/unidade/[id].tsx`)

- [ ] `ui.tsx`: `FaixaDeDias({ dias, atual, mudar, aoAbrirCalendario })` (ScrollView horizontal; avisa o primeiro dia visível pelo `onScroll` para o rótulo de mês e ano; botão "calendário" no fim, só com mais de um dia), `CalendarioDoMes({ dias, atual, aoEscolher, fechar, aberta })` na `Gaveta`, `Pilula({ texto, tom, Icone })`.
- [ ] Reescrever a página conforme o design (cabeçalho em cartão, "escolha o dia" + mês e ano, cartões do dia com `Botao` `medio`, lista de espera compacta, sem os filtros por serviço).
- [ ] Trava do design system verde; `npm run test:mobile`; `tsc`; prints (`print-app.mjs`); roteiro e STATE; commit `feat(mobile): unit page with the day strip and month calendar`.

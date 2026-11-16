# TV branca e azul — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** a TV na grade de hoje, com fundo branco e azul só na chamada. **Spec:** [tv.md](tv.md). **Tech Stack:** Next 16 + Tailwind, Vitest + Testing Library.

## Global Constraints

- TDD; modo rápido. Botões do kit; nada de "Info · Info · Info". API, som e anúncios sem mudança.

## Review Focus

1. **Muitos serviços** (6+): os cartões não empurram o QR para fora da tela (grade com `min-h-0` e `overflow-hidden`). → print.
2. **Senha longa** ("PRIO-0123") e destino longo ("sala de procedimentos 2"): cabem no cartão azul sem quebrar a grade. → teste de componente com `truncate`.
3. **Sem conexão por pouco tempo**: o aviso aparece sobre a tela branca, legível. → print.

---

### Task 1: TV branca

**Files:** Create `apps/painel/components/tv/painel-da-tv.tsx` (`PainelDaTv`, `Relogio`), Test `apps/painel/test/tv-tela.test.tsx`; Modify `apps/painel/app/tv/page.tsx` (fundo branco nas telas de pareamento, iniciar, reconectando; usa `PainelDaTv`).

**Interfaces:** `PainelDaTv({ estado, atual, ultimas, svg, agora })` — mesmas props do `Painel` de hoje e `agora: number` para a hora.

- [ ] Teste vermelho: com `atual`, a seção "chamando agora" tem a senha e "→ destino" e a classe do azul cheio; sem `atual`, "aguarde a sua senha" e "a senha aparece aqui quando chamarem"; cada serviço mostra o nome, o número de aguardando e o de a caminho em elementos separados (sem "+"); o topo mostra "fila saúde", o nome da unidade e a hora `HH:MM`; sem `svg`, "o QR aparece quando o atendimento abrir".
- [ ] Implementar; telas de pareamento/iniciar/reconectando em branco; `npm run test:painel`; prints (`print-tv.mjs`); roteiro e STATE; commit `feat(painel): white and blue waiting-room TV`.

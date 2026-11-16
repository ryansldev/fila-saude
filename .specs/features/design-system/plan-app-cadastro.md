# App: criar conta, uma pergunta por tela — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** o cadastro em 7 telas (6 perguntas e "confira") com o Dr. Lino compacto, e o mesmo Dr. Lino no "entrar". **Spec:** [app-cadastro.md](app-cadastro.md).

## Global Constraints

- TDD na lógica; botões do kit; nenhum `<Pressable` fora de `src/components/ui.tsx`; API sem mudança.

## Review Focus

1. **"corrigir" e depois "continuar"** volta ao "confira", não à tela seguinte. → teste.
2. **CPF recusado pelo servidor** leva à tela do CPF; e-mail recusado, à do e-mail; outro erro fica na faixa do "confira". → teste.
3. **Voltar do Android na primeira tela** sai do cadastro; nas outras, volta uma tela. → `passoAnterior`, teste.

---

### Task 1: lógica (`src/lib/cadastro.ts`, `test/cadastro.test.ts`)

**Interfaces:** `PASSOS_DO_CADASTRO` (`nome`, `cpf`, `nascimento`, `telefone`, `senha`, `email`, `confira`); `type PassoDoCadastro`; `erroDoPasso(p, v): string | undefined`; `proximoPasso(p, corrigindo: boolean): PassoDoCadastro`; `passoAnterior(p): PassoDoCadastro | null`; `regraDaSenha(senha): { oitoCaracteres: boolean }`; `passoDoErroDoServidor(codigo: string | undefined): "cpf" | "email" | null`; `resumoDoCadastro(v): { passo; rotulo; valor }[]` (sem a senha).

- [ ] Testes vermelhos; implementar; commit `feat(mobile): sign-up step logic`.

### Task 2: telas

- [ ] Kit: `BalaoDoLino({ texto })` (Dr. Lino pequeno e o balão suave); `Campo` com `dica`.
- [ ] `cadastro.tsx` reescrito; `entrar.tsx` com o `BalaoDoLino`.
- [ ] Testes, `tsc`, prints, roteiro e STATE; commit `feat(mobile): one-question-per-screen sign-up with Dr. Lino`.

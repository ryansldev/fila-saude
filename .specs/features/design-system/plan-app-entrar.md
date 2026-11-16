# App: entrar — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** a tela "entrar" com o Dr. Lino grande, o olho no campo da senha, "esqueci a senha" na gaveta e o que falta dito no campo. **Spec:** [app-entrar.md](app-entrar.md).

## Global Constraints

- TDD na validação; botões do kit; nenhum `<Pressable` fora de `src/components/ui.tsx`; o Dr. Lino sobre fundo branco.

## Review Focus

1. **CPF com espaços ou só a máscara** ("___.___"): conta como vazio → "digite o CPF.". → teste.
2. **Erro do servidor depois de corrigir o campo**: a faixa some ao digitar (como hoje). → print.

---

### Task 1: entrar

**Interfaces:** `faltaNoLogin(cpf: string, senha: string): { cpf?: string; senha?: string }` em `src/lib/validacao.ts`.

- [ ] Teste vermelho: `("", "")` → `{ cpf: "digite o CPF.", senha: "digite a senha." }`; `("111.111.111-11", "x")` → `{ cpf: "CPF inválido. confira os números." }`; `("529.982.247-25", "")` → `{ senha: "digite a senha." }`; `("529.982.247-25", "x")` → `{}`; `("  ", "x")` → `{ cpf: "digite o CPF." }`.
- [ ] `Campo` ganha `direita?: ReactNode` (dentro do campo); `CampoSenha` usa o olho (`Eye`/`EyeOff`) em `AreaTocavel`, sem o botão "mostrar senha".
- [ ] `entrar.tsx` conforme o design (Dr. Lino `Mascote` grande, gaveta "esqueci a senha", "entrar" sempre aceso, "ainda não tenho conta").
- [ ] `npm run test:mobile`; `tsc`; prints; roteiro e STATE; commit `feat(mobile): friendlier sign-in with Dr. Lino and the password eye`.

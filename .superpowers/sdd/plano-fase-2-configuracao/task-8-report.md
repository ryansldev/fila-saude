# Task 8 report: login e navegação por perfil

Status: DONE. Worktree agent-ae42cb82b8ae3e41c, branch worktree-agent-ae42cb82b8ae3e41c (base feat/fase-2-configuracao 0dd8d1b).
Commits: f4a7dc1 + bfdf5a2 (fix(painel) carry-overs), 7b6e280 (feat(painel): login and role-based navigation).
(Report written inside the worktree; not committed.)

## Changes
- Carry-overs: slug regex `^[a-z][a-z0-9-]{1,28}[a-z0-9]$` (min 3 chars, max 30); DOMINIO_BASE -> TENANT_BASE_DOMAIN (proxy.ts, .env.development); 2xx non-JSON body -> ErroDaApi(status, "resposta_invalida") (empty body/204 still undefined). Tests added first (both failed for the right reason).
- Task 8: lib/navegacao.ts (menuDoPainel via `pode`), lib/sessao.tsx (EuPainel local type with TODO(1B T16), useEu, useLogin, re-export ApiProvider), components/formulario-login.tsx, app/login/page.tsx, app/(painel)/layout.tsx (guard + menu), app/(painel)/em-breve/page.tsx, app/page.tsx now redirects to /login.
- @fila-saude/domain added as painel dependency; next.config transpilePackages; tsconfig allowImportingTsExtensions (domain uses `.ts` imports).

## TDD evidence
Red: `Failed to resolve import "@/lib/navegacao"` / `"@/components/formulario-login"` (2 files failed, 24 existing passed). Green: `npm run test:painel` -> 5 files, 30 tests passed. `npx biome check apps/painel` clean; `next build` OK.

## Self-review
- Login errors: 401 -> credenciais; 423 or code "bloqueado" -> bloqueado; everything else (incl. sem_conexao, 5xx) -> rede.
- Login call isolated in `entrar()` in lib/sessao.tsx (POST /v1/painel/auth/sign-in/email {email,password}, then GET /v1/painel/eu).

## DECISÕES
- DECISÃO: `GET /v1/painel/eu` as the endpoint for current user (undefined in the plan); 401 -> anonymous, redirect to /login.
- DECISÃO: menu "Em breve" (/em-breve) for any perfil other than gestor/admin; empty menu when no perfis; after login redirect to first menu item, fallback /em-breve.
- DECISÃO: unexpected errors (5xx etc.) shown as "rede / tentar de novo" since the error union is fixed by the brief.
- DECISÃO: `/` redirects to /login.

## Concerns
- No design-system package is importable from apps/web; screens reuse the Button/Logo copied in Task 7 plus plain Tailwind inputs. No design system built.
- Menu hrefs (/unidades, /servicos, ...) have no pages yet (404 until later tasks).
- API-side validarSlug and /v1/painel/eu and sign-in endpoints do not exist in this branch; slug regex taken from the brief.
- Auth guard is client-side only (useEu in layout).

## Fix round 1 (fix(painel): login error classification and copy)
- sessao.tsx: only sign-in errors map to credenciais/bloqueado; /eu failure after sign-in -> generic ("rede") error. Test: "sign-in ok mas /eu com 401 mostra erro genérico, não credenciais".
- Copy: "Não foi possível entrar agora. Tente de novo."; test regex updated.
- navegacao.ts: "Sessões" gated on configurar_servicos_sessoes_estacoes_tv; paciente excluded (no "Em breve"); ITENS_DO_MENU exported. Tests: "paciente não tem menu do painel", "cada item aparece para um perfil exatamente quando a matriz permite a ação".
- login.test.tsx fake asserts GET path /v1/painel/eu and POST body {email, password}.
- Red first: 4 failed / 29 passed. After: `npm run test` in apps/painel -> 33 passed; `npx biome check apps/painel` clean.

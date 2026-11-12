# STATE

Só o handoff entre sessões. Princípios: [constitution.md](constitution.md). Regras: [specs/](specs/). Decisões: [decisions.md](decisions.md). Checagem: `npm run specs:check`.

## Onde estamos (2026-11-11)

- **Branch:** `feat/v0.1` (tudo até aqui: 1A, 1B Tasks 1–10, fase 2 Tasks 1–8), sem PR.
- **Specs reorganizadas** (AD-051): a antiga `features/mvp-filas/source.md` virou as specs por capacidade em `specs/`, as ADs saíram deste arquivo para `decisions.md` (AD-001..AD-051; PD-01..PD-31 no plan), e `scripts/specs-check.mjs` confere IDs, decisões substituídas e cobertura.
- **MVP:** `features/mvp-filas/` com `spec.md` (escopo e histórias), `plan.md` (PD-01..PD-33), `tasks.md` (47 tasks em 8 fases, TDD, discoveries D1–D10).
- **Protótipo:** revisões 1–4 construídas e verificadas.

## Próximo (2026-11-11)

**Trilha da v0.1** (PD-32, PD-33; [tasks](features/mvp-filas/tasks.md#trilha-da-v01-2026-11-11)): v0.1 do sistema real, rodando local com dados de exemplo (ainda não pronta para produção), em fatias verticais: 0 Base → 1 Pública básica → 2 Na unidade → 3 Triagem → 4 Privada → 5 Pré-cadastro → roteiro.

- **Fase 1A** concluída, com a revisão final e as correções (domínio, 234 testes).
- **Fase 1B:** Tasks 1–10 prontas. As Tasks 15–18 entram na fatia 0; 11–14 ficam para depois da v0.1.
- **Fase 2:** Tasks 1–8 prontas e juntadas (fatia 0, Task 1).
- **Fatia 0 concluída (2026-11-12):** Tasks 1–20 em `feat/v0.1`, em modo rápido (sem revisão por task; ver V1–V5 em [decisoes-para-revisar](features/mvp-filas/decisoes-para-revisar.md#fatia-0-da-v01-execução-rápida-2026-11-12)). API 159 testes, painel 54, schemas 57. `npm run dev:seed` + `npm run dev` → `http://exemplo.localhost:3000/login` (senha `exemplo123`). Verificado por HTTP (login, telas respondendo, re-semear com a API no ar); falta o clique no navegador do Step 5 da Task 20.
- **Revisão da fatia 0 (2026-11-12, feedback do usuário):** endereço estruturado + CNES da unidade; [discovery de papéis](features/mvp-filas/discovery-papeis-ubs.md) → perfis viraram ocupação por unidade + funções de gestão (SMS, Regulação, Gerente da UBS) + permissão "Agendar"; RN-PERF-04 (quem cadastra quem) e RN-PERF-05 (risco é do enfermeiro). Provisórios E1–E6 em decisoes-para-revisar. Testes da API na porta 3334 (rodam com `npm run dev` no ar).
- **Próximo passo:** plano da fatia 1 (pública básica: fila do dia sobre `sessao`/`entrada`, abrir/encerrar sessão, app). Carregar os CARRY do ledger da fatia 0.

## Pendências fora do código

- **Parceiro do piloto:** há contatos, sem acordo. Pré-requisito de D4, D5, D6, D7, D9.
- **Discoveries:** D1 SSE no app, D2 notificação ao vivo, D3 TV smart (técnicos); D4 operação da UBS (com a entrevista de linha de base e a pergunta sobre conferência na chamada); D5 jurídico e LGPD; D6 regulação e CADSUS; D7 contratação; D8 validação clínica do questionário; D9 teste de uso do protótipo; D10 publicação nas lojas. Detalhes em [tasks](features/mvp-filas/tasks.md#discoveries-e-spikes).
- **Licença (AD-052):** AGPL-3.0 aplicada; falta CLA no GitHub e revisão do advogado (D5/D7).
- **Adiado:** extensão SISREG (risco vindo do SISREG, sem classificação própria): depois do piloto, junto com a integração da regulação (D6).

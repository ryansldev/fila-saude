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
- **Próximo passo:** executar o [plano da fatia 0](features/mvp-filas/plano-fatia-0-base.md) (20 tasks, aprovado em 2026-11-12, com PD-40 e PD-42 confirmadas), a partir da Task 1, pelo fluxo de agentes com revisão.

## Pendências fora do código

- **Parceiro do piloto:** há contatos, sem acordo. Pré-requisito de D4, D5, D6, D7, D9.
- **Discoveries:** D1 SSE no app, D2 notificação ao vivo, D3 TV smart (técnicos); D4 operação da UBS (com a entrevista de linha de base e a pergunta sobre conferência na chamada); D5 jurídico e LGPD; D6 regulação e CADSUS; D7 contratação; D8 validação clínica do questionário; D9 teste de uso do protótipo; D10 publicação nas lojas. Detalhes em [tasks](features/mvp-filas/tasks.md#discoveries-e-spikes).
- **Licença (AD-052):** AGPL-3.0 aplicada; falta CLA no GitHub e revisão do advogado (D5/D7).
- **Adiado:** extensão SISREG (risco vindo do SISREG, sem classificação própria): depois do piloto, junto com a integração da regulação (D6).

# STATE

Só o handoff entre sessões. Princípios: [constitution.md](constitution.md). Regras: [specs/](specs/). Decisões: [decisions.md](decisions.md). Checagem: `npm run specs:check`.

## Onde estamos (2026-11-10)

- **Branch** `docs/spec-mvp-ads` (sem push nem PR).
- **Specs reorganizadas** (AD-051, [discovery](discovery-estrutura-specs.md)): a antiga `features/mvp-filas/source.md` virou as specs por capacidade em `specs/`, as ADs saíram deste arquivo para `decisions.md` (AD-001..AD-051; PD-01..PD-31 no plan), e `scripts/specs-check.mjs` confere IDs, decisões substituídas e cobertura.
- **MVP:** `features/mvp-filas/` com `spec.md` (escopo e histórias), `plan.md` (PD-01..PD-31), `tasks.md` (47 tasks em 8 fases, TDD, discoveries D1–D10).
- **Protótipo:** revisões 1–4 construídas e verificadas.

## Próximo

1. **Fase 1A** (`packages/domain`, [plano](features/mvp-filas/plano-fase-1a-dominio.md)) em execução; as Tasks 11 (QR) e 12 (matriz de permissões) são pré-requisito da Task 17 da 1B.
2. **Fase 1B** (T1.7–T1.9: multi-tenant, auth do paciente e do painel, permissões e auditoria): [plano-fase-1b-fundacao-api.md](features/mvp-filas/plano-fase-1b-fundacao-api.md), 18 tasks, decisões PD-14..PD-23. API em sequência; a Task 9 (CPF em `packages/schemas`) corre em paralelo.
3. **Fase 2** (T2.1–T2.6: painel, unidades, serviços, worker, sessões e séries, TV): [plano-fase-2-configuracao.md](features/mvp-filas/plano-fase-2-configuracao.md), 30 tasks, decisões PD-24..PD-31. `recorrencia`, `configuracao` e regras no domínio (Tasks 1–5), schemas (6) e a base do painel (7–8) podem começar já, em paralelo com a 1B; a API segue em sequência depois da 1B.
4. Em paralelo: roteiro da visita à unidade piloto juntando D4, D6 e D9.

## Pendências fora do código

- **Parceiro do piloto:** há contatos, sem acordo. Pré-requisito de D4, D5, D6, D7, D9.
- **Discoveries:** D1 SSE no app, D2 notificação ao vivo, D3 TV smart (técnicos); D4 operação da UBS (com a entrevista de linha de base e a pergunta sobre conferência na chamada); D5 jurídico e LGPD; D6 regulação e CADSUS; D7 contratação; D8 validação clínica do questionário; D9 teste de uso do protótipo; D10 publicação nas lojas. Detalhes em [tasks](features/mvp-filas/tasks.md#discoveries-e-spikes).
- **Licença (AD-052):** AGPL-3.0 aplicada; falta CLA no GitHub e revisão do advogado (D5/D7).
- **Adiado:** extensão SISREG (risco vindo do SISREG, sem classificação própria): depois do piloto, junto com a integração da regulação (D6).

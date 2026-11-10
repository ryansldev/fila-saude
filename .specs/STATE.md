# STATE

Só o handoff entre sessões. Princípios: [constitution.md](constitution.md). Regras: [specs/](specs/). Decisões: [decisions.md](decisions.md). Checagem: `npm run specs:check`.

## Onde estamos (2026-11-10)

- **Branch** `docs/spec-mvp-ads` (sem push nem PR).
- **Specs reorganizadas** (AD-051, [discovery](discovery-estrutura-specs.md)): a antiga `features/mvp-filas/source.md` virou as specs por capacidade em `specs/`, as ADs saíram deste arquivo para `decisions.md` (AD-001..AD-051; PD-01..PD-13 no plan), e `scripts/specs-check.mjs` confere IDs, decisões substituídas e cobertura.
- **MVP:** `features/mvp-filas/` com `spec.md` (escopo e histórias), `plan.md` (PD-01..PD-13), `tasks.md` (47 tasks em 8 fases, TDD, discoveries D1–D10).
- **Protótipo:** revisões 1–4 construídas e verificadas.

## Próximo

1. **Plano detalhado da fase 1:** `packages/domain` em TDD, formato PD-13 (resultado + eventos), com o **núcleo executável** (AD-051): transições, matriz de permissões e invariantes como dados em TS; cenários Dado/Quando/Então das specs viram os testes; tabelas das specs passam a ser geradas.
2. Em paralelo: roteiro da visita à unidade piloto juntando D4, D6 e D9.

## Pendências fora do código

- **Parceiro do piloto:** há contatos, sem acordo. Pré-requisito de D4, D5, D6, D7, D9.
- **Discoveries:** D1 SSE no app, D2 notificação ao vivo, D3 TV smart (técnicos); D4 operação da UBS (com a entrevista de linha de base e a pergunta sobre conferência na chamada); D5 jurídico e LGPD; D6 regulação e CADSUS; D7 contratação; D8 validação clínica do questionário; D9 teste de uso do protótipo; D10 publicação nas lojas. Detalhes em [tasks](features/mvp-filas/tasks.md#discoveries-e-spikes).
- **Adiado:** extensão SISREG (risco vindo do SISREG, sem classificação própria): depois do piloto, junto com a integração da regulação (D6).

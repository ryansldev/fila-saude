# Protótipo de validação

**Approved**: 2026-11-04 (rev. 1–4) - user: "Aprovado, pode construir"; rev. 4: "nao quero varias histórias, eu quero uma única que é o fluxo principal e mostra tudo"

## Problem Statement

Validar a ideia (AD-001) com gestores, recepção e pacientes: `prototype/` em HTML+CSS+JS (file://, estado em memória) mostra app do paciente, painel admin, estação e TV reagindo juntos, com regras da fonte `mvp-filas`.

## Out of Scope

Exceções P2, backend/login/push reais, mapa real, Document PiP, persistência entre recargas.

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Páginas | Apresentação + fluxo principal + modo livre (AD-008) | user | y |
| Relógio | Simulado ("+1/+5 min", "+1 dia", "Esperar até o próximo aviso") | Prazos reais não cabem na demo | y |
| Push / som | Aviso no celular; bipe Web Audio após "Iniciar painel" | Sem push real | y |
| Privacidade | Seletor "ver como" troca o paciente (INV-06) | Sem login | y |
| Regras | `prototype/js/engine.js` puro, testado com `node --test` | Testável | y |

**Open questions:** none.

## User Stories

Regras = fonte `mvp-filas` + AD-002..AD-010. Cada requisito:

- **PROTO-01 Simulador**: 4 telas lado a lado a ≥1280 px; cenários carregam dados e passos; relógio reavalia prazos; celular só com dados do "ver como".
- **PROTO-02 Lista de espera**: agenda da unidade; classificação 7.3; alarme → "Ligar 192" sem entrada; autolesão → CVV/SAMU e Urgente sugerido; 1 entrada ativa por serviço; encaminhamento bloqueia até aceito; "Nenhum" exclusivo.
- **PROTO-03 Alocação**: sugestão ordenada com motivos e alerta de faltas; nunca passa das vagas; conflito de 2º agendador; aviso 24 h e lista de ligação; recusa libera vaga, mantém data e não re-sugere quem recusou.
- **PROTO-04 Fila do dia**: abertura numera por data original; ETA; "saia de casa" 1×/etapa; QR atual/anterior; "Vou sair" mantém nº; RN-ORD-01/03/04; urgência → "venha agora"; chamada na TV 10 s com bipe; 3 pulos; balcão; pareamento TV; TV sem nomes.
- **PROTO-05 Apresentação**: visual da landing, roteiro que marca passos, sem animação/transição CSS.
- **PROTO-06 Posição e prioridade**: AD-002, AD-003, AD-004 (troca reordena na hora).
- **PROTO-07 Chamada**: AD-006; "Não compareceu" sempre habilitado com alguém chamado; "tolerância esgotada" aos 5 min.
- **PROTO-08 Triagem**: AD-007; "exige triagem" só muda sem sessão aberta; triado volta presente com mesma senha e nº; ETA da triagem + previsão da consulta separada (AD-009).
- **PROTO-09 Fluxo principal**: AD-008, em formato de lição (intro do passo → tela sozinha com destaque → "muito bem"); avisos de ação em tela cheia no celular; criar sessão pública/privada (vagas inteiro ≥1); demo nunca age pela protagonista; AD-010; resumo de tempo na unidade × em casa; estação com chamado não fecha.

Edge: estação sem elegível chama ninguém; remoto nunca é chamado (INV-03).

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PROTO-01 | Simulador | Execute | Verified |
| PROTO-02 | Lista de espera | Execute | Verified |
| PROTO-03 | Alocação | Execute | Verified |
| PROTO-04 | Fila do dia | Execute | Verified |
| PROTO-05 | Apresentação | Execute | Verified |
| PROTO-06 | Posição e prioridade | Execute | Verified |
| PROTO-07 | Chamada | Execute | Verified |
| PROTO-08 | Triagem | Execute | Verified |
| PROTO-09 | Fluxo principal | Execute | Verified |

## Checks

**Build**: `node --check prototype/js/engine.js && node --check prototype/js/scenarios.js && node --check prototype/js/app.js`
**Run engine**: `node --test prototype/tests/engine.test.js`

C1–C26, C29–C31, C34–C38, C40–C45: Proof = run engine, teste de mesmo nome em `proofs.md`.
C27, C28, C32, C39: Proof = walk (Chrome headless; `fluxo.html` em formato de lição, 10 passos com abertura e final, termina clicando só `.hint` e só "Pular", sem erro de console nem rolagem horizontal a 1280 e 390 px).
C33: Proof = `! grep -rnE "animation|transition|@keyframes" prototype/css`

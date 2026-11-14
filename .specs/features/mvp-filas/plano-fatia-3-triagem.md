# Fatia 3 da v0.1 — Triagem

> Modo rápido, como as fatias 1 e 2: execução direta na sessão principal, TDD com um arquivo de teste por recurso e só os casos principais, sem revisão por task. Atalhos em [decisoes-para-revisar](decisoes-para-revisar.md#fatia-3-da-v01-2026-11-14).

**Goal:** num serviço que exige triagem, a estação de triagem chama primeiro; o enfermeiro vê o risco sugerido pelo app e a prioridade declarada, classifica pelas cores do Acolhimento com Classificação de Risco (AD-056) e o paciente entra na fila do atendimento com a mesma senha e um número novo (RN-TRI-04). Vermelho encaminha à emergência e tira da fila. O app mostra a triagem feita e a nova posição; quem está presente e piorou vê "meus sintomas pioraram" (RN-PIORA-01).

**Tasks do backlog:** T6.1 (sem RN-TRI-06, que é proposta para o piloto). CARRY da fatia 0: RN-PIORA-01 (só a orientação no app).

**Architecture:** o domínio já passa da triagem para o atendimento (`encerrarChamado` com `riscoConfirmado`). Esta fatia acrescenta o vermelho no domínio, leva a classificação pelos comandos `chamar` e `finalizar` da estação (corpo `{ riscoConfirmado }`), grava `entrada.risco_confirmado` a partir do evento `risco_confirmado` (INV-07) e exige a classificação para fechar um chamado na triagem. A operação da estação de triagem passa a trazer o que o enfermeiro precisa: risco sugerido, a regra que o gerou, prioridade declarada e o alerta de autolesão (RN-RISCO-06). Estação de triagem com vários serviços (RN-TRI-02): a API escolhe, entre as sessões abertas da estação, a que tem o primeiro elegível com melhor ordem.

## Decisões desta fatia (provisórias, ver H1–H6)

| ID | Decisão | Custa se errado |
| --- | --- | --- |
| H1 | ~~ACCR de 4 cores~~ → **Manchester padrão, 5 cores** (AD-058, sua decisão) | — |
| H2 | **Vermelho na triagem** fecha a triagem como atendida e não vai ao atendimento (entrada concluída), com evento `encaminhado_emergencia` na auditoria | Médio: se a unidade atende a emergência ali mesmo, falta um "chamar já" |
| H3 | **Classificar é obrigatório** para "Finalizar" ou "Chamar próximo" com alguém chamado na triagem (`422 classifique_o_risco`); "Não compareceu" não pede | Baixo |
| H4 | Triagem com vários serviços: entre as sessões, vence urgência confirmada, risco e prioridade; empate vai para quem está presente há mais tempo (senão, a sessão que abriu antes) | Médio: números de sessões diferentes não se comparam |
| H5 | O app **não mostra a cor** confirmada ao paciente; mostra "triagem feita" e a posição no atendimento | Baixo |
| H6 | RN-PIORA-01 só como orientação no app (avisar a recepção ou a enfermagem, 192); reclassificar no balcão fica para a fatia de recepção | Baixo |

## Tasks (TDD em todas: teste vermelho → código → verde → commit)

1. **Domínio:** vermelho na triagem encaminha à emergência (H2).
2. **API — classificar:** `chamar` e `finalizar` aceitam `{ riscoConfirmado }`; obrigatório na triagem (H3); grava `entrada.risco_confirmado`; a operação da estação de triagem traz sugerido, regra, prioridade e autolesão.
3. **API — triagem com vários serviços** (RN-TRI-02, H4).
4. **Painel:** na estação de triagem, quatro botões de cor com o sugerido marcado como "sugerido pelo app"; "Finalizar" e "Chamar próximo" pedem a cor; vermelho pede confirmação.
5. **App:** trilha mostra a triagem feita e a posição no atendimento; "meus sintomas pioraram" para quem está presente (H6).
6. **Seed e roteiro:** serviço "Clínico geral" com triagem, estação "Acolhimento" e "Consultório 1", sessão aberta hoje com pacientes; trecho da fatia 3 no roteiro.

## Fora desta fatia

Triagem cadenciada (RN-TRI-06), reclassificar no balcão (RN-PIORA-01 completa), sessões privadas e agendador (fatia 4).

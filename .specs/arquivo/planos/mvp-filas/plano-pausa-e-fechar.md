# Plano: pausa, fechar a estação e o alerta de sinal

> Combinado na conversa de 2026-11-24 (QP2 e QP6 da AD-076). Domínio na `main` (PR #42); o resto em fatias na branch `feat/pause-and-close` (2026-11-25; uma branch só, sem branches filhas, 2026-11-26).

## Por quê

Hoje a estação da sessão está sempre "aberta": não existe pausar nem fechar. Quando a enfermeira fecha a aba para almoçar, o sistema não sabe se ela foi almoçar, se foi embora ou se a internet caiu, e numa unidade sem TV trata tudo como queda (QP6). E ninguém na unidade fica sabendo que a TV ou uma estação perdeu o sinal (QP2).

## O que você decidiu

- **A pausa nunca pega ninguém a caminho.** Ou ela é planejada na sessão, ou é avisada na hora e só começa depois do prazo de chegada (30 min, o da unidade).
- **O horário da sessão é um conjunto de faixas** (ex.: 09:00 às 12:00 e 13:00 às 18:00); o vão entre duas faixas é a pausa planejada de todas as estações. Faixas que se sobrepõem são recusadas.
- **A pausa é por estação.** A fila da etapa só para quando todas as estações dela estão em pausa. A pausa planejada da sessão vale para todas.
- **A hora de volta é opcional.** Com ela, o app mostra "pausa para o almoço, volta às 13:00".
- **Fechar** é a estação deixar de atender nesta sessão (o médico foi embora). Pode reabrir, e a reabertura fica na auditoria.
- **Alerta (QP2):** uma faixa no painel quando a TV ou uma estação perde o sinal.

## Regras novas (RN-EST-06, RN-EST-07 e RN-SES-06 na spec de chamada; AD-077)

**Pausa avisada (estação).** O profissional toca **Pausar**, escolhe a volta (opcional: 30 min, 1 h ou um horário) e a pausa começa depois do prazo de chegada da unidade. Até lá, a estação segue chamando quem está na unidade ou a caminho. Se a etapa ficaria sem estação chamando durante a pausa, deixa de sair "venha agora" e "saia de casa" para quem chegaria nela. **Voltar** encerra a pausa na hora. Não pausa com paciente chamado (como fechar, RN-EST-05).

**Horário em faixas (sessão).** Ao criar ou editar a sessão (e a série), o horário é uma lista de faixas "das … às …"; "adicionar horário" põe mais uma linha. Uma faixa só é o caso de hoje. A sessão abre na primeira faixa e encerra depois da última; no vão entre duas faixas, todas as estações estão em pausa, com o aviso antes automático (a mesma regra da pausa avisada).

**Fechar e reabrir (estação).** **Fechar** tira a estação da sessão de hoje: não chama, não conta na estimativa nem na queda. **Reabrir** a devolve. Não fecha com paciente chamado (RN-EST-05).

**Estimativa (RN-ETA).** A pausa conta no tempo: se a vez da pessoa cai depois do início da pausa, soma a duração (ou, sem hora de volta, o app diz "a unidade está em pausa" em vez do tempo). Estação fechada sai da conta das estações.

**Queda (QP6).** Silêncio de estação em pausa ou fechada não é queda. "Ninguém chamando" passa a ser: nenhuma estação aberta e fora de pausa.

**Alerta (QP2).** Faixa no painel (recepção, admin e estações da unidade): "TV sem sinal há 5 min", "Consultório 2 sem sinal há 3 min" (estação aberta e fora de pausa). Some quando o sinal volta.

## Fatias (TDD em cada uma)

O domínio entrou na `main` (PR #42). O resto vai em fatias pequenas e **ponta a ponta** (API, painel e app no que couber, para testar clicando), em commits na branch `feat/pause-and-close`, que vai para a `main` no fim (uma PR só).

1. **Fechar e reabrir a estação.** Guardar no banco a estação fechada (`closedAt`, as paradas); rotas fechar e reabrir, com auditoria; no painel, **Fechar a estação** e **Reabrir** na estação. Só o caso com outra estação aberta (a fila segue).
2. **Fechar a última estação.** Com `closes_session` ou `closes_stage` (`closingConsequence`), o painel confirma e a rota, na mesma transação, fecha com `confirmed` e chama `close` ou `closeStage`. Reabrir a triagem roda `fillFromReserve`. Mensagens de `triage_closed` no balcão (painel) e na inscrição (app).
3. **Pausar agora e voltar.** Guardar a pausa da estação; rotas pausar e voltar, com auditoria; a varredura roda `advancePauses`; no painel, **Pausar** (com a volta: 30 min, 1 h ou um horário), "em pausa, volta às 13:00" e **Voltar agora**. "Finalizar e chamar o próximo" com a pausa começando não responde "ninguém aguardando".
4. **Pausa marcada e o app.** Com alguém a caminho, a pausa começa depois do prazo: no painel, a faixa "pausa às 12:30" e **Desmarcar a pausa**; no app, "pausa para o almoço, volta às 13:00" (ou "por tempo indeterminado") no cartão e no bilhete, com o tempo contando a pausa.
5. **Opção C.** Na hora da pausa, quem chegou no prazo sem ser chamado: o profissional escolhe atender antes ou pausar agora, e a pessoa recebe a justificativa por escrito e continua na frente (domínio, API, painel e app). Feita: na máquina de estados da pausa, com os estados "perguntando" e "atendendo antes".
6. **Horário em faixas.** A sessão com várias faixas na criação, na edição e na série (migração: cada sessão antiga vira uma faixa); no painel, "adicionar horário"; o vão entre faixas é o intervalo da sessão. Feita: os intervalos gravados com a sessão (`breaks`), "Adicionar horário" na criação, as faixas na lista do painel e no app; a edição no painel e a série ficaram de fora (HF3, HF4).
7. **Alerta de sinal (QP2).** A consulta da unidade traz os alertas; no painel, a faixa "TV sem sinal há 5 min", "Consultório 2 sem sinal há 3 min". Feita: a regra no domínio (`signal-alerts.ts`), `GET /v1/panel/units/:unitId/signal-alerts` (RN-SES-07) e a faixa no topo do painel, consultada a cada 30 s (AS1 a AS4).
8. **Limpeza.** QP6 e QP2 entram na AD-076; este plano vai para `.specs/arquivo/planos/mvp-filas/`; a branch vai para a `main`. Feita (2026-11-26).

Depois, numa branch própria: a urgência confirmada que não chega recebe 2 "venha agora" e sai da fila com falta (PA5).

## Fora deste plano

- A reconciliação na volta da queda e o aviso de encerrar (RN-CONT-02, RN-SES-04), que ficam para a T7.4.
- Push ao gestor no alerta de sinal.

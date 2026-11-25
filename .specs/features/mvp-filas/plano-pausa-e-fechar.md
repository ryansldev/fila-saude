# Plano: pausa, fechar a estação e o alerta de sinal

> Combinado na conversa de 2026-11-24 (QP2 e QP6 da AD-076). Vem depois do PR #37 (queda percebida), na branch `feat/station-pause`.

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

## Passos (TDD em cada um)

1. **Domínio.** `Station` ganha o estado da pausa (`pause: { from, until | null }`) e `open` passa a valer de verdade; a sessão passa de `start`/`end` a uma lista de faixas (`start`/`end` continuam como a primeira e a última, para quem já lê). Funções: `pause`, `resume`, `closeStation`/`reopenStation`; a estimativa e os avisos ("saia de casa", "venha agora") respeitam a pausa; `trackOutage` ignora estações em pausa ou fechadas. Contratos e specs.
2. **API.** Rotas da estação: pausar, voltar, fechar, reabrir (com auditoria). Sessão: as faixas na criação, na edição e na série (migração: cada sessão antiga vira uma faixa). O painel recebe os alertas de sinal na consulta da unidade. "Finalizar e chamar o próximo" com a pausa começando devolve ok sem chamado: a rota da estação olha a pausa da estação no dia devolvido e não responde "ninguém aguardando". `npm run docs:openapi`.
3. **Painel.** Estação: "Pausar" (com a volta), a faixa "pausa às 12:30" e "em pausa, volta às 13:00" com **Voltar**, "Fechar a estação" e **Reabrir**. Sessão: as faixas de horário, com "adicionar horário". A faixa de alerta de sinal. Tudo com os botões do kit.
4. **App.** "pausa para o almoço, volta às 13:00" no cartão e no bilhete; o tempo da estimativa conta a pausa. Com todas as estações da etapa fechadas, a estimativa diz `awaiting_start` (PE5): o app não pode mostrar "aguardando início".
5. **Limpeza.** QP6 e QP2 saem de `decisoes-para-revisar.md` e entram na AD-076; este plano vai para `.specs/arquivo/planos/mvp-filas/`.

## Fora deste plano

- A reconciliação na volta da queda e o aviso de encerrar (RN-CONT-02, RN-SES-04), que ficam para a T7.4.
- Push ao gestor no alerta de sinal.

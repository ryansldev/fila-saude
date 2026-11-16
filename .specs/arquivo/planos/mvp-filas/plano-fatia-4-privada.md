# Fatia 4 da v0.1 — Privada (lista de espera, alocação e confirmação)

> Modo rápido, como as fatias 1 a 3: execução direta na sessão principal, TDD com um arquivo de teste por recurso e só os casos principais, sem revisão por task. Atalhos em [decisoes-para-revisar](../../../features/mvp-filas/decisoes-para-revisar.md#fatia-4-da-v01-2026-11-16).

**Goal:** o paciente entra pelo app na lista de espera de um serviço da unidade (para si ou para outra pessoa, com o questionário). O agendador abre uma sessão privada no painel, vê a sugestão com os motivos e aloca. O paciente recebe "confirme sua consulta" e confirma ou recusa no app; o agendador também registra a resposta depois de ligar. Quem não responde aparece na lista de ligação, destacado depois de 24 h. Recusa libera a vaga; a sessão que abre libera as pendentes; quem confirmou entra na fila do dia como já acontece.

**Tasks do backlog:** T5.1, T5.3 e T5.4. Fora: T5.2 (requisição com foto), T5.5 (lista parada), T5.6 (serviço regulado).

**Architecture:** o domínio já tem tudo (`criarEntrada`, `sugerir`, `alocar`, `confirmar`, `recusar`, `listaDeLigacao`, `pendentesNaAbertura`, `refazerQuestionario`); a abertura (`abrirSessao`) já libera as pendentes. Esta fatia liga isso à API, ao painel e ao app. Alocar, confirmar e recusar rodam dentro de `naSessao` (trava da sessão, PD-43) e travam também a linha da entrada (`for update`), para que dois agendadores — ou agendador e paciente — não mexam na mesma vaga nem na mesma entrada ao mesmo tempo. O segundo recebe 409 com a sugestão atualizada. A outbox passa a aceitar avisos sem fila do dia (o "confirme" sai na alocação, sem item).

## Decisões desta fatia (provisórias, ver I1–I10)

| ID | Decisão | Custa se errado |
| --- | --- | --- |
| I1 | O app mostra a lista de espera na página da unidade: "serviços com lista de espera" (ativos e no modo livre) | Baixo |
| I2 | Serviço com requisição: o app explica "pede requisição; em breve pelo app" e a API recusa (`409 requisicao_em_breve`) até a T5.2 | Baixo |
| I3 | Vínculo e pré-cadastro (RN-LE-01) não são exigidos, como na inscrição pública, até a fatia 5 | Médio no piloto, nenhum na v0.1 |
| I4 | O alerta ao agendador é visual no painel: urgente sugerido não alocado fica no topo com selo "alerta", e a tela mostra a contagem por serviço. Sem push nem e-mail para a equipe | Baixo |
| I5 | "Remover" na alocação é registrar a recusa em nome do paciente (volta à lista com a data original e não é sugerido de novo para essa sessão); "trocar" é remover e alocar outro | Baixo |
| I6 | "Sem contato" (RN-CONF-02) só anota a tentativa (auditoria e "última tentativa" na lista de ligação); a alocação segue pendente | Baixo |
| I7 | Conflito entre agendadores: trava da sessão e da entrada; o segundo recebe `409` com a sugestão e os alocados atualizados | Baixo |
| I8 | Push "confirme": "confirme sua consulta" + serviço, unidade, dia e hora, sem sintoma; chave por entrada e sessão | Baixo |
| I9 | Refazer o questionário pelo app só para quem está na lista (aguardando, alocada ou confirmada), não no dia: no dia vale o "meus sintomas pioraram" (H6) | Baixo |
| I10 | Alerta de faltas pela pessoa atendida, sem a regra do titular (RN-ID-06) | Baixo |

## Tasks (TDD em todas: teste vermelho → código → verde → commit)

1. **API — entrar na lista pelo app:** `GET /municipios/:slug/unidades/:id/servicos` (serviços com lista); `POST /municipios/:slug/servicos/:id/entradas` com "para quem" e respostas, mesmas regras de CPF e limite da inscrição; duplicada devolve a existente (`409 duplicada` com `entradaId`); emergência `422`; regulado e requisição recusados (I2). `POST .../entradas/:id/questionario` refaz (I9).
2. **API — agendador:** permissão `alocar_confirmar_recusar_pelo_paciente`. `GET /painel/sessoes/:id/alocacao` (vagas, alocados com estado e prazo, sugestão com motivos, alerta de faltas e autolesão só para quem pode); `POST .../alocar` `{ entradaId }`; `POST /painel/entradas/:id/resposta` `{ resposta: confirmou | recusou | sem_contato }`; `GET /painel/unidades/:id/ligacao` (lista de ligação) e `GET /painel/unidades/:id/lista-espera` (por serviço, com alertas). Teste real com dois escritores concorrentes.
3. **API — paciente responde e push:** `POST /municipios/:slug/entradas/:id/confirmar` e `.../recusar` pela conta responsável; aviso "confirme" na outbox na alocação (I8); `minhas` passa o prazo de confirmação.
4. **Painel — estação do agendador:** item "Agendamento" no menu (com a contagem de alertas): lista de espera por serviço, sessões privadas futuras com vagas, a sugestão com motivos e "Alocar", os alocados com "Confirmou", "Recusou", "Sem contato", e a aba "Lista de ligação".
5. **App — entrar na lista e confirmar:** "serviços com lista de espera" na unidade → "para quem" → questionário → "você está na lista"; no card, "confirme até …" com "Vou" e "Não vou poder"; "refazer questionário" para quem está na lista.
6. **Seed e roteiro:** pacientes na lista (um urgente), sessão privada amanhã sem alocação e outra com uma alocação pendente há mais de 24 h; trecho da fatia 4 no roteiro executado por HTTP.

## Fora desta fatia

Requisição com foto (T5.2), lista parada (T5.5), serviço regulado (T5.6), remanejados ("Outra data" pelo app), pré-cadastro e vínculo (fatia 5).

# Estação: pausa, fechar e alerta de sinal; sessão em faixas de horário

> Desenho aprovado na conversa de 2026-11-24 ("tá ok agora, ao menos de começo"). Protótipo em `.superpowers/brainstorm/pausa/estacao-pausa.html` (fora do git). Regras em [plano-pausa-e-fechar](../mvp-filas/plano-pausa-e-fechar.md). Base: [estacao.md](estacao.md) e [design.md](design.md).

## Estação

- **Topo:** à direita, antes do cartão da estação, **Pausar** (`secondary`, compacto, ícone de café) e **Fechar a estação** (`dangerText`, compacto). Com paciente chamado, os dois desligados com a dica "finalize o atendimento antes".
- **Pausar (painel lateral):** título "Pausar a estação"; caixa azul-clara com "A pausa começa às 12:32, daqui a 30 min: quem já está a caminho chega e é atendido. Até lá, chame normalmente." (sem ninguém a caminho: "A pausa começa agora"). "Volta (opcional)": segmentado **sem hora / 30 min / 1 h / horário**, e a frase "Volta às 13:32. O app mostra aos pacientes: …". Botões **cancelar** (`text`) e **Pausar às 12:32** ou **Pausar agora** (`primary`).
- **Pausa marcada:** faixa amarela com relevo no topo da estação: "Pausa às 12:32", "Chame normalmente até lá. Não sai mais 'venha agora' para quem chegaria durante a pausa.", pílula "volta às 13:32" e **desmarcar a pausa** (`text`).
- **Em pausa:** cartão branco com relevo no lugar de "Estação livre": ícone de café, "Em pausa", "Desde 12:32. A fila espera a sua volta; os pacientes veem 'pausa, volta às 13:32'.", pílula amarela "volta às 13:32" (vermelha "devia ter voltado às 13:32" depois da hora) e **Voltar agora** (`primary`). A fila (aguardando e a caminho) continua à vista.
- **Fechar:** confirmação "Fechar o Consultório 2?", "Ele não chama mais nesta sessão e sai da previsão de tempo dos pacientes. Use quando o atendimento desta sala acabou hoje. Dá para reabrir.", **cancelar** e **Fechar** (`danger`).
- **Fechada:** quadro tracejado "Consultório 2 fechado", "Fechado às 15:10. Não chama mais nesta sessão." e **Reabrir** (`secondary`).

## Antes de pausar: quem chegou no prazo (opção C)

Na hora da pausa, se alguém que estava a caminho chegou e não foi chamado: aviso na estação "**Bia Souza chegou no prazo e ainda não foi chamada.** Atender antes de pausar? A pausa começa quando você finalizar, e a volta passa para 13:47." com **atender a Bia** (`primary`) e **pausar agora** (`secondary`).

Justificativa para quem ficou para a volta (texto fixo, aprovado em 2026-11-24):

- Push, com volta: título "o consultório entrou em pausa"; texto "a equipe precisou pausar antes de chamar você. a sua vez vem logo na volta, às 13h32, respeitando as prioridades da lei. se precisar sair, esteja de volta até esse horário. obrigado pela paciência."
- Push, sem volta: "a equipe precisou pausar antes de chamar você. a sua vez vem logo quando o atendimento voltar, respeitando as prioridades da lei. avisamos por aqui quando for a hora. obrigado pela paciência."
- App (aba "hoje"), com volta: "**pausa antes da sua vez**", "a equipe do consultório precisou fazer uma pausa antes de chamar você. você não perdeu o lugar: a sua vez vem logo na volta, às 13h32, respeitando as prioridades da lei.", "se precisar sair, esteja de volta até esse horário. obrigado pela paciência."
- App, sem volta: o mesmo, com "a sua vez vem logo quando o atendimento voltar, respeitando as prioridades da lei." e "avisamos por aqui quando for a hora. obrigado pela paciência."
- "o consultório" é o nome da estação. Quem sai e volta atrasado segue as regras do "não compareceu" (2 chamados).

## Faixa de alerta de sinal (todas as telas do painel da unidade)

- TV: vermelha, "TV da recepção sem sinal há 5 min", "Os pacientes não veem as chamadas nem o QR. Confira se ela está ligada e com internet."
- Estação aberta e fora de pausa: amarela, "Consultório 1 sem sinal há 3 min", "A tela da estação está fechada ou sem internet. Se a sala parou, pause ou feche a estação."
- Várias ao mesmo tempo: uma faixa só ("TV da recepção e Consultório 1 sem sinal"). Some quando o sinal volta.

## Sessão: horário em faixas

"Horário de atendimento": linhas **Das / Às**, cada uma com **remover** (`dangerText`), e **adicionar horário** (`text`, ícone de mais). Com duas faixas ou mais, a caixa azul-clara "Pausa das 12:00 às 13:00: todas as estações param. A partir das 11:30 não sai 'venha agora' para quem chegaria na pausa." Faixa que começa antes da anterior acabar: erro na linha, "Este horário começa antes do anterior acabar (13:00)." Mesmo campo na série.

## App

Pílula amarela "em pausa"; título "pausa, volta às 13:32" (sem hora: "pausa por tempo indeterminado", deixando claro que não há hora de volta; você, 2026-11-24); a senha; a posição e o tempo, que soma a pausa ("5º na fila, cerca de 1 h 10 min"); "pode esperar em casa. avisamos a hora de sair." (sem hora: "sem hora de volta: avisamos quando a fila andar.").

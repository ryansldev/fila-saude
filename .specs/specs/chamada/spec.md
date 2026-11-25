# Chamada: estação, pulos, triagem, encerramento e faltas

Quem é chamado e em que ordem está em [fila-do-dia](../fila-do-dia/spec.md#ordem-de-chamada).

## Estação

**RN-EST-01 · Estação**
Cada consultório e sala de triagem é uma **estação**, ligada a uma etapa e a um ou mais serviços. O profissional faz login com o usuário dele e escolhe a estação.

**RN-EST-02 · Mini-janela**
A estação roda no navegador (Chrome ou Edge) e pode ser destacada numa **mini-janela flutuante** por cima do prontuário (Document Picture-in-Picture). Ela tem duas fases. Com a pessoa chamada, mostra a senha, o contador da tolerância e os botões **Rechamar**, **Não compareceu** e **Compareceu**. Depois do **Compareceu** (a pessoa entrou na sala), a tolerância para, Rechamar e Não compareceu saem, a triagem classifica o risco e ficam **Finalizar e chamar o próximo** e **só finalizar**; um **desfazer** volta à primeira fase.

**RN-EST-03 · Vários serviços**
QUANDO a estação atender mais de um serviço, "Chamar próximo" DEVE juntar os elegíveis desses serviços numa só ordem (RN-ORD). O profissional não escolhe o serviço.

**RN-EST-04 · Modo celular**
A mesma estação existe em modo celular ou tablet, com botão grande.

**RN-EST-05 · Sem pulo sozinho**
Ao fim da tolerância a estação avisa, mas não pula sozinha. Uma estação com paciente chamado não pode ser fechada. A estação envia sinal de vida (RN-SES-05).
*Decisões: AD-006, AD-043.*

**RN-EST-06 · Pausa avisada**
QUANDO o profissional tocar **Pausar** (sem paciente chamado), O SISTEMA DEVE marcar a pausa da estação, com a volta opcional. A pausa nunca pega ninguém a caminho: com alguém da etapa no prazo de chegada do "venha agora" (ou no prazo estendido por uma queda), ela começa depois do prazo da unidade (padrão 30 min), ou do prazo estendido, se for mais tarde; senão, agora. Quem já recebeu "venha agora" continua com ele. A volta é um horário ou minutos contados do início da pausa; volta antes do início é recusada. Com pausa marcada ou em curso, pausar de novo é recusado: para mudar, volte (ou desmarque) antes. A pausa que chega com paciente em atendimento começa quando ele sai, mantendo a volta marcada. Quem está a caminho não vê a pausa do consultório no tempo (só o intervalo da sessão). Com a unidade sem sinal (queda aberta ou por confirmar, RN-SES-05) não pausa: o prazo de quem vem pode crescer. Até lá a estação chama normalmente; na hora da pausa, "Finalizar e chamar o próximo" só finaliza. **Voltar agora** (ou **desmarcar a pausa**, antes de começar) tira a pausa; sem pausa (toque duplo, ou a volta já passou), não muda nada. QUANDO todas as estações abertas da etapa estiverem em pausa, ninguém chama: a estimativa soma o resto da pausa (sem hora de volta, fica sem tempo) e o "venha agora" não sai para quem chegaria (dentro do prazo) durante a pausa; o mesmo vale para uma pausa à frente. Antes de uma pausa à frente, a fila só anda com alguém para atender: com todos em casa, a partir do prazo de chegada do primeiro (ou da chegada de quem já está a caminho).
*Decisões: AD-077.*
- *Dado* Bia em casa recebeu "venha agora" às 12:00, *quando* o Consultório 2 toca Pausar às 12:02, *então* a pausa começa às 12:32 e a Bia é atendida antes dela.

**RN-EST-07 · Fechar e reabrir**
QUANDO o profissional tocar **Fechar a estação** (sem paciente chamado), a estação DEVE sair da sessão de hoje: não chama, não conta na estimativa nem na queda percebida (RN-SES-05). **Reabrir** a devolve (fechou por engano). As duas ações ficam na auditoria.
*Decisões: AD-077.*

## Chamar

**RN-CHAM-01 · Chamar próximo**
QUANDO o profissional clicar em **Chamar próximo**, O SISTEMA DEVE pegar o primeiro elegível da etapa e dos serviços daquela estação, mostrá-lo na TV e enviar push. A seleção é atômica: duas estações chamando ao mesmo tempo recebem pacientes diferentes (INV-04). Se a estação tinha um chamado aberto, ele é encerrado como finalizado antes. Sem ninguém elegível, o chamado anterior é encerrado do mesmo jeito e a estação fica livre com o aviso "ninguém aguardando no momento".

**RN-CHAM-02 · Encerrar a chamada**
Chamar o próximo encerra a chamada anterior como **atendido** (ou triado). **Rechamar** repete o anúncio sem reiniciar a tolerância. **Finalizar** encerra o atendimento atual sem chamar outro. Na triagem, encerrar exige o **Compareceu** (a classificação pede a pessoa na sala); no atendimento, encerrar sem ele marca o comparecimento na mesma hora.

**RN-CHAM-03 · Não compareceu**
Não há pulo automático: a tolerância (padrão 5 min) é só um contador que avisa "tolerância esgotada". QUANDO o profissional tocar **Não compareceu** (disponível a qualquer momento com alguém chamado), O SISTEMA DEVE:
- no 1º pulo do dia: a vez fica guardada; mantê-lo presente, tratado como se tivesse acabado de ficar elegível (atrás dos próximos K), e chamá-lo de novo;
- no 2º pulo do dia, somando as etapas, mesmo com urgência confirmada: tirá-lo da fila e registrar falta "não compareceu à chamada" (RN-FALTA-02). Ele pode entrar de novo na lista como entrada nova.

*Decisões: AD-006, AD-021, AD-076.*
- *Dado* Ana chamada com 0 pulos, *quando* o profissional toca "Não compareceu", *então* Ana fica presente atrás dos próximos K.
- *Dado* Ana com 1 pulo na triagem, chamada no consultório, *quando* é pulada de novo, *então* sai da fila com uma falta.

## Triagem

**RN-TRI-01 · Duas etapas**
Serviços com triagem têm duas etapas, triagem e atendimento, com as mesmas regras de presença, ordem e chamada.
*Decisões: AD-007.*

**RN-TRI-02 · Estação de triagem com vários serviços**
Uma estação de triagem pode atender vários serviços; junta os pacientes deles numa só ordem.

**RN-TRI-03 · Classificação na triagem**
Na triagem o profissional confirma ou reclassifica o risco pelas cinco cores do Manchester (vermelho, laranja, amarelo, verde, azul); essa passa a ser a classificação confirmada. Laranja (muito urgente) só vem da triagem e vem antes de amarelo. Vermelho põe a pessoa em 1º lugar no atendimento da unidade; encaminhar à emergência é uma ação à parte do enfermeiro, só com vermelho, e tira da fila da unidade.
*Decisões: AD-058, AD-059.*

**RN-TRI-04 · Depois da triagem**
O atendimento é uma fila nova: o paciente entra com a mesma senha e um número novo, atrás de quem já estava na fila do atendimento, dentro do seu nível de risco (confirmado pelo enfermeiro) e prioridade legal. Sem janela protegida e sem regra de atraso nessa passagem.
*Decisões: AD-056.*

**RN-TRI-05 · Sair entre etapas**
A regra de presença continua valendo entre as etapas: o paciente pode tocar "Vou sair" depois da triagem e recebe um novo "saia de casa" quando o atendimento se aproximar. Ao voltar, vale a regra de atraso.
*Decisões: AD-009, AD-076.*

**RN-TRI-06 · Triagem cadenciada (proposta)**
O sistema só sugere chamar para a triagem quem tem previsão de atendimento próxima, para que a triagem não vire uma segunda espera. Validar no piloto.

## Encerramento

Os estados da pausa da estação (gerado de `PAUSE_TRANSITIONS`):

<!-- gerado: contratos:chamada:pausa -->
| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| Sem pausa | Pausar | Sem paciente chamado; unidade com sinal; começa agora ou depois do prazo de quem está a caminho | Marcada | Volta opcional |
| Marcada | Hora da pausa com a estação livre | Na hora marcada, ou quando o atendimento em curso termina | Em pausa | Não chama mais |
| Marcada | A volta passa durante o atendimento | O atendimento começou antes da pausa e terminou depois da volta | Sem pausa | A pausa não aconteceu |
| Marcada | Desmarcar a pausa | — | Sem pausa | — |
| Em pausa | Voltar agora | — | Sem pausa | A pausa vira parada no histórico |
| Em pausa | Hora da volta | Com volta marcada | Sem pausa | A pausa vira parada no histórico |
| Marcada | Fechar a estação | — | Sem pausa | — |
| Em pausa | Fechar a estação | — | Sem pausa | A pausa vira parada no histórico |
<!-- /gerado -->

**RN-SES-06 · Horário em faixas**
O horário da sessão é uma lista de faixas sem sobreposição (ex.: 09:00 às 12:00 e 13:00 às 18:00); uma faixa só é o caso comum. A sessão abre na primeira e encerra depois da última. O vão entre duas faixas é uma pausa planejada de todas as estações, com as mesmas regras da RN-EST-06 (o "venha agora" para antes dela, sem ninguém pegar a pausa a caminho).
*Decisões: AD-077.*

**RN-SES-01 · Só o admin encerra**
A sessão só encerra quando o admin a encerra. No horário de fim, o painel lembra o admin.

**RN-SES-02 · Faltas e remanejados**
QUANDO a sessão for encerrada, O SISTEMA DEVE, para cada um ainda na fila:
- já foi **atendido** em alguma etapa do dia → remanejado, nunca faltoso;
- estava **presente** → remanejado;
- estava **remoto** e perdeu o prazo de chegada → falta, exceto se o prazo, com o relógio parado durante uma queda, registrada ou percebida pelo sistema, ainda não tinha acabado (remanejado, RN-CONT-03);
- os outros → remanejado.

*Decisões: AD-041, AD-033, AD-076.*
- *Dado* Luísa triada que tocou "Vou sair", *quando* a sessão encerra antes da consulta dela, *então* ela é remanejada, não faltosa.

**RN-SES-03 · Encerrar com chamado aberto**
O encerramento só é permitido quando nenhuma estação tem paciente chamado; o painel mostra as estações que precisam finalizar. Antes de encerrar, vale o aviso de sinal perdido (RN-SES-04).

## Faltas

**RN-FALTA-01 · Falta no encerramento**
É **falta** quando, no encerramento, o paciente confirmado, nunca atendido no dia, estava remoto e perdeu o prazo de chegada da etapa atual (RN-SES-02, com as exceções lá). Quem perde o prazo e depois é atendido no mesmo dia não leva falta. Quem leva a falta segue a RN-ID-06.
*Decisões: AD-040, AD-041, AD-076.*

**RN-FALTA-02 · Falta por pulos**
Sair da fila por 2 pulos no dia também conta no mesmo limite, com ou sem check-in. A recepção PODE anular essa falta quando o paciente comprova que estava na unidade; a anulação exige motivo, vai para a auditoria e para o relatório do gestor.
*Decisões: AD-021, AD-023.*

**RN-FALTA-03 · Sem bloqueio automático**
Não há bloqueio automático. QUANDO o paciente atingir o limite (padrão 2 em 90 dias), O SISTEMA DEVE alertá-lo e mostrar o aviso ao agendador ao alocá-lo.

## Transições

Entrada na fila do dia (por etapa):

<!-- gerado: contratos:chamada:item -->
| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| Presente | Estação chama o próximo | É o 1º de ordem(elegíveis) | Chamado | TV com som; push; inicia tolerância |
| Chamado | Rechamar | — | (mesmo) | Novo anúncio; tolerância não reinicia |
| Chamado | Compareceu | — | (mesmo) | Grava a entrada na sala; Rechamar e Não compareceu deixam de valer; a tolerância para |
| Chamado | Desfazer compareceu | Compareceu marcado | (mesmo) | Volta a esperar a pessoa entrar |
| Chamado | Estação chama o próximo ou toca Finalizar | — | Atendido na etapa | Há outra etapa: Presente nela, mesmo número. Senão: entrada Concluída |
| Chamado | Técnico finaliza o acolhimento na triagem | — | Presente | Volta à triagem como acolhida; quem classifica a chama antes dos outros (RN-PERF-05) |
| Chamado | "Não compareceu" | Pulos no dia = 0 | Presente | Pulos = 1; a vez fica guardada: aplica janela protegida |
| Chamado | "Não compareceu" | Pulos no dia = 1 | Saiu da fila | Pulos = 2; falta; entrada Encerrada sem atendimento; push |
| Qualquer não final | Sessão cancelada | — | Remanejado | Push |
| Remoto ou Presente | Sessão encerrada | Já atendido em etapa anterior | Remanejado | Push; não é falta |
| Presente | Sessão encerrada | Na unidade | Remanejado | Push (estava na unidade) |
| Remoto | Sessão encerrada | A vez não passou | Remanejado | Push |
| Remoto | Sessão encerrada | Perdeu o prazo de chegada; nunca atendido no dia; fora de contingência | Saiu da fila | Falta; entrada Encerrada sem atendimento |
<!-- /gerado -->

Entrada (lista):

<!-- gerado: contratos:chamada:entrada -->
| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| Na fila | Sessão encerrada com o paciente na unidade, já atendido em etapa anterior ou com o prazo de chegada perdido em contingência | — | Remanejada | Push |
| Na fila | 2º pulo, ou falta no encerramento | — | Encerrada sem atendimento | Registra ocorrência de falta |
| Na fila | Recepção: identidade não confere (RN-FILA-05) | — | Cancelada | Sem falta; motivo na auditoria |
<!-- /gerado -->

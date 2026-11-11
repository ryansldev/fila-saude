# Fila do dia: sessão, presença, ordem e estimativa

Só é chamado quem está presente. Entre os presentes vale a prioridade e depois a posição original, e os próximos K presentes não podem ser ultrapassados por quem acabou de ficar elegível, salvo urgência confirmada. Chamada, triagem, faltas e encerramento estão em [chamada](../chamada/spec.md).

## Sessão

Sessões nascem avulsas ou de uma série recorrente (RFC 5545: DTSTART/DTEND, RRULE, EXDATE, RDATE). Cada ocorrência é uma sessão com estado e configuração próprios.
*Decisões: AD-011, AD-014.*

<!-- gerado: contratos:fila-do-dia:sessao -->
| De | Evento | Quem / condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| — | Cria sessão | Admin | Planejada | — |
| Planejada | Horário de início chega, ou admin abre antes | Sistema / Admin | Aberta | Confirmadas entram na fila (RN-FILA-01); alocações pendentes e vagas seguras sem aceite liberadas |
| Planejada ou Aberta | Cancela | Admin | Cancelada | Entradas não finais, inclusive a chamada no momento, viram remanejadas (RN-REM), exceto "Na reserva", que é cancelada; push |
| Planejada | Serviço muda para "regulado" e a sessão é pública sem inscritos | Sistema | (mesmo, privada) | RN-ENC-07 |
| Aberta | Encerra | Admin; nenhuma estação com paciente chamado | Encerrada | Separa faltas e remanejados (RN-SES-02) |
| Planejada ou Aberta | Muda visibilidade | Admin; para pública, só se o serviço não é regulado | (mesmo) | RN-PUB-03 |
<!-- /gerado -->

## Abertura e entrada na fila

**RN-FILA-01 · Abertura**
QUANDO a sessão abrir (no horário de início, ou antes pelo admin), O SISTEMA DEVE pôr todos os confirmados **na fila remota**, com senha e **número** (posição original) pela ordem da data de entrada original (alocados) ou da hora da inscrição (sessão pública), da mais antiga para a mais nova.

**RN-FILA-02 · Entrada depois da abertura**
Quem entra depois da abertura (inscrição pública no dia, vaga da reserva, lançamento, balcão) recebe o próximo número livre, na hora em que entra.

**RN-FILA-03 · Balcão entra presente**
Paciente incluído pela recepção já entra como **presente**.

**RN-FILA-04 · Senha**
A senha tem o prefixo do serviço, é única na sessão (INV-05) e é a mesma em todas as etapas. O número também se mantém entre as etapas.

**RN-FILA-05 · Conferência antes de entrar na fila presencial**
QUANDO alguém com pendência ler o QR, O SISTEMA DEVE **recusar o check-in** e o app DEVE dizer "passe na recepção para confirmar seus documentos · você ainda não entrou na fila da unidade" (com o ID de atendimento, se for pré-cadastro). A pessoa continua **remota**, com o lugar que tinha. Pendências:
- (a) conta não verificada (em qualquer sessão, inclusive com dispensa de pré-cadastro), ou pessoa atendida que não é o dono da conta e ainda não foi conferida na unidade;
- (b) a unidade exige pré-cadastro, a sessão não o dispensa e o dele não foi validado;
- (c) prioridade legal declarada e não conferida.

A recepção confere a qualquer momento e, na mesma ação, **marca a presença** (ou a pessoa lê o QR de novo). A regra de atraso conta a partir dessa presença. Antes da chegada, o app avisa quem tem pendência: "na sua primeira ida, passe na recepção antes de ler o QR". Só a recepção confere; o profissional nunca confere documento.
*Decisões: AD-017, AD-018, AD-024, AD-054.*
- *Dado* Ana com conta nova que leu o QR, *quando* o check-in é recusado e ela vai ao balcão, *então* a recepção confere o documento e marca a presença num clique, e ela entra na fila presencial.
- *Dado* Pedro com pendência que foi embora depois de ter o check-in recusado, *quando* volta horas depois e é conferido, *então* a regra de atraso conta a partir de agora e ele vai para o fim se já chamaram quem vinha depois dele.

**RN-FILA-06 · Encerramento separa faltas e remanejados**
Ao encerrar, O SISTEMA DEVE separar quem faltou (RN-FALTA-01) de quem é remanejado (RN-SES-02).

## Presença

**RN-PRES-01 · Entrada pelo QR**
QUANDO o paciente ler o QR rotativo da TV, O SISTEMA DEVE marcá-lo presente. O QR é um token assinado que troca a cada 30 s; a validade é conferida pelo relógio do servidor, que aceita o código atual e o imediatamente anterior. Uma foto antiga não funciona; o relógio do celular não importa.

**RN-PRES-02 · "Vou sair"**
QUANDO o paciente tocar "Vou sair" no app, de qualquer lugar, O SISTEMA DEVE devolvê-lo a remoto mantendo a posição.

**RN-PRES-03 · Presença pela recepção**
A recepção PODE marcar presença para quem não tem app, não conseguiu ler o QR ou está validando o pré-cadastro. Para pessoa sem app, ela confere o documento e a pessoa vai direto para presente.
*Decisões: AD-035.*

**RN-PRES-04 · Esqueceu de sair**
Quem esqueceu de marcar a saída e não aparece à chamada é pulado pelo profissional com "Não compareceu" (RN-CHAM-03).

## Ordem de chamada

```
elegiveis = entradas da etapa, com presenca = PRESENTE,
            dos servicos atendidos pela estacao que chama

ordem (RN-ORD), aplicada a qualquer conjunto de entradas:
  1. urgencia confirmada primeiro
  2 e 3, na ordem configurada pelo municipio
     (padrao: risco antes; alternativa: prioridade legal antes):
     - nivel de risco vigente: urgente > atencao > rotina
       vigente = confirmado, se houver; senao, sugerido
     - prioridade legal: com prioridade > sem;
       entre idosos, 80+ antes de 60-79; entre grupos diferentes, empate
  4. numero (posicao original), o menor primeiro

chamar proximo = primeiro de ordem(elegiveis)

janela protegida (K, padrao 1):
  no instante em que X fica elegivel (check-in ou 1o pulo),
  os K primeiros de ordem(elegiveis) ficam travados a frente de X,
  mesmo que X venha antes deles na ordem.
  excecao: X tem urgencia confirmada.
  a trava acaba quando esses K forem chamados.

atraso (pela ordem real, nunca pelo numero):
  se, quando X fica elegivel, ja foi chamado nesta etapa alguem
  que vem depois de X em ordem (e, se X tocou "Vou sair",
  chamado enquanto X estava fora), X perdeu a vez:
  X recebe o proximo numero livre (vai para o fim).
  chamadas feitas num periodo de contingencia registrado
  nao contam para quem estava remoto (RN-CONT-03).
  excecao: X tem urgencia confirmada.

"a vez passou" (falta e remanejamento) =
  ja foi chamado, na etapa atual de X, alguem que vem depois de X em ordem
```
*Decisões: AD-004, AD-010, AD-033, AD-041.*

**RN-ORD-01 · Exemplo: janela protegida**
João está presente e é o próximo. Ana, que estava remota com posição igual ou melhor, faz check-in agora. João é chamado primeiro; Ana vem logo depois.

**RN-ORD-02 · "Venha agora"**
QUANDO um urgente confirmado estiver remoto, O SISTEMA DEVE enviar o aviso **"venha agora"** na hora, sem esperar o limite do "saia de casa".

**RN-ORD-03 · Exemplo: check-ins seguidos (K = 1)**
A ordem de inscrição é Bruno, Ana, João. João está presente e é o próximo. Ana faz check-in: ordem João, Ana. Bruno faz check-in a tempo: ordem **João, Bruno, Ana**. Bruno não furou a fila, porque sempre esteve à frente de Ana.

**RN-ORD-04 · Exemplo: atraso**
Se Bruno chega depois que Ana já foi chamada, ele perdeu a vez e vai para o fim dos presentes.

**RN-ORD-05 · Posição de quem está presente**
Como o app mostra a posição real (RN-ETA-04), a posição de quem está presente nunca piora quando alguém chega a tempo.

## Estimativa e aviso de saída

**RN-ETA-01 · Remoto**
Pessoas à frente = quantas entradas da mesma etapa e serviço vêm antes do paciente em ordem(todas), contando presentes e remotas e ignorando a elegibilidade. Tempo estimado = pessoas à frente × tempo médio da etapa (RN-ETA-05) ÷ estações abertas para aquele serviço e etapa.

**RN-ETA-01b · Presente**
Posição = lugar na ordem de chamada real entre os elegíveis da etapa e do serviço, já com a janela protegida. Tempo estimado = (posição − 1) × tempo médio da etapa ÷ estações abertas.
*Decisões: AD-002.*

**RN-ETA-01c · Com triagem**
Em serviços com triagem, quem ainda não foi triado vê o tempo até a **triagem** (é ele que dispara o "saia de casa") e, à parte, a previsão da consulta.
*Decisões: AD-009.*

**RN-ETA-02 · Sem estação aberta**
Sem estação aberta, o app mostra "aguardando início do atendimento" em vez de um tempo.

**RN-ETA-03 · "Saia de casa"**
QUANDO o tempo estimado de um paciente remoto até a etapa atual cair abaixo do limite da unidade (padrão 30 min), O SISTEMA DEVE enviar o push "saia de casa", uma vez por etapa. Suspenso em modo manual (RN-SES-05).
*Decisões: AD-009, AD-043.*

**RN-ETA-04 · O que o app mostra**
O paciente vê só a própria posição (RN-ETA-01 ou 01b) e o tempo estimado ("você é o 4º · ~12 min"), além dos contadores da TV. Remoto que já é o 1º, com estação aberta, vê **"venha agora"** em vez de "1º · ~0 min"; ele só é chamado depois de ler o QR.
*Decisões: AD-003.*

**RN-ETA-05 · Tempo médio (proposta de algoritmo)**
1. A duração de um atendimento é o intervalo entre a chamada do paciente e a próxima chamada na mesma estação. A última chamada do dia de cada estação não entra.
2. Pegam-se os últimos 10 atendimentos concluídos daquela etapa e serviço, no dia.
3. Descartam-se os fora da curva: abaixo de 1/3 ou acima de 3 vezes a mediana desses 10.
4. A média dos que sobraram é o tempo médio.
5. Com menos de 3 atendimentos válidos no dia, usa-se o tempo médio inicial do serviço.

## Transições

Entrada na fila do dia (por etapa):

<!-- gerado: contratos:fila-do-dia:item -->
| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| — | Sessão abre | Entrada confirmada | Remoto | Senha; número por RN-FILA-01 |
| — | Recepção inclui no balcão | Vaga livre; serviço não regulado | Presente | Senha anotada ou impressa; próximo número |
| Remoto | QR válido ou recepção marca | Sem pendência | Presente | Aplica janela protegida e regra de atraso |
| Remoto | QR válido | Com pendência (RN-FILA-05) | (mesmo) | Check-in recusado; app orienta "passe na recepção" |
| Remoto | Recepção confere e marca presença (inclui pessoa sem app) | Confere | Presente | Pendência resolvida; aplica janela protegida e regra de atraso |
| Remoto | Recepção confere a identidade, mas não a prioridade, e marca presença | — | Presente | Prioridade retirada; aplica janela protegida e regra de atraso |
| Remoto | Recepção recusa ("não conferiu"), com motivo | Identidade não confere | Saiu da fila | Sem remanejamento e sem falta; entrada Cancelada; pode bloquear a conta (RN-ID-03) |
| Presente | Paciente toca "Vou sair" | — | Remoto | Mantém o número |
| Remoto ou Presente | Paciente cancela | — | Saiu da fila | Vaga vai para a reserva, se houver |
<!-- /gerado -->

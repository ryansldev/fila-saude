# MVP — Sistema de Filas para UBS e Policlínicas Specification

**Approved**: 2026-11-04 - user: "essa é a spec MVP já ok"

## Problem Statement

Pacientes de UBS e policlínicas passam horas na fila física da unidade. O sistema troca essa fila por uma fila remota: o paciente espera em casa e só vai à unidade quando a vez estiver perto. O MVP cobre UBS e policlínicas; UPA existe no modelo, sem fluxo próprio.

**Princípios**: somos só a fila (sem prontuário); o humano decide (o sistema sugere com justificativa); presente tem preferência; urgência confirmada passa na frente; ninguém fica de fora (recepção cobre quem não tem app); um paciente nunca vê outro; um app, vários municípios.

## Goals

- [ ] Espera presencial abaixo de 10 minutos nas unidades piloto.
- [ ] Todo fluxo do paciente tem equivalente pela recepção (RNF-ACE-02).
- [ ] Piloto em uma unidade com triagem e uma sem triagem.

## Out of Scope

| Feature | Reason |
| --- | --- |
| WhatsApp (oficial ou não oficial) | Custo e burocracia; entra depois, com API oficial da própria prefeitura |
| SMS e segundo fator de login | Custo; login é CPF + senha |
| Dashboard de métricas para o gestor | Fase seguinte |
| Estimativa de tempo com IA | Fase seguinte; MVP usa tempo médio |
| Voz lendo a chamada na TV | Só som de aviso no MVP |
| Botão físico USB | Descartado |
| Integração com e-SUS PEC, SISREG ou regulação | Depende de terceiros |
| Prontuário e dados clínicos além do questionário | Não é nossa responsabilidade |
| Fluxo de UPA | Fase seguinte |
| Página pública da fila (fora da TV) | O app já cobre |
| Migrar entradas entre unidades na transferência | Reavaliar com uso real |

---

## Assumptions & Open Questions

A fonte marca como **proposta** as regras abaixo. Elas entram no MVP com o valor da fonte até a validação indicada.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Questionário v1 e regras de classificação (fonte 7.3) | Usar o v1 da fonte como está | Proposta; validar com enfermeiro ou médico antes do piloto | n |
| Peso entre prioridade legal e risco (RN-ORD, RN-AL-02) | Configuração do município: `risco antes` (padrão) ou `prioridade legal antes`, sempre abaixo da urgência confirmada (AD-004) | A área técnica de cada município decide; o padrão segue a fonte | y |
| Posição mostrada ao paciente presente (RN-ETA-04) | Posição na ordem de chamada real entre os presentes; tempo = (posição − 1) × média ÷ estações (AD-002) | RN-ETA-01 contava remotos à frente de quem já é o próximo a ser chamado | y |
| Remoto que já é o 1º (RN-ETA-04) | App mostra "venha agora" e que só é chamado após ler o QR (AD-003) | "1º · ~0 min" engana quem ainda não pode ser chamado | y |
| Pulo automático por tolerância (RN-CHAM-03, RN-EST-05) | Não existe: a tolerância é um contador; só o profissional pula ("Não compareceu") ou avança ("Chamar próximo") (AD-006) | O pulo automático pulava quem já estava em consulta | y |
| Aviso "saia de casa" antes da triagem (RN-ETA-01, RN-ETA-03, RN-TRI-05) | Um aviso por etapa: antes da triagem conta só a triagem; a previsão da consulta aparece separada (AD-009) | Com a soma, o paciente chegava perto da consulta e a regra RN-TRI-05 (sair depois da triagem e ser avisado de novo) não acontecia | y |
| "A vez passou" e regra de atraso (8.3, RN-ORD-04, RN-PRES-02) | Perde a vez só quem viu ser chamado alguém que vinha depois dele na ordem real, na mesma etapa (AD-010) | Pelo número, quem saiu perdia o lugar quando um urgente com número maior era chamado | y |
| Validade do encaminhamento | Agendador informa a data de vencimento ao aceitar | Fonte em aberto; é o caminho que não inventa prazo | n |
| Prazo de exclusão das fotos após inatividade (RNF-LGPD-04) | Fotos retidas enquanto o cadastro estiver ativo; exclusão a definir | Depende do jurídico; não bloqueia o protótipo | n |
| Algoritmo de tempo médio (RN-ETA-05) | Últimos 10 atendimentos, descarta fora de 1/3–3× a mediana, mínimo 3 válidos | Proposta da fonte | n |
| Triagem cadenciada (RN-TRI-06) | Sugerir triagem só para quem tem atendimento próximo | Proposta; validar com unidade piloto | n |
| Reativação de entrada arquivada (RN-PARADA-02) | Reativa mantendo a data original em até 30 dias | Proposta da fonte | n |
| 3 pulos contam como falta (RN-FALTA-02) | Conta no limite de faltas | Assumido na revisão da fonte | n |
| Destaque por chamada na TV (RN-TV-07) | 10 s | Assumido na revisão da fonte | n |
| Área de abrangência por endereço como vínculo | Fora do MVP; vínculo = cadastro validado | Fonte em aberto | n |
| Contingência sem sistema ou internet | Fora do MVP; unidade volta ao papel | Fonte em aberto; decidir antes do piloto | n |
| Hospedagem da camada municipal e custo | Decidir no design | Fonte em aberto; decisão de arquitetura | n |
| Antes de qualquer código, protótipo HTML+CSS+JS | Protótipo valida a ideia antes da implementação (AD-001) | Pedido do usuário | y |

**Open questions:** none - todas registradas acima; as marcadas `n` são propostas da fonte, a validar com especialistas antes do piloto, e não bloqueiam o protótipo.

---

## User Stories

Os códigos `RN-*`, `INV-*` e `RNF-*` remetem à fonte (seção Sources). As tabelas de contrato da fonte (9.3: sessão, lista de espera, fila do dia, invariantes e matriz de permissões) valem como critério de aceite: toda transição não listada é proibida e retorna erro.

### P1: Ver unidades e agenda (US-01) ⭐ MVP

**User Story**: Como paciente, quero ver as unidades próximas e o que cada uma oferece.

**Why P1**: É a porta de entrada do app.

**Acceptance Criteria**:

1. WHEN o paciente que concedeu localização abre o app THEN o app SHALL mostrar no mapa as unidades dos municípios cadastrados ao redor dele.
2. WHEN o paciente toca numa unidade THEN o app SHALL mostrar o horário de funcionamento e as sessões futuras com serviço, dia, visibilidade e vagas restantes (ex.: "Terça, 12/11 · Cardiologia · privada · 20 vagas") (RN-AG-01).
3. The app SHALL nunca mostrar nomes ou dados de outros pacientes (RN-AG-02, INV-06).

**Independent Test**: Abrir o app, tocar numa unidade e ver a agenda sem nenhum dado de paciente.

---

### P1: Entrar na lista de espera (US-02) ⭐ MVP

**User Story**: Como paciente, quero entrar na lista de um serviço informando o que sinto.

**Why P1**: Sem entrada na lista não há alocação nem fila.

**Acceptance Criteria**:

1. WHEN o paciente que cumpre RN-LE-01 responde o questionário THEN o sistema SHALL criar a entrada com o nível sugerido calculado pelas regras de classificação da fonte (7.3).
2. IF o paciente já tem entrada ativa no serviço THEN o app SHALL recusar a nova entrada e mostrar a existente (RN-LE-02, INV-01).
3. IF o paciente marca qualquer item da Tela 1 exceto pensamentos de tirar a própria vida THEN o sistema SHALL não criar a entrada e o app SHALL mostrar o botão para ligar 192.
4. IF o paciente marca pensamentos de tirar a própria vida ou de se machucar THEN o app SHALL mostrar CVV (188) e SAMU (192) em destaque e SHALL permitir seguir, criando a entrada como Urgente sugerido com alerta ao agendador.
5. IF a unidade exige vínculo e o paciente não tem pré-cadastro validado nela THEN o sistema SHALL recusar a entrada (RN-LE-01).
6. The sistema SHALL gravar a data de entrada original, que nunca muda (RN-LE-03, INV-09).
7. WHEN o paciente refaz o questionário e o nível sobe para urgente THEN o painel SHALL alertar o agendador (RN-RISCO-03).
8. The sistema SHALL guardar a prioridade legal declarada como eixo separado do risco, corrigível pela recepção (RN-RISCO-04).

**Independent Test**: Entrar num serviço com respostas de rotina, tentar entrar de novo, e repetir marcando um sinal de alarme.

---

### P1: Enviar encaminhamento (US-03) ⭐ MVP

**User Story**: Como paciente, quero enviar a foto do encaminhamento quando o serviço exige.

**Why P1**: Serviços especializados não alocam sem encaminhamento.

**Acceptance Criteria**:

1. WHERE o serviço exige encaminhamento the app SHALL pedir a foto da requisição na entrada e criar a entrada em "Aguardando encaminhamento" (RN-ENC-01).
2. WHEN o agendador aceita ou rejeita o encaminhamento com motivo THEN o paciente SHALL receber push com o resultado (RN-ENC-02).
3. IF o encaminhamento está pendente, rejeitado ou vencido THEN o sistema SHALL não permitir alocar a entrada (RN-ENC-03).

**Independent Test**: Entrar em cardiologia com foto, aceitar no painel e ver a entrada passar a "Aguardando".

---

### P1: Alocar pacientes (US-04) ⭐ MVP

**User Story**: Como agendador, quero preencher as vagas de uma sessão privada.

**Why P1**: É o caminho principal das sessões privadas.

**Acceptance Criteria**:

1. WHEN o agendador abre uma sessão privada THEN o painel SHALL mostrar a sugestão ordenada por urgência confirmada, remanejados, e depois nível de risco vigente, prioridade legal e data de entrada original (RN-AL-02).
2. The sugestão SHALL mostrar os motivos de cada entrada (ex.: "urgente sugerido · idosa, 82 anos · espera há 41 dias") e o alerta de faltas quando houver (RN-AL-01, RN-AL-03).
3. The sistema SHALL não alocar nenhuma entrada sem ação do agendador (RN-AL-04, INV-08).
4. WHEN o agendador confirma a alocação THEN cada paciente SHALL receber push e o prazo de confirmação de 24 h SHALL começar (RN-CONF-01).
5. IF outro agendador alocou a mesma vaga antes THEN o painel SHALL mostrar erro e a lista atualizada (RN-PERF-02).
6. The sistema SHALL não permitir mais entradas não finais numa sessão do que suas vagas, por qualquer caminho (RN-AL-06, INV-02).
7. WHEN o agendador aloca THEN o agendador SHALL poder alterar o nível, que passa a confirmado (RN-RISCO-01, INV-07).

**Independent Test**: Abrir uma sessão com 3 vagas e 5 entradas, ver a sugestão com motivos e confirmar 3.

---

### P1: Confirmar a vaga (US-05) ⭐ MVP

**User Story**: Como paciente alocado, quero confirmar que vou.

**Why P1**: Sem confirmação a vaga é liberada na abertura.

**Acceptance Criteria**:

1. WHEN o paciente confirma no app antes da abertura THEN a entrada SHALL passar a Confirmada.
2. WHILE a alocação está pendente the painel SHALL listá-la na lista de ligação, ordenada pela sessão mais próxima, e destacá-la após 24 h sem resposta (RN-CONF-03).
3. WHEN o agendador registra confirmado, recusado ou sem contato depois de ligar THEN o sistema SHALL aplicar a transição correspondente (RN-CONF-02).
4. WHEN o paciente recusa THEN o sistema SHALL liberar a vaga, sugerir o próximo e devolver a entrada à lista com a data original (RN-CONF-04).
5. IF a sessão abre com a alocação ainda pendente THEN o sistema SHALL liberar a vaga e devolver a entrada à lista com a data original (RN-CONF-04).

**Independent Test**: Alocar, ver na lista de ligação, registrar confirmação pelo agendador.

---

### P1: Fila remota (US-06) ⭐ MVP

**User Story**: Como paciente confirmado, quero esperar em casa e saber quando sair.

**Why P1**: É a proposta central do produto.

**Acceptance Criteria**:

1. WHEN a sessão abre THEN cada confirmado SHALL entrar na fila remota com senha de prefixo do serviço e número na ordem da data de entrada original (RN-FILA-01, RN-FILA-04).
2. WHEN alguém entra depois da abertura THEN o sistema SHALL dar o próximo número livre (RN-FILA-02).
3. WHILE o paciente está na fila the app SHALL mostrar só a posição real e o tempo estimado (ex.: "você é o 4º · ~12 min"), calculados por RN-ETA-01 (RN-ETA-04).
4. WHILE não há estação aberta para o serviço e etapa the app SHALL mostrar "aguardando início do atendimento" em vez de um tempo (RN-ETA-02).
5. WHEN o tempo estimado de um paciente remoto cai abaixo do limite da unidade (padrão 30 min) THEN o paciente SHALL receber o push "saia de casa", uma vez por etapa (RN-ETA-03).

**Independent Test**: Abrir sessão com 5 confirmados e ver a posição e o tempo de cada um; avançar chamadas até disparar "saia de casa".

---

### P1: Check-in e saída (US-07) ⭐ MVP

**User Story**: Como paciente, quero marcar que cheguei e que saí.

**Why P1**: Só presente é chamado.

**Acceptance Criteria**:

1. WHEN o paciente lê o QR atual ou o imediatamente anterior da TV THEN o sistema SHALL marcá-lo presente (RN-PRES-01).
2. IF o QR lido é mais antigo que o imediatamente anterior THEN o sistema SHALL recusar o check-in.
3. WHEN o paciente toca "Vou sair" THEN o sistema SHALL voltá-lo para remoto mantendo o número (RN-PRES-02).
4. IF a unidade exige pré-cadastro e o do paciente não foi validado THEN o check-in SHALL deixá-lo "presente, aguardando validação", não elegível, e o app SHALL mostrar "passe na recepção com seu ID de atendimento" (RN-FILA-05).
5. WHEN a recepção marca presença THEN o sistema SHALL tratá-lo como check-in (RN-PRES-03).

**Independent Test**: Check-in com QR atual, tentativa com QR velho, "Vou sair" e conferir o número.

---

### P1: Janela protegida e atraso (US-08) ⭐ MVP

**User Story**: Como paciente presente, não quero ser ultrapassado por quem acabou de chegar.

**Why P1**: É a regra "presente tem preferência".

**Acceptance Criteria**:

1. WHEN X fica elegível (check-in, validação ou 1º pulo) THEN o sistema SHALL travar os K primeiros elegíveis à frente de X até serem chamados, exceto se X tem urgência confirmada (8.3).
2. WHEN João está presente e é o próximo e Ana faz check-in com posição melhor e mesma prioridade THEN o sistema SHALL chamar João e depois Ana (RN-ORD-01).
3. WHEN a ordem de inscrição é Bruno, Ana, João, João está presente, Ana faz check-in e depois Bruno faz check-in a tempo THEN a ordem SHALL ser João, Bruno, Ana (RN-ORD-03).
4. IF, quando X fica elegível, alguém com número maior que o de X já foi chamado na etapa THEN o sistema SHALL dar a X o próximo número livre, exceto se X tem urgência confirmada (RN-ORD-04).
5. The sistema SHALL chamar só elegíveis; remoto nunca é chamado (INV-03).

**Independent Test**: Reproduzir os exemplos RN-ORD-01, 03 e 04 e conferir a ordem.

---

### P1: Urgência confirmada (US-09) ⭐ MVP

**User Story**: Como paciente com caso urgente confirmado, quero passar à frente.

**Why P1**: Saúde em primeiro lugar.

**Acceptance Criteria**:

1. WHILE o paciente tem urgência confirmada the sistema SHALL ordená-lo antes de todos e acima da janela protegida.
2. WHEN a urgência é confirmada para um paciente remoto THEN o paciente SHALL receber o push "venha agora" imediatamente (RN-ORD-02).
3. The sistema SHALL gravar nível confirmado só por agendador ou triagem (INV-07).

**Independent Test**: Triagem confirma urgente para um remoto; ver "venha agora" e a posição 1 no check-in.

---

### P1: Chamar o próximo (US-10) ⭐ MVP

**User Story**: Como profissional, quero chamar o próximo sem sair do prontuário.

**Why P1**: É a operação do consultório.

**Acceptance Criteria**:

1. WHEN o profissional clica em Chamar próximo THEN o sistema SHALL chamar o primeiro de ordem(elegíveis) da etapa e dos serviços da estação, mostrá-lo na TV com som e enviar push (RN-CHAM-01).
2. WHEN o profissional chama o próximo THEN a chamada anterior SHALL ser encerrada como atendida (ou triada) (RN-CHAM-02).
3. WHEN o profissional clica em Rechamar THEN a TV SHALL repetir o anúncio sem reiniciar a tolerância.
4. WHEN o profissional clica em Finalizar THEN o sistema SHALL encerrar o atendimento atual sem chamar outro.
5. IF duas estações chamam ao mesmo tempo THEN cada uma SHALL receber um paciente diferente (RN-CHAM-01, INV-04).
6. WHERE a estação atende mais de um serviço the sistema SHALL juntar os elegíveis desses serviços numa só ordem (RN-EST-03).
7. WHERE o navegador suporta Document Picture-in-Picture the estação SHALL abrir numa mini-janela flutuante com a próxima senha e os botões Finalizar, Chamar próximo e Rechamar (RN-EST-02).

**Independent Test**: Duas estações chamando em sequência; TV mostra cada senha com destino.

---

### P1: Tolerância de chamada (US-11) ⭐ MVP

**User Story**: Como unidade, quero que quem não aparece não trave a fila.

**Why P1**: Sem isso a fila para.

**Acceptance Criteria**:

1. WHEN o chamado não se apresenta na tolerância (padrão 5 min) ou o profissional pula THEN o sistema SHALL marcá-lo como pulado (RN-CHAM-03, RN-EST-05).
2. WHEN é o 1º pulo do dia THEN o paciente SHALL continuar presente, chamado depois dos próximos K.
3. WHEN é o 2º pulo do dia THEN o paciente SHALL voltar para remoto e receber push.
4. WHEN é o 3º pulo do dia, somando as etapas THEN o paciente SHALL sair da fila com ocorrência "não compareceu à chamada".

**Independent Test**: Pular o mesmo paciente três vezes e conferir o estado após cada pulo.

---

### P1: Balcão (US-12) ⭐ MVP

**User Story**: Como recepção, quero incluir quem não tem app.

**Why P1**: Ninguém fica de fora.

**Acceptance Criteria**:

1. WHEN a recepção inclui o paciente no balcão THEN o sistema SHALL colocá-lo presente com senha e o próximo número (RN-FILA-03).
2. WHEN a recepção inclui no balcão THEN o painel SHALL aplicar o mesmo questionário, e IF o resultado é emergência THEN o painel SHALL orientar encaminhar à emergência (RN-RISCO-02).
3. IF a sessão não tem vaga livre THEN o sistema SHALL recusar a inclusão (INV-02).
4. WHEN a recepção cria entrada na lista para quem não tem app THEN o sistema SHALL criá-la como se fosse pelo app (RN-LE-04).

**Independent Test**: Incluir no balcão e ver a senha chamada na TV.

---

### P1: Pareamento da TV (US-13) ⭐ MVP

**User Story**: Como admin, quero ligar a TV da sala de espera à unidade.

**Why P1**: A TV mostra chamadas e o QR de entrada.

**Acceptance Criteria**:

1. WHEN a TV abre `/tv` sem pareamento THEN a TV SHALL mostrar um código de 6 dígitos e nada da unidade (RN-TV-01, RN-TV-02).
2. WHEN o admin digita o código no painel THEN a TV SHALL exibir chamadas, contadores por serviço e o QR de entrada da unidade.
3. WHEN o admin revoga a TV THEN a TV SHALL voltar à tela de pareamento.
4. The TV SHALL mostrar só senhas e contadores, nunca nomes (RN-TV-05, INV-06).
5. WHEN duas chamadas chegam ao mesmo tempo THEN a TV SHALL destacar cada uma por 10 s e depois movê-la para "últimas chamadas" (RN-TV-07).
6. WHEN a TV abre THEN a TV SHALL exigir o toque em "Iniciar painel" para liberar o som, e depois tocar um aviso a cada chamada (RN-TV-04).

**Independent Test**: Parear com código, chamar uma senha, revogar.

---

### P2: Pré-cadastro (US-14)

**User Story**: Como paciente, quero fazer meu cadastro na unidade uma vez só.

**Why P2**: Necessário em unidades que exigem vínculo.

**Acceptance Criteria**:

1. WHEN o paciente envia dados, foto do documento com foto e foto do Cartão SUS THEN o sistema SHALL gerar um ID de atendimento de 6 caracteres e um QR (RN-PRE-01, RN-PRE-02).
2. WHEN a recepção confere a pessoa com o documento e marca validado THEN o cadastro SHALL valer para as próximas idas à unidade até ser revogado (RN-PRE-03, RN-PRE-04).
3. WHERE o município ativa "uma unidade por vez" the validação numa unidade nova SHALL desativar o cadastro da antiga e arquivar suas entradas (RN-PRE-05).

**Independent Test**: Enviar pré-cadastro, validar na recepção pelo ID.

---

### P2: Cancelar sessão (US-15)

**User Story**: Como admin, quero cancelar uma sessão sem prejudicar quem estava nela.

**Why P2**: Médico falta; feriado.

**Acceptance Criteria**:

1. WHEN o admin cancela uma sessão THEN o painel SHALL pedir o motivo e perguntar "Já existe nova data?".
2. WHEN o admin responde sim THEN o painel SHALL criar a sessão de reposição com os pacientes da cancelada pré-sugeridos para o agendador confirmar.
3. WHEN o admin responde não THEN os pacientes SHALL ir para "Aguardando remarcação" e receber push, e a próxima sessão do serviço SHALL mostrar "N pacientes aguardam remarcação. Alocá-los primeiro?" com eles pré-selecionados.
4. The remanejado SHALL nunca tirar a vaga de quem já está confirmado (RN-REM-02, INV-10).
5. WHEN o admin encerra a sessão THEN o sistema SHALL marcar como falta só quem estava remoto e cuja vez passou, e como remanejado os demais (RN-SES-02).
6. IF alguma estação tem paciente chamado THEN o sistema SHALL recusar o encerramento e listar as estações (RN-SES-03).

**Independent Test**: Cancelar uma sessão com 3 confirmados, escolher "não", criar a próxima e ver os 3 pré-selecionados.

---

### P2: Sessão pública (US-16)

**User Story**: Como paciente, quero me inscrever sozinho numa sessão pública.

**Why P2**: Serviços de demanda espontânea.

**Acceptance Criteria**:

1. WHEN o paciente se inscreve numa sessão pública com vaga THEN o sistema SHALL inscrevê-lo sem alocação (RN-PUB-01).
2. IF a sessão está lotada THEN o sistema SHALL colocá-lo na lista de reserva (RN-PUB-02).
3. WHEN uma vaga é liberada THEN o primeiro da reserva SHALL receber push e entrar confirmado, direto na fila remota se a sessão já estiver aberta.

**Independent Test**: Lotar uma sessão pública, inscrever mais um, cancelar um inscrito.

---

### P2: Cancelar minha vaga (US-17)

**User Story**: Como paciente, quero avisar que não vou poder ir.

**Why P2**: Libera a vaga para outro.

**Acceptance Criteria**:

1. WHEN o paciente toca "Não vou poder ir" THEN o sistema SHALL liberar a vaga e sugerir o próximo (privada) ou chamar o primeiro da reserva (pública) (RN-CANC-02).
2. WHEN o paciente quer outro dia THEN o sistema SHALL exigir uma entrada nova, sem a posição antiga (RN-CANC-03).

**Independent Test**: Cancelar no app e ver a vaga livre no painel.

---

## Edge Cases

- IF o paciente usa uma foto antiga do QR THEN o sistema SHALL recusar o check-in (RN-PRES-01).
- IF o paciente esquece de marcar saída THEN a tolerância de chamada SHALL tratá-lo (RN-PRES-04).
- IF a lista de espera tem 30 dias sem atividade THEN o app SHALL perguntar "Ainda precisa deste atendimento?", e IF não houver resposta em 7 dias THEN a entrada SHALL ser arquivada (RN-PARADA-01, RN-PARADA-02).
- WHEN o paciente atinge 2 faltas em 90 dias THEN o sistema SHALL avisá-lo e mostrar o alerta ao agendador, sem bloqueio automático (RN-FALTA-03).
- IF alguém tenta criar conta com CPF já usado THEN o app SHALL orientar procurar a recepção (RN-ID-02).
- The notificações SHALL nunca conter sintomas ou dados clínicos (RN-NOT-01).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AG-01 | P1: Ver unidades e agenda (US-01) | Design | Pending |
| LE-01 | P1: Entrar na lista de espera (US-02) | Design | Pending |
| RISCO-01 | P1: Entrar na lista de espera (US-02) | Design | Pending |
| ENC-01 | P1: Enviar encaminhamento (US-03) | Design | Pending |
| AL-01 | P1: Alocar pacientes (US-04) | Design | Pending |
| CONF-01 | P1: Confirmar a vaga (US-05) | Design | Pending |
| FILA-01 | P1: Fila remota (US-06) | Design | Pending |
| ETA-01 | P1: Fila remota (US-06) | Design | Pending |
| PRES-01 | P1: Check-in e saída (US-07) | Design | Pending |
| ORD-01 | P1: Janela protegida e atraso (US-08) | Design | Pending |
| ORD-02 | P1: Urgência confirmada (US-09) | Design | Pending |
| CHAM-01 | P1: Chamar o próximo (US-10) | Design | Pending |
| CHAM-02 | P1: Tolerância de chamada (US-11) | Design | Pending |
| BAL-01 | P1: Balcão (US-12) | Design | Pending |
| TV-01 | P1: Pareamento da TV (US-13) | Design | Pending |
| PRE-01 | P2: Pré-cadastro (US-14) | - | Pending |
| SES-01 | P2: Cancelar sessão (US-15) | - | Pending |
| PUB-01 | P2: Sessão pública (US-16) | - | Pending |
| CANC-01 | P2: Cancelar minha vaga (US-17) | - | Pending |

**ID format:** cada ID agrupa as regras `RN-<ID>-NN` da fonte com o mesmo prefixo.

**Coverage:** 19 total, 0 mapped to tasks, 19 unmapped ⚠️ (aguarda o protótipo e o design)

---

## Sources

- [source.md](source.md) - Spec MVP original (2026-11-04, @Ryan): regras de negócio `RN-*`, contratos de estado e invariantes (9.3), matriz de permissões, configurações (6), questionário v1 (7.3), layout da TV (12.1) e requisitos não funcionais (15). É a referência detalhada de cada critério acima.

---

## Success Criteria

- [ ] Espera presencial média abaixo de 10 minutos no piloto.
- [ ] Do clique em Chamar próximo até a senha na TV e o push: até 3 s (RNF-DES-01).
- [ ] Nenhuma resposta ao app contém dado de outro paciente (INV-06).

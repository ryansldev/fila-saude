# Protótipo de validação Specification

**Approved**: 2026-11-04 - user: "Aprovado, pode construir"
**Approved (revisão 2)**: 2026-11-04 - user: "Sim, seguir esse plano"
**Approved (revisão 3)**: 2026-11-04 - user: "deixa a tolerancia lá, mas nn desabilita o nao compareceu. o nao compareceu tem que ficar lá e só vai pro próximo se o cara clicar em nao compareceu ou próximo" e "História 4 com duas etapas (Recommended)"
**Approved (revisão 4)**: 2026-11-04 - user: "nao quero varias histórias, eu quero uma única que é o fluxo principal e mostra tudo" (fluxo de 9 passos), "Pela vez na triagem", "Agendador aloca", "Apresentação + fluxo + modo livre"

## Problem Statement

Antes de qualquer código do MVP (AD-001), a equipe precisa validar a ideia com gestores, recepção e pacientes. Um protótipo só com HTML + CSS + JS mostra, numa só página, o app do paciente, o painel administrativo, a estação de chamada e a TV reagindo uns aos outros nos cenários P1 da spec `mvp-filas`.

## Goals

- [ ] Uma pessoa sem contexto percorre cada cenário pelo passo a passo, sem ajuda, em até 5 minutos por cenário.
- [ ] As regras de ordem da fila (janela protegida, atraso, urgência, pulos) se comportam como os exemplos RN-ORD-01, 03 e 04 da fonte.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Exceções P2 (pré-cadastro, cancelar sessão, sessão pública, cancelar vaga) | Usuário escolheu só os cenários P1 |
| Backend, banco, login real, push real | Protótipo; estado em memória no navegador |
| Etapa de triagem com fila própria | Entrou na revisão 3 (AD-007, PROTO-08) |
| Mapa real (tiles) | Mapa ilustrado, sem dependência externa |
| Document Picture-in-Picture | A estação aparece como cartão na página; a mini-janela é do MVP |
| Persistência entre recargas | Recarregar volta ao cenário inicial |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Telas | App do paciente, painel administrativo, estação de chamada e TV | user: "Incluir TV e estação" | y |
| Formato | Uma página, telas lado a lado, estado compartilhado em memória, seletor de cenários com passo a passo | user: "Simulador interativo" | y |
| Cenários | Lista de espera e risco; alocação e confirmação; fila do dia | user escolheu esses três | y |
| Pasta | `prototype/` na raiz, fora do workspace npm, abre direto no navegador (file://) | user: "prototype/ na raiz" | y |
| Ver como paciente | Seletor "ver como" troca o paciente no celular; cada um vê só os próprios dados | Mostra a privacidade (INV-06) sem login | y |
| Relógio | Relógio simulado com botões "+1 min" e "+5 min" para tolerância, QR e prazo de 24 h | Os prazos reais (5 min, 24 h) não cabem numa demo | y |
| Push | Notificação aparece como aviso no celular do paciente e numa caixa de entrada | Sem push real | y |
| Som da TV | Bipe via Web Audio depois de "Iniciar painel" | RN-TV-04, sem arquivos de áudio | y |
| Lógica testável | Regras da fila e do questionário num módulo JS puro testado com `node --test` | Regras que mudam o que o usuário vê rodam numa camada testada | y |

**Open questions:** none - padrões do protótipo aprovados com a spec.

---

## User Stories

### P1: Simulador e cenários ⭐ MVP

**User Story**: Como quem apresenta o protótipo, quero escolher um cenário e seguir um passo a passo.

**Why P1**: É o que torna a demo autoexplicativa.

**Acceptance Criteria**:

1. WHEN a pessoa abre `prototype/index.html` THEN a página SHALL mostrar o celular do paciente, o painel administrativo, a estação e a TV ao mesmo tempo, num navegador de 1280 px ou mais.
2. WHEN a pessoa escolhe um cenário (Lista de espera e risco, Alocação e confirmação, Fila do dia) THEN a página SHALL carregar os dados do cenário e mostrar seus passos.
3. WHEN a pessoa usa "+1 min" ou "+5 min" THEN o relógio simulado SHALL avançar e os prazos dependentes (contador de tolerância, QR, 24 h, "saia de casa") SHALL ser reavaliados.
4. The celular SHALL mostrar só os dados do paciente escolhido em "ver como" (INV-06).

**Independent Test**: Abrir a página, trocar de cenário três vezes e ver os dados mudarem.

---

### P1: Lista de espera e risco (US-01, US-02, US-03)

**User Story**: Como paciente, quero achar a unidade e entrar na lista informando o que sinto.

**Why P1**: Valida o questionário e o encaminhamento.

**Acceptance Criteria**:

1. WHEN o paciente toca numa unidade do mapa THEN o app SHALL mostrar horário e sessões futuras com serviço, dia, visibilidade e vagas restantes.
2. WHEN o paciente responde o questionário THEN o sistema SHALL calcular o nível pelas regras da fonte (7.3), de cima para baixo, e o app SHALL mostrar o resultado.
3. IF o paciente marca um sinal de alarme exceto pensamentos de se machucar THEN o app SHALL não criar a entrada e SHALL mostrar o botão "Ligar 192".
4. IF o paciente marca pensamentos de tirar a própria vida ou de se machucar THEN o app SHALL mostrar CVV 188 e SAMU 192 em destaque e SHALL permitir seguir, criando a entrada como Urgente sugerido com alerta no painel.
5. IF o paciente já tem entrada ativa no serviço THEN o app SHALL recusar e mostrar a existente.
6. WHERE o serviço exige encaminhamento the app SHALL pedir a foto e criar a entrada em "Aguardando encaminhamento", e WHEN o agendador aceita ou rejeita com motivo THEN o paciente SHALL ver o aviso.
7. When "Nenhum destes" ou "Nenhuma" é marcado the questionário SHALL desmarcar as outras opções da tela.

**Independent Test**: Entrar em Clínico com rotina, tentar de novo, entrar em Cardiologia com encaminhamento e aceitá-lo no painel, e marcar "dor no peito" para ver o 192.

---

### P1: Alocação e confirmação (US-04, US-05)

**User Story**: Como agendador, quero preencher as vagas de uma sessão privada e acompanhar quem não confirmou.

**Why P1**: Valida a sugestão com motivos e a lista de ligação.

**Acceptance Criteria**:

1. WHEN o agendador abre a sessão privada THEN o painel SHALL mostrar a sugestão na ordem urgência confirmada, remanejados, risco vigente, prioridade legal, data de entrada original, com os motivos e o alerta de faltas.
2. WHEN o agendador confirma a alocação THEN cada paciente alocado SHALL receber o aviso "confirme em 24 h" e aparecer na lista de ligação.
3. IF a alocação passaria das vagas THEN o painel SHALL recusar.
4. WHEN o botão "simular outro agendador" é usado e o agendador tenta alocar a mesma vaga THEN o painel SHALL mostrar erro e a lista atualizada.
5. WHILE a alocação está pendente há mais de 24 h simuladas the lista de ligação SHALL destacá-la.
6. WHEN o paciente confirma no app ou o agendador registra confirmado THEN a entrada SHALL passar a Confirmada.
7. WHEN o paciente ou o agendador registra recusa THEN a vaga SHALL ser liberada e o painel SHALL sugerir o próximo, mantendo a data original do recusado.

**Independent Test**: Alocar 3 de 6, confirmar um pelo app, registrar recusa de outro pelo painel e ver o próximo sugerido.

---

### P1: Fila do dia (US-06 a US-13)

**User Story**: Como paciente, recepção, profissional e admin, quero ver a fila remota funcionando de ponta a ponta.

**Why P1**: É a proposta central.

**Acceptance Criteria**:

1. WHEN o admin abre a sessão THEN cada confirmado SHALL entrar remoto com senha `C-NNN` e número na ordem da data de entrada original, e alocações pendentes SHALL ser liberadas.
2. WHILE o paciente está na fila the app SHALL mostrar "você é o Nº · ~X min" pela regra RN-ETA-01, ou "aguardando início do atendimento" sem estação aberta.
3. WHEN o tempo estimado de um remoto na etapa dele cai a 30 min ou menos THEN o paciente SHALL receber "saia de casa" uma vez por etapa (AD-009).
4. WHEN o paciente lê o QR atual ou o anterior THEN o sistema SHALL marcá-lo presente, e IF lê um QR mais antigo THEN o sistema SHALL recusar.
5. WHEN o paciente toca "Vou sair" THEN o sistema SHALL voltá-lo para remoto com o mesmo número.
6. WHEN os exemplos RN-ORD-01, RN-ORD-03 e RN-ORD-04 são reproduzidos THEN a ordem de chamada SHALL ser a da fonte.
7. WHEN a triagem confirma urgente para um remoto THEN o paciente SHALL receber "venha agora" e, presente, SHALL ser o próximo chamado.
8. WHEN o profissional clica em Chamar próximo THEN a TV SHALL destacar a senha e o destino por 10 s com bipe, o paciente SHALL receber "sua vez" e o anterior SHALL ficar atendido.
9. WHEN o profissional marca o chamado como "Não compareceu" THEN o 1º pulo SHALL mantê-lo presente atrás dos próximos K, o 2º SHALL voltá-lo para remoto e o 3º SHALL tirá-lo da fila. (O pulo automático após 5 min foi retirado pela AD-006, ver PROTO-07.)
10. WHEN a recepção inclui um paciente no balcão THEN ele SHALL entrar presente com o próximo número, e IF o questionário dá emergência THEN o painel SHALL orientar encaminhar à emergência.
11. WHEN a TV abre sem pareamento THEN ela SHALL mostrar só um código de 6 dígitos, WHEN o admin digita o código THEN ela SHALL mostrar chamadas, contadores e QR, e WHEN o admin revoga THEN ela SHALL voltar ao código.
12. The TV SHALL mostrar só senhas e contadores ("N aguardando · +M a caminho"), nunca nomes.

**Independent Test**: Abrir a sessão, parear a TV, fazer check-in de dois pacientes, chamar, pular três vezes um terceiro, e reproduzir João/Ana/Bruno.

---

### P1: Apresentação e histórias guiadas (revisão 2, AD-005)

**User Story**: Como quem apresenta o protótipo, quero que ele se explique sozinho e venda a ideia.

**Why P1**: O protótipo existe para validar a ideia com quem nunca viu o produto.

**Acceptance Criteria**:

1. WHEN a pessoa abre `prototype/index.html` THEN a página SHALL apresentar o produto no visual da landing de `apps/web` (Nunito, títulos em minúsculas, azul primário, cards com borda inferior grossa, mascote) com um card por história e um link para o modo livre.
2. WHEN a pessoa abre uma história THEN a página SHALL mostrar só as telas daquela história, cada uma com a legenda de quem a usa, e um roteiro com o passo atual em destaque e o controle a usar marcado.
3. WHEN a pessoa faz a ação de um passo THEN o roteiro SHALL marcar o passo como feito e destacar o próximo, com uma linha de "por que isso importa".
4. The protótipo SHALL não usar animações nem transições CSS.
5. WHEN a pessoa abre o modo livre THEN a página SHALL mostrar celular, painel, estação e TV juntos, com os três cenários.

**Independent Test**: Abrir a apresentação, entrar na história da fila e seguir o roteiro até o fim só pelas marcações.

---

### P1: Posição real e regra de prioridade (revisão 2, AD-002 a AD-004)

**User Story**: Como paciente e como área técnica, quero números que batem com a fila real e uma regra de prioridade que o município escolhe.

**Why P1**: O walk mostrou números que confundem e uma ordem que depende de decisão local.

**Acceptance Criteria**:

1. WHILE o paciente está presente e na fila the app SHALL mostrar a posição na ordem de chamada real entre os presentes do serviço, com janela protegida, e o tempo = (posição − 1) × tempo médio ÷ estações abertas, como "você é o Nº a ser chamado · ~X min" (AD-002).
2. WHILE o paciente está remoto, é o 1º em ordem(todas) e há estação aberta the app SHALL mostrar "venha agora" em vez de número e tempo, e que só é chamado depois de ler o QR (AD-003).
3. WHERE o município configura "prioridade legal antes" the sugestão de alocação e a ordem de chamada SHALL ordenar a prioridade legal antes do risco, abaixo da urgência confirmada e, na alocação, dos remanejados (AD-004).
4. WHEN o agendador troca a regra do município no painel THEN a sugestão SHALL se reordenar na hora.

**Independent Test**: Na fila do dia, João presente vê "1º a ser chamado"; Dora remota em 1º vê "venha agora"; na alocação, trocar a regra põe Dora (82) dentro das vagas.

---

### P1: Chamada sem pulo automático (revisão 3, AD-006)

**User Story**: Como profissional, quero que só eu decida quando o chamado não veio, para ninguém ser pulado no meio da consulta.

**Why P1**: O pulo automático pulava quem já estava sendo atendido.

**Acceptance Criteria**:

1. WHILE há um paciente chamado na estação the estação SHALL mostrar o contador de tolerância e o botão "Não compareceu" habilitado.
2. The sistema SHALL nunca pular um chamado sem o profissional clicar em "Não compareceu", mesmo depois da tolerância.
3. WHEN a tolerância de 5 min acaba THEN a estação SHALL mostrar "tolerância esgotada" e destacar "Não compareceu".
4. WHEN o profissional clica em "Chamar próximo" THEN o chamado atual SHALL ser fechado como atendido e o próximo SHALL ser chamado.

**Independent Test**: Chamar alguém, avançar 12 min e ver que ele continua chamado; clicar "Não compareceu" e ver o 1º pulo.

---

### P1: Triagem com duas etapas (revisão 3, AD-007)

**User Story**: Como admin e enfermeira, quero configurar a triagem e confirmar o risco antes do consultório.

**Why P1**: A triagem tem a palavra final sobre o risco (RN-TRI).

**Acceptance Criteria**:

1. WHILE nenhuma sessão do serviço está aberta the admin SHALL poder marcar ou desmarcar "exige triagem" no serviço, e IF há sessão aberta THEN o sistema SHALL recusar a mudança.
2. WHEN o admin cria uma estação com nome e etapa (triagem ou atendimento) THEN ela SHALL aparecer na lista de estações e na escolha da estação de chamada.
3. WHERE o serviço exige triagem the abertura da sessão SHALL colocar os confirmados na fila de triagem, e a estação de atendimento SHALL não chamá-los antes da triagem.
4. WHEN a estação de triagem chama THEN a TV SHALL mostrar a senha com destino na sala de triagem.
5. WHEN a enfermeira confirma o risco na estação de triagem THEN essa SHALL ser a classificação confirmada.
6. WHEN a estação de triagem chama o próximo ou finaliza THEN o paciente triado SHALL entrar presente na fila do consultório com a mesma senha e o mesmo número, ordenado pela classificação confirmada, prioridade legal e número (RN-TRI-04).
7. WHILE o paciente ainda não foi triado the app SHALL mostrar a posição e o tempo da triagem (à frente na triagem × média da triagem ÷ estações de triagem) e, separada, a previsão da consulta: tempo da triagem + (à frente no serviço × média do atendimento ÷ estações de atendimento). (Revisão 4, AD-009: antes era só a soma.)

**Independent Test**: Ligar a triagem, criar "Triagem 1", abrir a sessão, chamar João na triagem, confirmar Atenção, finalizar e chamá-lo no Consultório 3 com a mesma senha.

---

### P1: Fluxo principal (revisão 4, AD-008 e AD-009)

**User Story**: Como quem apresenta o protótipo, quero uma única história que mostre o fluxo inteiro, do cadastro da sessão ao paciente indo feliz para casa.

**Why P1**: Uma história só, completa, vende a ideia melhor que quatro pedaços.

**Acceptance Criteria**:

1. WHEN o admin cadastra uma sessão com serviço, dia, horário, vagas e visibilidade (pública ou privada) THEN a sessão SHALL aparecer planejada no Admin, na agenda da unidade no app e, se privada, no Agendador.
2. WHEN a paciente entra na lista do serviço e o agendador a aloca na sessão privada THEN ela SHALL receber "confirme em 24 h" e poder confirmar no app; quem não é alocado SHALL continuar na lista.
3. WHEN a pessoa usa "Esperar até o próximo aviso" THEN o relógio SHALL avançar com as estações chamando e atendendo os outros pacientes e os outros chegando quando recebem "saia de casa", e SHALL parar quando a protagonista recebe um aviso novo ou é chamada, sem nunca agir por ela.
4. WHILE a paciente ainda não foi triada the aviso "saia de casa" SHALL vir pela vez dela na triagem (AD-009).
5. WHEN a paciente triada toca "Vou sair" THEN ela SHALL manter o lugar na fila do consultório e receber novo "saia de casa" quando a consulta se aproximar (RN-TRI-05).
6. WHEN a paciente é atendida THEN o app SHALL mostrar quanto tempo ela passou na unidade e quanto esperou fora dela.
7. The protótipo SHALL ter só a apresentação, o fluxo principal e o modo livre.
8. WHEN a paciente volta e lê o QR THEN ela SHALL perder a vez só se foi chamado, na mesma etapa, alguém que vinha depois dela na ordem (AD-010).
9. IF o admin informa vagas que não são um número inteiro a partir de 1 THEN o sistema SHALL recusar a sessão e mostrar "Vagas precisa ser um número inteiro, a partir de 1.".
10. IF a estação tem um paciente chamado THEN o sistema SHALL recusar fechá-la e pedir para finalizar ou marcar "Não compareceu" antes.

**Independent Test**: Abrir `fluxo.html` e seguir o roteiro até a Maria ser atendida, vendo o resumo do tempo na unidade.

---

## Edge Cases

- IF a estação chama sem nenhum elegível THEN a estação SHALL mostrar "ninguém presente" e não chamar ninguém.
- IF o paciente remoto é o primeiro em número THEN o sistema SHALL não chamá-lo (INV-03).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PROTO-01 | P1: Simulador e cenários | Execute | Pending |
| PROTO-02 | P1: Lista de espera e risco | Execute | Pending |
| PROTO-03 | P1: Alocação e confirmação | Execute | Pending |
| PROTO-04 | P1: Fila do dia | Execute | Pending |
| PROTO-05 | P1: Apresentação e histórias guiadas | Execute | Pending |
| PROTO-06 | P1: Posição real e regra de prioridade | Execute | Pending |
| PROTO-07 | P1: Chamada sem pulo automático | Execute | Pending |
| PROTO-08 | P1: Triagem com duas etapas | Execute | Pending |
| PROTO-09 | P1: Fluxo principal | Execute | Pending |

**Coverage:** 9 total, 9 mapped to checks, 0 unmapped

---

## Sources

- `.specs/features/mvp-filas/spec.md` e `source.md` - regras, exemplos de ordem, questionário v1, layout da TV (12.1).
- `.specs/STATE.md` AD-001 - protótipo antes de qualquer código.

---

## Success Criteria

- [ ] A equipe percorre os três cenários e registra o que precisa mudar na spec antes do design.

---

## Checks

**Build**: `node --check prototype/js/engine.js && node --check prototype/js/scenarios.js && node --check prototype/js/app.js`
**Run engine**: `node --test prototype/tests/engine.test.js`

Regras em `prototype/js/engine.js`, testadas por `prototype/tests/engine.test.js`. As telas são conferidas no passo a passo (Handoff, Walked).

**C1** - Tela 1 com qualquer sinal de alarme exceto autolesão dá Emergência e não cria entrada (PROTO-02, AC 3)
Proof: run engine | ✔ classify: alarm sign is emergency

**C2** - Autolesão dá Urgente com apoio, entrada criada como urgente sugerido (PROTO-02, AC 4)
Proof: run engine | ✔ classify: self-harm is urgent with support

**C3** - Regras Urgente, Atenção e Rotina seguem a tabela 7.3, primeira que bate (PROTO-02, AC 2)
Proof: run engine | ✔ classify: urgent, attention and routine rules

**C4** - Segunda entrada ativa no mesmo serviço é recusada (PROTO-02, AC 5)
Proof: run engine | ✔ waitlist: one active entry per service

**C5** - Serviço com encaminhamento cria "Aguardando encaminhamento", não alocável até aceito (PROTO-02, AC 6)
Proof: run engine | ✔ waitlist: referral gates allocation

**C6** - Sugestão ordena urgência confirmada, remanejado, risco, prioridade legal, data original, com motivos (PROTO-03, AC 1)
Proof: run engine | ✔ allocation: suggestion order and reasons

**C7** - Alocação além das vagas é recusada; alocar com a lista desatualizada dá conflito (PROTO-03, AC 3 e AC 4)
Proof: run engine | ✔ allocation: never exceeds slots

**C8** - Recusa libera a vaga e devolve a entrada com a data original; quem recusou não é sugerido de novo para a mesma sessão (PROTO-03, AC 7)
Proof: run engine | ✔ allocation: refusal keeps original date

**C9** - Abertura numera confirmados pela data original e libera pendentes (PROTO-04, AC 1)
Proof: run engine | ✔ queue: open numbers by original date

**C10** - Posição e tempo estimado por RN-ETA-01, mostrados como "você é o Nº · ~X min"; sem estação, "aguardando início do atendimento" (PROTO-04, AC 2)
Proof: run engine | ✔ queue: eta and position

**C11** - QR atual e anterior aceitos; mais antigo recusado; "Vou sair" mantém o número (PROTO-04, AC 4 e AC 5)
Proof: run engine | ✔ queue: qr current and previous only

**C12** - RN-ORD-01: João presente é chamado antes de Ana que acabou de chegar (PROTO-04, AC 6)
Proof: run engine | ✔ order: RN-ORD-01 protected window

**C13** - RN-ORD-03: ordem João, Bruno, Ana (PROTO-04, AC 6)
Proof: run engine | ✔ order: RN-ORD-03 consecutive check-ins

**C14** - RN-ORD-04: Bruno chega depois de Ana chamada e vai para o fim (PROTO-04, AC 6)
Proof: run engine | ✔ order: RN-ORD-04 late arrival

**C15** - Urgência confirmada fura a janela e gera "venha agora" para remoto (PROTO-04, AC 7)
Proof: run engine | ✔ order: confirmed urgency jumps window

**C16** - Chamar próximo encerra o anterior como atendido e nunca chama remoto (PROTO-04, AC 8)
Proof: run engine | ✔ call: next closes previous and skips remote

**C17** - 1º, 2º e 3º "Não compareceu": presente atrás de K, remoto, fora da fila (PROTO-04, AC 9)
Proof: run engine | ✔ call: three skips

**C18** - "Saia de casa" sai uma vez quando o tempo do remoto chega a 30 min (PROTO-04, AC 3)
Proof: run engine | ✔ queue: leave home notice once

**C19** - Balcão entra presente com o próximo número; vagas respeitadas, e atendidos deixam de ocupar vaga por qualquer caminho (PROTO-04, AC 10)
Proof: run engine | ✔ queue: front desk entry is present

**C20** - "Nenhum destes" e "Nenhuma" desmarcam as outras opções (PROTO-02, AC 7)
Proof: run engine | ✔ quiz: none option is exclusive

**C21** - A unidade mostra horário e sessões futuras como "Terça, 17/11 · Clínico geral · privada · 19 vagas", sem pacientes (PROTO-02, AC 1)
Proof: run engine | ✔ agenda: unit shows future sessions with remaining slots

**C22** - TV sem pareamento mostra só o código; pareada mostra contadores e QR; revogada volta ao código (PROTO-04, AC 11)
Proof: run engine | ✔ tv: pairing shows only code until paired and after revoke

**C23** - A TV mostra só senhas, destino e contadores, nunca nomes (PROTO-04, AC 12)
Proof: run engine | ✔ tv: shows only tickets and counters, never names

**C24** - O celular recebe só os dados do paciente escolhido (PROTO-01, AC 4)
Proof: run engine | ✔ privacy: patient view holds only own data

**C25** - Alocação avisa "confirme em 24 h", entra na lista de ligação, fica destacada aos 24 h e sai ao confirmar (PROTO-03, AC 2, AC 5 e AC 6)
Proof: run engine | ✔ calllist: pending allocation highlighted after 24 h

**C26** - Avançar o relógio reavalia o contador de tolerância, que esgota aos 5 min sem pular ninguém (PROTO-01, AC 3; PROTO-07, AC 2 e AC 3)
Proof: run engine | ✔ clock: advancing re-evaluates tolerance

**C27** - O modo livre mostra celular, painel, estação e TV juntos a 1280 px, e cada cenário carrega seus dados e passos (PROTO-01, AC 1 e AC 2; PROTO-05, AC 5)
Proof: walk

**C28** - Chamar próximo destaca a senha e o destino na TV por 10 s com bipe (PROTO-04, AC 8)
Proof: walk

**C29** - Presente vê a posição na ordem de chamada real, com janela protegida, e (posição − 1) × média ÷ estações (PROTO-06, AC 1)
Proof: run engine | ✔ eta: present patient sees real call order

**C30** - Remoto em 1º com estação aberta vê "venha agora"; sem estação, "aguardando início" (PROTO-06, AC 2)
Proof: run engine | ✔ eta: remote first sees come now

**C31** - "Prioridade legal antes" põe a prioridade legal acima do risco na sugestão, na posição e na ordem de chamada real, abaixo de urgência confirmada e remanejados (PROTO-06, AC 3 e AC 4)
Proof: run engine | ✔ priority: municipal rule switches legal before risk

**C32** - Apresentação no visual da landing levando ao fluxo principal; o fluxo mostra as telas com legendas e um roteiro que marca o passo feito e destaca o próximo (PROTO-05, AC 1 a AC 3; PROTO-09, AC 7)
Proof: walk

**C34** - Sair ("Vou sair") ou ir para casa no 2º pulo e voltar nunca trava a ordem de chamada (PROTO-04, AC 5 e AC 9; PROTO-06, AC 1)
Proof: run engine | ✔ order: leaving and coming back never deadlocks

**C35** - O chamado nunca é pulado sozinho; só "Não compareceu" pula e "Chamar próximo" fecha como atendido (PROTO-07, AC 2 e AC 4)
Proof: run engine | ✔ call: tolerance never skips on its own

**C36** - "Exige triagem" só muda sem sessão aberta; o admin cria estação com etapa (PROTO-08, AC 1 e AC 2)
Proof: run engine | ✔ triage: admin enables triage and creates a station

**C37** - Com triagem, a sessão abre na fila de triagem; o consultório não chama antes; a triagem confirma o risco e o triado volta presente ao consultório com a mesma senha e número (PROTO-08, AC 3 a AC 6)
Proof: run engine | ✔ triage: two stages with the same ticket

**C38** - Quem não foi triado vê a posição e o tempo da triagem, e a previsão da consulta separada (PROTO-08, AC 7)
Proof: run engine | ✔ triage: eta sums both stages

**C39** - Estação mostra contador, "tolerância esgotada" e "Não compareceu" sempre habilitado; o fluxo principal vai do início ao fim pelo roteiro e termina com o resumo do tempo (PROTO-07, AC 1 e AC 3; PROTO-08; PROTO-09)
Proof: walk

**C40** - O admin cadastra sessão pública ou privada, ela aparece na agenda, e vagas inválidas (0, negativas, fracionadas, NaN, infinito, vazio) são recusadas (PROTO-09, AC 1 e AC 9)
Proof: run engine | ✔ flow: admin creates a public or private session

**C41** - Um "saia de casa" por etapa: antes da triagem pela vez na triagem, depois de "Vou sair" pela vez na consulta (PROTO-09, AC 4 e AC 5; PROTO-04, AC 3)
Proof: run engine | ✔ triage: leave home notice per stage

**C42** - O tempo na unidade soma só os períodos presentes (PROTO-09, AC 6)
Proof: run engine | ✔ presence: time at the unit is tracked

**C43** - "Esperar até o próximo aviso" move os outros pacientes e para quando a protagonista é avisada ou chamada, sem agir por ela (PROTO-09, AC 3)
Proof: run engine | ✔ simulate: others move, protagonist acts alone

**C44** - Quem volta perde a vez só se alguém que vinha depois na ordem foi chamado; urgente chamado antes não conta (PROTO-09, AC 5 e AC 8)
Proof: run engine | ✔ order: coming back loses the turn only if it passed in the order

**C45** - A estação com paciente chamado não fecha (PROTO-09, AC 10; PROTO-07, AC 1)
Proof: run engine | ✔ station: cannot close while someone is called

**C33** - Nenhuma animação ou transição CSS (PROTO-05, AC 4)
Proof: `! grep -rnE "animation|transition|@keyframes" prototype/css`

## Handoff

**Settled mid-build:** none
**Dispatched:** Verifier at `0a2c9df` (proofs.md at `0a2c9df`, same code) - returned (FAIL, 9 findings); revisão 2: Verifier at `db2e302` - returned (FAIL, 3 findings); revisões 3 e 4: Verifier at `1d71a1a` - returned (FAIL, 10 findings)
**Walked (revisões 3 e 4):** 2026-11-04, Chrome headless via CDP por file://. O script que só clica no elemento marcado (`.hint`) terminou `fluxo.html` com 15/15 passos, sem erro de console. Na sequência: sessão privada criada no Admin; Maria entra na lista (exame → rotina); o Agendador aloca 13 (os outros 12 confirmam sozinhos) e Maria confirma; +1 dia; a sessão é aberta; a espera para no "saia de casa" da triagem; o QR leva 20 min de trajeto; a Triagem 1 a chama; "Finalizar triagem" a deixa como "você é o 9º a ser chamado · ~2 h"; "Vou sair"; a espera para no segundo "saia de casa"; ela volta e lê o QR; o Consultório 3 a chama; "Finalizar". O celular termina com "Tudo certo, Maria!" (40 min na unidade, 2 h 26 min esperando em casa). A estação mostra "Não compareceu" sempre habilitado e "esgotada" ao fim da tolerância. A TV mostra a chamada mais recente depois da espera. No modo livre, os cinco cenários abrem, trocam de aba e abrem sessão sem erro. Nenhuma página tem rolagem horizontal a 1280 e 1440 px.
**Walked (revisão 2):** 2026-11-04, Chrome headless via CDP por file://. Um script que só clica no elemento com a marca do roteiro (`.hint`) terminou as três histórias: `historia-lista.html` 7/7, `historia-alocacao.html` 6/6, `historia-fila.html` 10/10 (também a 1280 px), sem erro de console. Apresentação, histórias e modo livre sem rolagem horizontal a 1280 e 1440 px, e o menu do topo sem transbordo. Na fila do dia, a Dora (remota, 1ª) vê "Sua vez está chegando: venha agora" no cartão verde. João presente vê "você é o 1º a ser chamado". Na alocação, "Prioridade legal antes" põe a Dora nas 3 vagas e tira o Carlos (urgente sugerido).
**Walked:** 2026-11-04, Chrome headless via CDP, `prototype/index.html` por file://, sem login.
- Simulador (PROTO-01): a 1280 e 1440 px as quatro visões ficam lado a lado sem rolagem horizontal (colunas 20..392, 412..845, 865..1245 a 1280). Os três botões de cenário trocam dados e passos. "+5 min" pula o chamado.
- Lista de espera (PROTO-02), cenário "Lista de espera e risco": pin UBS Vila Nova mostra "Terça, 17/11 · Clínico geral · privada · 19 vagas". Maria em Clínico (nenhum, novo, moderado) dá "Atenção · sugerido". Segunda tentativa mostra "Você já está nesta lista". Em Cardiologia pede a foto; o agendador rejeita "Fora da validade" e o aviso aparece no celular. Antônio com dor no peito vê "Ligar 192 · SAMU" sem entrada. Lúcia com autolesão vê CVV 188 e SAMU 192, segue e entra como "Urgente · sugerido", com alerta no Agendador.
- Alocação (PROTO-03), cenário "Alocação e confirmação": a sugestão vem Eduardo (remanejado), Carlos (urgente), Helena (gestante), Fátima (2 faltas), Dora (82), Gil, com as 3 primeiras marcadas. Alocar ocupa 4 de 4 vagas. Helena confirma no app. Na lista de ligação Ivo aparece destacado; "Recusou" sugere Fátima. "Simular outro agendador" seguido de Alocar mostra o erro de conflito, e a nova tentativa aloca. "+1 dia" destaca todos os pendentes.
- Fila do dia (PROTO-04), cenário "Fila do dia": código errado da TV é recusado; o certo pareia, e "Iniciar painel" mostra contadores e QR. Abrir sessão gera C-001..C-006 remotos e libera Sérgio. Check-in João, Ana, Bruno dá a ordem João, Bruno, Ana (RN-ORD-03). A chamada destaca C-003 na TV por 10 s, depois a senha desce para "últimas chamadas". O QR antigo dá "QR expirado". Triagem urgente no Paulo o põe como próximo. 1º pulo mantém presente, 2º volta para remoto, 3º "Você saiu da fila". O balcão gera C-007 presente. Fechar o Consultório 3 mostra "aguardando início do atendimento".


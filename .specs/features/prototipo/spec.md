# Protótipo de validação Specification

**Approved**: 2026-11-04 - user: "Aprovado, pode construir"

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
| Etapa de triagem com fila própria | A triagem aparece só como confirmação de risco; as duas etapas ficam para o MVP |
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
3. WHEN a pessoa usa "+1 min" ou "+5 min" THEN o relógio simulado SHALL avançar e os prazos dependentes (tolerância, QR, 24 h, "saia de casa") SHALL ser reavaliados.
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
3. WHEN o tempo estimado de um remoto cai a 30 min ou menos THEN o paciente SHALL receber "saia de casa" uma vez.
4. WHEN o paciente lê o QR atual ou o anterior THEN o sistema SHALL marcá-lo presente, e IF lê um QR mais antigo THEN o sistema SHALL recusar.
5. WHEN o paciente toca "Vou sair" THEN o sistema SHALL voltá-lo para remoto com o mesmo número.
6. WHEN os exemplos RN-ORD-01, RN-ORD-03 e RN-ORD-04 são reproduzidos THEN a ordem de chamada SHALL ser a da fonte.
7. WHEN a triagem confirma urgente para um remoto THEN o paciente SHALL receber "venha agora" e, presente, SHALL ser o próximo chamado.
8. WHEN o profissional clica em Chamar próximo THEN a TV SHALL destacar a senha e o destino por 10 s com bipe, o paciente SHALL receber "sua vez" e o anterior SHALL ficar atendido.
9. WHEN o chamado é pulado (manualmente ou após 5 min simulados) THEN o 1º pulo SHALL mantê-lo presente atrás dos próximos K, o 2º SHALL voltá-lo para remoto e o 3º SHALL tirá-lo da fila.
10. WHEN a recepção inclui um paciente no balcão THEN ele SHALL entrar presente com o próximo número, e IF o questionário dá emergência THEN o painel SHALL orientar encaminhar à emergência.
11. WHEN a TV abre sem pareamento THEN ela SHALL mostrar só um código de 6 dígitos, WHEN o admin digita o código THEN ela SHALL mostrar chamadas, contadores e QR, e WHEN o admin revoga THEN ela SHALL voltar ao código.
12. The TV SHALL mostrar só senhas e contadores ("N aguardando · +M a caminho"), nunca nomes.

**Independent Test**: Abrir a sessão, parear a TV, fazer check-in de dois pacientes, chamar, pular três vezes um terceiro, e reproduzir João/Ana/Bruno.

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

**Coverage:** 4 total, 4 mapped to checks, 0 unmapped

---

## Sources

- `.specs/features/mvp-filas/spec.md` e `source.md` - regras, exemplos de ordem, questionário v1, layout da TV (12.1).
- `.specs/STATE.md` AD-001 - protótipo antes de qualquer código.

---

## Success Criteria

- [ ] A equipe percorre os três cenários e registra o que precisa mudar na spec antes do design.

---

## Checks

**Build**: `node --check prototype/js/engine.js && node --check prototype/js/app.js`
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

**C17** - 1º, 2º e 3º pulo: presente atrás de K, remoto, fora da fila (PROTO-04, AC 9)
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

**C26** - Avançar o relógio reavalia a tolerância de chamada (PROTO-01, AC 3)
Proof: run engine | ✔ clock: advancing re-evaluates tolerance

**C27** - A página mostra celular, painel, estação e TV juntos a 1280 px, e cada cenário carrega seus dados e passos (PROTO-01, AC 1 e AC 2)
Proof: walk

**C28** - Chamar próximo destaca a senha e o destino na TV por 10 s com bipe (PROTO-04, AC 8)
Proof: walk

## Handoff

**Settled mid-build:** none
**Dispatched:** Verifier at `0a2c9df` (proofs.md at `0a2c9df`, same code) - returned (FAIL, 9 findings)
**Walked:** 2026-11-04, Chrome headless via CDP, `prototype/index.html` por file://, sem login.
- Simulador (PROTO-01): a 1280 e 1440 px as quatro visões ficam lado a lado sem rolagem horizontal (colunas 20..392, 412..845, 865..1245 a 1280). Os três botões de cenário trocam dados e passos. "+5 min" pula o chamado.
- Lista de espera (PROTO-02), cenário "Lista de espera e risco": pin UBS Vila Nova mostra "Terça, 17/11 · Clínico geral · privada · 19 vagas". Maria em Clínico (nenhum, novo, moderado) dá "Atenção · sugerido". Segunda tentativa mostra "Você já está nesta lista". Em Cardiologia pede a foto; o agendador rejeita "Fora da validade" e o aviso aparece no celular. Antônio com dor no peito vê "Ligar 192 · SAMU" sem entrada. Lúcia com autolesão vê CVV 188 e SAMU 192, segue e entra como "Urgente · sugerido", com alerta no Agendador.
- Alocação (PROTO-03), cenário "Alocação e confirmação": a sugestão vem Eduardo (remanejado), Carlos (urgente), Helena (gestante), Fátima (2 faltas), Dora (82), Gil, com as 3 primeiras marcadas. Alocar ocupa 4 de 4 vagas. Helena confirma no app. Na lista de ligação Ivo aparece destacado; "Recusou" sugere Fátima. "Simular outro agendador" seguido de Alocar mostra o erro de conflito, e a nova tentativa aloca. "+1 dia" destaca todos os pendentes.
- Fila do dia (PROTO-04), cenário "Fila do dia": código errado da TV é recusado; o certo pareia, e "Iniciar painel" mostra contadores e QR. Abrir sessão gera C-001..C-006 remotos e libera Sérgio. Check-in João, Ana, Bruno dá a ordem João, Bruno, Ana (RN-ORD-03). A chamada destaca C-003 na TV por 10 s, depois a senha desce para "últimas chamadas". O QR antigo dá "QR expirado". Triagem urgente no Paulo o põe como próximo. 1º pulo mantém presente, 2º volta para remoto, 3º "Você saiu da fila". O balcão gera C-007 presente. Fechar o Consultório 3 mostra "aguardando início do atendimento".


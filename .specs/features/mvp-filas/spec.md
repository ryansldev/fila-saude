# MVP Filas UBS/Policlínicas

**Aprovada:** 2026-11-04 (usuário: "essa é a spec MVP já ok"). Reorganizada em 2026-11-10 (AD-051): as regras vivem nas [specs por capacidade](../../specs/); esta página diz o que o MVP entrega e com quais histórias.

## Problema e meta

Trocar a fila física de UBS e policlínicas por uma fila remota: o paciente espera em casa e só vai à unidade quando a vez estiver perto. Meta de produto: **espera presencial abaixo de 10 minutos**. O MVP cobre UBS e policlínicas; UPA existe como tipo de unidade, sem fluxo próprio. Princípios: [constituição](../../constitution.md).

## Escopo

**Dentro do MVP**
- **App do paciente** (Android e iOS): mapa e agenda das unidades, lista de espera, questionário de risco, requisição pelo app, pré-cadastro, fila do dia, check-in e saída, cancelamento.
- **Painel** (web): configuração de município, unidades, serviços e sessões; alocação e lançamento regulado; lista de ligação; recepção; conferências; remanejamento; contingência; relatório de ajustes e CSV de métricas.
- **Estação de chamada** (web, Chrome ou Edge) e **painel da TV** (web, pareado por código).
- **Push** no app.

**Fora do MVP**

| Item | Motivo / quando |
| --- | --- |
| WhatsApp | Custo e burocracia; depois, com API oficial da própria prefeitura |
| SMS e segundo fator de login | Custo; login é CPF + senha |
| Dashboard de métricas | Fase seguinte; no MVP, CSV (RNF-MET-01) |
| Estimativa de tempo com IA | Fase seguinte; MVP usa tempo médio |
| Voz lendo a chamada na TV | Só som de aviso |
| Botão físico USB | Descartado |
| Integração com e-SUS PEC, SISREG ou e-SUS Regulação | Depende de terceiros; regulação avaliada no D6 para depois do piloto |
| Prontuário e dados clínicos além do questionário | Não é nossa responsabilidade |
| Fluxo de UPA | Fase seguinte |
| Página pública da fila (fora da TV) | O app já cobre |
| Painel offline com sincronização | Contingência por papel (RN-CONT-01) |
| Migrar entradas entre unidades na transferência | Reavaliar com uso real |
| gov.br e biometria comercial | Depois do piloto (AD-017) |

## Histórias de usuário

P1 = sem ela o MVP não funciona; P2 = necessária para a operação real. Os critérios de aceite são as regras e os cenários citados.

| ID | Prioridade | História | Regras |
| --- | --- | --- | --- |
| US-01 | P1 | Como paciente, quero ver as unidades próximas e o que cada uma oferece, sem ver dados de outros pacientes | RN-AG-01, RN-AG-02 |
| US-02 | P1 | Como paciente, quero entrar na lista de um serviço informando o que sinto (para mim ou para outra pessoa) | RN-LE-01..06, RN-RISCO-01..06 |
| US-03 | P1 | Como paciente, quero enviar de casa a foto da requisição e ser avisado do aceite ou da recusa | RN-ENC-01..04 |
| US-04 | P1 | Como agendador, quero preencher as vagas de uma sessão privada com a sugestão ordenada e seus motivos | RN-AL-01..06, RN-PERF-02 |
| US-05 | P1 | Como paciente, quero confirmar a alocação; como agendador, quero ligar para quem não confirmou | RN-CONF-01..04 |
| US-06 | P1 | Como paciente, quero entrar na fila remota ao abrir a sessão, ver posição e tempo, e receber "saia de casa" | RN-FILA-01..02, RN-ETA-01..05 |
| US-07 | P1 | Como paciente, quero fazer check-in pelo QR (ou ser orientado a passar na recepção na 1ª ida) e sair com "Vou sair" sem perder a posição | RN-PRES-01..04, RN-FILA-05 |
| US-08 | P1 | Como paciente presente, não quero ser ultrapassado por quem acabou de chegar | RN-ORD-01, RN-ORD-03..05 |
| US-09 | P1 | Como paciente com urgência confirmada, quero passar à frente e, remoto, receber "venha agora" | RN-ORD-02 |
| US-10 | P1 | Como profissional, quero chamar o próximo na mini-janela sem sair do prontuário | RN-CHAM-01, RN-CHAM-02, RN-EST-01..05 |
| US-11 | P1 | Como profissional, quero pular quem não compareceu, sem pulo automático | RN-CHAM-03, RN-FALTA-02 |
| US-12 | P1 | Como recepção, quero incluir quem não tem app e entregar o papel com a senha | RN-FILA-03, RN-LE-04, RN-PRES-03, RN-TV-05 |
| US-13 | P1 | Como admin, quero parear e revogar a TV da unidade | RN-TV-01..07 |
| US-14 | P2 | Como paciente, quero fazer o pré-cadastro uma vez e validá-lo na unidade | RN-PRE-01..06 |
| US-15 | P2 | Como admin, quero cancelar uma sessão criando a reposição ou deixando os pacientes aguardando remarcação | RN-REM-01..05 |
| US-16 | P2 | Como paciente, quero me inscrever numa sessão pública ou entrar na reserva | RN-PUB-01..04 |
| US-17 | P2 | Como paciente, quero cancelar minha vaga | RN-CANC-01..03 |
| US-18 | P2 | Como agendador, quero lançar os pacientes que a regulação mandou; como paciente, quero entender que o serviço é regulado | RN-ENC-05..07 |
| US-19 | P2 | Como recepção, quero operar pelo papel quando o sistema cai e reconciliar na volta, sem punir ninguém | RN-CONT-01..04, RN-SES-04, RN-SES-05 |

## Em aberto

Propostas a validar no piloto ou nos discoveries (lista completa em [tasks](tasks.md#discoveries-e-spikes)):

- Questionário v1 e regras de classificação: validar com enfermeiro ou médico (D8).
- Validade da requisição e quem a confere (D6).
- Prazo de exclusão das fotos (RNF-LGPD-04), grupos e documentos de prioridade legal, texto do aviso de declaração falsa (D5).
- Tempo médio (RN-ETA-05), triagem cadenciada (RN-TRI-06) e reativação em 30 dias (RN-PARADA-02): validar no piloto.
- Quem chama em cada sala (o profissional, como assumido, ou alguém por ele): confirmar no D4.
- Área de abrangência por endereço como critério de vínculo, além do cadastro validado: perguntar no D4 se a unidade atende só a população adscrita.
- Hospedagem de longo prazo e cobrança (D7, [hospedagem](discovery-hospedagem.md)).

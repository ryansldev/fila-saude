# Spec MVP — Sistema de Filas para UBS e Policlínicas

Nov 4, 2026 · @Ryan

**Como ler esta spec.** Cada regra tem um código (RN = regra de negócio, RNF = requisito não funcional) para ser citado no plan, nas tasks e nos testes. "Padrão" indica um valor configurável (seção 6). Toda regra é obrigatória no MVP, exceto as marcadas como **proposta**, que dependem de validação (seção 16). As decisões AD-002..AD-015 (`.specs/STATE.md`), tomadas na validação do protótipo, já estão incorporadas ao texto e citadas onde mudaram uma regra. Datas e horas ("véspera", "no dia", "24 h") seguem o fuso horário configurado na unidade.

## 1. Visão e objetivos

O sistema troca a fila física de UBS e policlínicas por uma fila remota: o paciente espera em casa e só vai à unidade quando a vez estiver perto. A meta de produto é **espera presencial abaixo de 10 minutos**.

O MVP cobre UBS e policlínicas. UPA existe como tipo de unidade no modelo, mas sem fluxo próprio nesta fase.

**Princípios que orientam todas as decisões**

- **Somos só a fila.** Não guardamos prontuário. Depois da triagem e do atendimento, a responsabilidade é de outro sistema.
- **O humano decide.** O sistema sugere prioridade e alocação, sempre com justificativa. Agendador e triagem confirmam.
- **Presente tem preferência.** Só é chamado quem está na unidade, e quem já está esperando não é ultrapassado por quem chega atrasado (8.3).
- **Saúde em primeiro lugar.** Urgência confirmada por um profissional passa na frente.
- **Ninguém fica de fora.** Quem não tem celular ou internet entra pela recepção, no mesmo fluxo.
- **Privacidade.** Um paciente nunca vê outros pacientes, nem na lista de espera nem na fila.
- **Um app, vários municípios.** O app é único; cada prefeitura tem seu perfil, suas unidades e seus dados.

## 2. Escopo do MVP

**Dentro do MVP**

- **App do paciente** (Android e iOS): mapa de unidades, agenda da unidade, lista de espera, questionário de risco, envio de encaminhamento, pré-cadastro, fila do dia, check-in e saída, cancelamento.
- **Painel administrativo** (web): configuração de município, unidades, serviços e sessões; alocação; lista de ligação; recepção; validação de cadastro e encaminhamento; remanejamento.
- **Estação de chamada** (web, no Chrome ou Edge do consultório e da triagem).
- **Painel da TV** (web), pareado por código.
- **Notificações push** no app.

**Fora do MVP**

| Item | Motivo / quando |
| --- | --- |
| WhatsApp (oficial ou não oficial) | Custo e burocracia; entra depois, com API oficial da própria prefeitura |
| SMS e segundo fator de login | Custo; login é CPF + senha |
| Dashboard de métricas para o gestor | Fase seguinte |
| Estimativa de tempo com IA (histórico de atendimentos parecidos) | Fase seguinte; MVP usa tempo médio |
| Voz lendo a chamada na TV | Só som de aviso no MVP |
| Botão físico USB | Descartado |
| Integração com e-SUS PEC, SISREG ou regulação | Depende de terceiros |
| Prontuário e dados clínicos além do questionário | Não é nossa responsabilidade |
| Fluxo de UPA | Fase seguinte |
| Página pública da fila (fora da TV) | O app já cobre |

## 3. Glossário

| Termo | Definição |
| --- | --- |
| Município | O cliente: prefeitura com sua secretaria de saúde. Um tenant com várias unidades e dados isolados. |
| Unidade | UBS, policlínica ou UPA, com endereço, horário e configurações próprias. |
| Serviço | O que a unidade oferece: clínico geral, cardiologia, odontologia. A lista de espera é do serviço, não do profissional. |
| Sessão | Um dia de um serviço: data, horário de início e fim, vagas e visibilidade. Pode nascer de uma série recorrente (RFC 5545); cada ocorrência é uma sessão com estado e configuração próprios (AD-014). O profissional é só texto informativo. |
| Sessão aberta | Sessão com a fila do dia ativa. Abre no horário de início (ou antes, pelo admin) e só fecha quando o admin a encerra. |
| Sessão privada | O agendador decide quem entra, a partir da lista de espera do serviço. |
| Sessão pública | O paciente se inscreve sozinho até acabarem as vagas. |
| Lista de espera | Pacientes aguardando uma sessão de um serviço. Nenhum paciente a vê. |
| Lista de reserva | Inscritos que sobraram quando uma sessão pública lotou. Recebem as vagas liberadas, em ordem. |
| Entrada | Inscrição de um paciente na lista de espera de um serviço. No máximo uma ativa por serviço. |
| Data de entrada original | Momento em que a entrada foi criada. Serve de desempate e é preservada em recusas e remanejamentos. |
| Alocação | Atribuição de uma entrada a uma sessão (um dia, sem horário), feita pelo agendador. |
| Pré-cadastro | Cadastro do paciente numa unidade, com documentos, validado presencialmente pela recepção. Feito uma vez por unidade. |
| Vínculo | Exigência da unidade de que o paciente já tenha o pré-cadastro **validado** nela para entrar na lista. Uma sessão pode dispensá-la (AD-016). |
| ID de atendimento | Código de 6 caracteres (e QR) do pré-cadastro, mostrado na recepção para a validação. |
| Fila do dia | Fila de uma sessão aberta. Tem uma etapa (atendimento) ou duas (triagem e atendimento). |
| Etapa | Triagem ou atendimento. Cada etapa tem sua própria ordem e suas chamadas. |
| Remoto / Presente | Estado de presença na fila do dia: fora ou dentro da unidade. Existe ainda "presente, aguardando validação" (RN-FILA-05), que não é elegível. |
| Elegível | Presente e liberado para ser chamado (por exemplo, com o pré-cadastro já validado, quando exigido). |
| Posição original | Número sequencial do paciente na fila do dia, dado ao entrar (RN-FILA-01 e RN-FILA-02). Não muda quando ele sai e volta; só muda pela regra de atraso (8.3). |
| Estação | Ponto de chamada (consultório ou sala de triagem), ligado a uma etapa e a um ou mais serviços. Está aberta enquanto houver um profissional logado nela. |
| Senha | Código do paciente na fila do dia, com prefixo do serviço (ex.: C-012). É a mesma na triagem e no atendimento. |
| Classificação de risco | Nível do Manchester reduzido: emergência, urgente, atenção ou rotina. É *sugerida* pelo app e *confirmada* por agendador ou triagem. |
| Urgência confirmada | Nível urgente validado por um humano. É a única condição que fura a janela protegida. |
| Prioridade legal | Prioridade prevista em lei (idoso, gestante, PcD etc.). Eixo separado do risco. |
| Janela protegida | Os K primeiros elegíveis da etapa, que quem acabou de fazer check-in não pode ultrapassar. |
| Tolerância de chamada | Tempo que o paciente chamado tem para se apresentar. É só um contador mostrado na estação: quem pula é o profissional, com "Não compareceu" (AD-006). |
| Falta | Paciente confirmado que, no encerramento da sessão, estava remoto e cuja vez já tinha passado (foi chamado alguém que vinha depois dele na ordem real, AD-010). Quem não chegou a ter a vez é remanejado, não faltoso. |
| Remanejado | Paciente que perdeu o atendimento por culpa da unidade (sessão cancelada, ou encerrada antes da vez dele ou com ele presente). |

## 4. Atores e perfis de acesso

Uma pessoa pode acumular perfis (ex.: agendador e recepção). Cada perfil é concedido com um **escopo**: o município inteiro ou unidades específicas. Toda ação administrativa fica registrada em log de auditoria.

| Perfil | Escopo | O que faz |
| --- | --- | --- |
| Paciente | Próprio | Usa o app: lista de espera, fila, check-in, cancelamento |
| Gestor municipal | Município | Cria unidades, define regras do município, gerencia usuários do painel |
| Admin da unidade | Unidade | Configura serviços, sessões, TV e estações; cancela e encerra sessões |
| Agendador | Unidade | Valida encaminhamentos, aloca pacientes, liga e registra confirmações |
| Recepção | Unidade | Inclui pacientes no balcão, valida identidade e pré-cadastro, marca presença |
| Triagem | Unidade | Chama para triagem, confirma ou reclassifica o risco |
| Profissional | Unidade | Chama o próximo e rechama na estação |
| TV (dispositivo) | Unidade | Exibe chamadas e QR. Não é um usuário; é um dispositivo pareado |

**Regras**

- RN-PERF-01: o acesso a respostas do questionário e a documentos segue a matriz de permissões (9.3), sempre restrito à unidade do perfil.
- RN-PERF-02: dois agendadores não conseguem alocar a mesma vaga; a segunda tentativa recebe erro e a lista atualizada.

## 5. Modelo de domínio

A hierarquia é **Município → Unidade → Serviço → Sessão**. O paciente tem uma identidade central e se relaciona com cada unidade por meio de cadastro, entradas e filas.

| Entidade | Pertence a | Atributos principais |
| --- | --- | --- |
| Município | — | nome, UF, regras municipais (seção 6) |
| Unidade | Município | tipo (UBS, Policlínica, UPA), endereço, coordenadas, horário de funcionamento, configurações |
| Serviço | Unidade | nome, prefixo de senha, exige triagem, exige encaminhamento, tempo médio inicial |
| Série de sessões | Serviço | DTSTART/DTEND, RRULE, EXDATE, RDATE (RFC 5545), configuração padrão das ocorrências (vagas, visibilidade, profissional, estações) |
| Sessão | Serviço (e opcionalmente uma série) | data, horário, vagas (opcional), visibilidade, dispensa pré-cadastro, profissional (texto), estações, estado |
| Paciente | Central | CPF, hash da senha, nome, e-mail, telefone, data de nascimento, consentimentos |
| Cadastro na unidade | Paciente × Unidade | dados do formulário, Cartão SUS, foto do documento com foto, foto do Cartão SUS, ID de atendimento, estado de validação, validado por, validado em |
| Encaminhamento | Paciente × Serviço | foto, data de emissão, validade, estado (pendente, aceito, rejeitado, vencido), motivo |
| Entrada na lista de espera | Paciente × Serviço | data de entrada original, classificação de risco (sugerida e confirmada), prioridade legal, remanejado, recusas, estado |
| Questionário de risco | Entrada | respostas estruturadas, nível sugerido, data; histórico de versões |
| Alocação | Entrada × Sessão | alocado por, motivos da sugestão, prazo de confirmação, estado da confirmação |
| Entrada na fila | Sessão × Paciente | senha, origem (alocado, público, balcão), etapa atual, presença, posição original (número sequencial), pulos no dia, chamadas, estado |
| Chamada | Entrada na fila × Estação | horário, rechamadas, resultado (compareceu, pulado) |
| Estação | Unidade | nome (ex.: Consultório 3), etapa, serviços atendidos, profissional logado (aberta ou fechada) |
| Dispositivo TV | Unidade | nome, token de pareamento, último sinal de vida, revogado |
| Ocorrência de falta | Paciente × Unidade | data, tipo (faltou sem avisar, não compareceu à chamada) |
| Usuário do painel | Município | nome, login, perfis com escopo |
| Evento de auditoria | Município | quem, o quê, quando, sobre qual registro |

## 6. Configurações

Cada nível herda o padrão do nível acima quando não define o seu.

| Nível | Configuração | Padrão |
| --- | --- | --- |
| Município | Cadastro ativo em uma só unidade do município por vez | Desligado |
| Município | Alerta de faltas: número de faltas no período | 2 faltas em 90 dias |
| Município | Pergunta "ainda precisa?" na lista de espera: intervalo e prazo de resposta | 30 dias / 7 dias |
| Unidade | Tipo | UBS |
| Unidade | Endereço, coordenadas, fuso horário e horário de funcionamento | — (obrigatório) |
| Unidade | Exige pré-cadastro | Desligado |
| Unidade | Só atende pacientes com cadastro validado na unidade (vínculo) | Desligado |
| Unidade | Aviso "saia de casa": tempo estimado até a chamada | 30 min |
| Unidade | Tolerância de chamada | 5 min |
| Unidade | Tamanho da janela protegida (K) | 1 |
| Unidade | Intervalo de troca do QR de entrada | 30 s |
| Unidade | Prazo de confirmação da alocação | 24 h |
| Serviço | Nome e prefixo de senha | — (obrigatório) |
| Serviço | Exige triagem | Desligado |
| Serviço | Exige encaminhamento | Desligado |
| Serviço | Tempo médio inicial por atendimento (por etapa) | 15 min |
| Sessão | Data e horário; recorrência opcional (RRULE/EXDATE/RDATE, RFC 5545) | — (obrigatório) |
| Sessão | Vagas | Sem limite (recomendado definir) |
| Sessão | Visibilidade: pública ou privada (alterável a qualquer momento) | Privada |
| Sessão | Profissional (texto informativo) e estações | — |
| Sessão | Dispensa pré-cadastro: ignora as exigências de pré-cadastro e de vínculo da unidade (ex.: plantão), pública ou privada (AD-016) | Desligado |

## 7. Lista de espera, risco, encaminhamento e alocação

O caminho de uma sessão privada é: **entrada na lista → questionário → (encaminhamento) → sugestão → agendador aloca → paciente confirma → fila do dia**. Sessões públicas pulam a alocação.

### 7.1 Agenda da unidade (app)

- RN-AG-01: ao tocar numa unidade no mapa, o paciente vê horário de funcionamento e as sessões futuras: serviço, dia, visibilidade e vagas restantes (ex.: "Terça, 12/11 · Cardiologia · privada · 20 vagas").
- RN-AG-02: o paciente nunca vê quem está na lista ou na sessão.

### 7.2 Entrada na lista de espera

- RN-LE-01: o paciente só cria uma entrada se todas as condições valerem:
  - o serviço aceita entrada pelo app;
  - quando a unidade exige **vínculo**, ele já tem pré-cadastro **validado** nela;
  - quando a unidade exige **pré-cadastro** (sem vínculo), ele já **enviou** o pré-cadastro. A validação pode acontecer na primeira ida.
  - as duas exigências acima não valem para inscrição numa sessão pública que **dispensa pré-cadastro** (AD-016).
- RN-LE-02: no máximo **uma entrada ativa por serviço** por paciente. Ele pode estar em serviços diferentes ao mesmo tempo.
- RN-LE-03: a entrada guarda a **data de entrada original**, que serve de desempate em todas as ordenações.
- RN-LE-04: a recepção pode criar entradas pelo painel para quem não tem app.

### 7.3 Classificação de risco (Manchester reduzido)

O questionário é estruturado (sem texto livre) e serve para identificar risco de cara: sinais de emergência, sintomas relevantes e comorbidades.

| Nível | Significado | Efeito |
| --- | --- | --- |
| Emergência | Sinal de alarme (ex.: falta de ar intensa, dor no peito) | Não entra na lista. App orienta ligar para o SAMU (192) |
| Urgente | Risco relevante | Sugerido no topo; alerta ao agendador |
| Atenção | Comorbidade ou sintoma que pede prioridade | Acima de rotina |
| Rotina | Sem sinais de risco (ex.: exame de rotina) | Ordem normal |

- RN-RISCO-01: o nível calculado pelo app é sempre **sugerido**. Passa a **confirmado** quando o agendador aloca a entrada (ele pode alterar o nível nesse momento) ou quando a triagem classifica. A triagem tem a palavra final.
- RN-RISCO-02: em sessão pública e no balcão não há agendador; o nível fica sugerido até a triagem confirmar. No balcão, a recepção aplica o mesmo questionário com o paciente; se o resultado for emergência, o painel orienta encaminhá-lo à emergência. Em serviço sem triagem, ele permanece sugerido.
- RN-RISCO-03: o paciente pode refazer o questionário enquanto espera. Se subir para urgente, o agendador recebe alerta. Se cair em emergência, o app orienta ligar para o SAMU (192).
- RN-RISCO-04: a **prioridade legal** é um campo separado, declarado pelo paciente: idoso (60+, e 80+ com prioridade especial), gestante, lactante, pessoa com criança de colo, PcD, TEA, pessoa com obesidade. Vale como declarada até a recepção conferir; a recepção pode corrigir. A ordem entre os grupos segue a lei, sem regras próprias: os maiores de 80 anos vêm antes dos demais idosos, e entre grupos diferentes não há hierarquia.

#### Questionário v1 (proposta: validar com enfermeiro)

Meta: menos de 1 minuto, só toques, sem texto livre. "Nenhum destes" e "Nenhuma" são exclusivos: marcá-los desmarca as outras opções da tela. A Tela 3 só aparece para "problema novo".

| Tela | Pergunta | Opções |
| --- | --- | --- |
| 1 | Você está com algum destes agora? (vários) | Falta de ar forte ou dificuldade para respirar · Dor ou aperto forte no peito · Desmaio, confusão ou sonolência estranha · Fraqueza, formigamento ou boca torta de repente · Sangramento que não para · Convulsão · Pensamentos de tirar a própria vida ou de se machucar · Nenhum destes |
| 2 | Por que você quer o atendimento? (uma) | Problema novo ou que piorou · Acompanhamento de doença que já tenho · Exame, check-up ou rotina · Renovar receita |
| 3 | Como está esse problema? (uma) | Leve, faço as coisas normalmente · Moderado, atrapalha o dia · Forte, não consigo fazer quase nada |
| 4 | Você tem alguma destas condições? (vários) | Diabetes · Pressão alta · Doença do coração · Asma, bronquite ou DPOC · Câncer em tratamento · Imunidade baixa (transplante, HIV, uso de corticoide) · Nenhuma |
| 5 | Alguma destas se aplica a você? (vários) | Gestante · Lactante · Com criança de colo · Pessoa com deficiência · TEA · Obesidade · Nenhuma |

A idade vem da data de nascimento. A Tela 5 alimenta a prioridade legal (RN-RISCO-04) e vem preenchida com a resposta anterior.

**Regras de classificação** (vale a primeira que bater, de cima para baixo):

| Resultado | Quando | Efeito |
| --- | --- | --- |
| Emergência | Qualquer item da Tela 1, exceto pensamentos de tirar a própria vida | Não entra na lista. O app mostra o botão para ligar 192 (SAMU) |
| Urgente + apoio | Pensamentos de tirar a própria vida ou de se machucar | O app mostra CVV (188) e SAMU (192) em destaque. A pessoa **pode seguir** e entra como Urgente; o agendador recebe alerta |
| Urgente | Problema novo forte; ou gestante com problema novo moderado | Topo da sugestão; alerta ao agendador |
| Atenção | Problema novo moderado; ou problema novo com condição da Tela 4; ou problema novo com idade abaixo de 2 ou a partir de 60 anos; ou gestante com problema novo leve | Acima de rotina |
| Rotina | Todo o resto | Ordem normal |

- RN-RISCO-05: a ficha do agendador mostra o nível sugerido, a regra que o gerou, as respostas, a idade e a prioridade legal. Todo resultado do questionário, inclusive "Urgente + apoio", é gravado como sugerido; só vira urgência confirmada por agendador ou triagem.
- RN-RISCO-06: a resposta sobre pensamentos de tirar a própria vida só é visível para os perfis de agendador e triagem daquela unidade.

### 7.4 Encaminhamento

- RN-ENC-01: serviços com "exige encaminhamento" pedem a foto da requisição na entrada.
- RN-ENC-02: o agendador valida: autenticidade, se é para aquele serviço e se está dentro da validade. Pode aceitar ou rejeitar com motivo.
- RN-ENC-03: entrada com encaminhamento pendente, rejeitado ou vencido não é alocável. O paciente é avisado e pode enviar outro.
- RN-ENC-04 (AD-015): em sessão pública, a inscrição com encaminhamento segura a vaga até o agendador aceitar a foto; aceita, vira confirmada. Rejeitada, o paciente pode enviar outra. Se não estiver aceita na abertura da sessão, a vaga é liberada e a entrada volta a "aguardando encaminhamento".

### 7.5 Alocação em sessão privada

- RN-AL-01: o sistema **sugere** quais entradas ocupam as vagas da sessão, com os motivos de cada uma em relação às demais (ex.: "urgente sugerido · idosa, 82 anos · espera há 41 dias").
- RN-AL-02: ordem da sugestão:
  1. urgência confirmada;
  2. remanejados;
  3. demais, por nível de risco vigente, depois prioridade legal, depois data de entrada original.
- RN-AL-03: a sugestão mostra o alerta de faltas do paciente, quando houver.
- RN-AL-04: o agendador confirma, remove ou troca pacientes. **Nada é alocado automaticamente.**
- RN-AL-05: a alocação acontece até a véspera da sessão.
- RN-AL-06: nenhum caminho coloca mais pacientes que as vagas da sessão: alocação, inscrição pública ou balcão. Nem admin nem recepção podem furar o limite.

### 7.6 Confirmação

- RN-CONF-01: ao ser alocado, o paciente recebe push e vê a confirmação no app. Prazo: 24 h, sem passar da abertura da sessão.
- RN-CONF-02: o agendador pode confirmar ou registrar recusa em nome do paciente, depois de ligar para ele.
- RN-CONF-03: toda alocação pendente aparece desde já na **lista de ligação** do painel, ordenada pela sessão mais próxima. Depois de 24 h sem resposta, ela fica destacada. Na prática, esse é o caminho principal, porque muita gente não vê o push.
- RN-CONF-04: a recusa libera a vaga na hora, e o sistema sugere o próximo. Alocação ainda pendente na abertura da sessão também é liberada. A entrada volta para a lista de espera mantendo a data original.

### 7.7 Sessão pública

- RN-PUB-01 (AD-013): o paciente se inscreve direto na sessão, sem alocação e sem aprovação, e já entra **confirmado** (ele escolheu o dia). Se a sessão já estiver aberta, entra direto na fila remota com o próximo número. Exceção: serviço com encaminhamento (RN-ENC-04).
- RN-PUB-02: sessão lotada abre a **lista de reserva** da sessão. Cada vaga liberada vai para o primeiro da reserva, que recebe push e entra confirmado (direto na fila remota, se a sessão já estiver aberta).
- RN-PUB-03: pública → privada: quem já entrou permanece e novas inscrições são bloqueadas. Privada → pública: abre autoinscrição até preencher as vagas restantes.

## 8. Fila do dia

Só é chamado quem está presente. Entre os presentes, vale a prioridade e depois a posição original, e os próximos K presentes não podem ser ultrapassados por quem acabou de chegar, salvo urgência confirmada.

### 8.1 Abertura e entrada na fila

- RN-FILA-01: a sessão abre no horário de início (o admin pode abrir antes). Nesse momento, todos os confirmados entram **na fila remota** e recebem senha e **número** (posição original). Os números seguem a ordem da data de entrada original (alocados) ou da hora da inscrição (sessão pública), da mais antiga para a mais nova.
- RN-FILA-02: quem entra depois da abertura (inscrição pública no dia, vaga da lista de reserva, balcão) recebe o próximo número livre, na hora em que entra.
- RN-FILA-03: paciente incluído pela recepção já entra como **presente**.
- RN-FILA-04: a senha tem o prefixo do serviço, é única na sessão e é a mesma em todas as etapas. O número também se mantém entre as etapas.
- RN-FILA-05: quando a unidade exige pré-cadastro, a sessão não o dispensa (AD-016) e o do paciente ainda não foi validado, o check-in o deixa como **presente, aguardando validação**. Ele não é elegível até a recepção validar, e o app mostra "passe na recepção com seu ID de atendimento".
- RN-FILA-06: ao encerrar a sessão, o sistema separa quem faltou (RN-FALTA-01) de quem é remanejado (RN-SES-02).

### 8.2 Presença

- RN-PRES-01: **entrada** = ler o QR rotativo exibido na TV. O QR é um token assinado que troca a cada 30 s; uma foto dele não funciona depois. A validade é conferida pelo relógio do servidor, que aceita o código atual e o imediatamente anterior, para tolerar uma leitura lenta. O relógio do celular não importa.
- RN-PRES-02: **saída** = botão "Vou sair" no app, de qualquer lugar. O paciente volta para remoto e mantém a posição.
- RN-PRES-03: a **recepção** pode marcar presença para quem não tem app, não conseguiu ler o QR ou está validando o pré-cadastro.
- RN-PRES-04: quem esqueceu de marcar a saída e não aparece à chamada é marcado pelo profissional como "Não compareceu" (RN-CHAM-03).

### 8.3 Ordem de chamada

```
elegiveis = entradas da etapa, com presenca = PRESENTE,
            liberadas para chamada (pre-cadastro validado, quando exigido),
            dos servicos atendidos pela estacao que chama

ordem (RN-ORD), aplicada a qualquer conjunto de entradas:
  1. urgencia confirmada primeiro
  2 e 3, na ordem configurada pelo municipio (AD-004;
     padrao: risco antes, alternativa: prioridade legal antes):
     - nivel de risco vigente: urgente > atencao > rotina
       vigente = confirmado, se houver; senao, sugerido
     - prioridade legal (lei): com prioridade > sem;
       entre idosos, 80+ antes de 60-79; entre grupos diferentes, empate
  4. numero (posicao original), o menor primeiro

chamar proximo = primeiro de ordem(elegiveis)

janela protegida (K, padrao 1):
  no instante em que X fica elegivel (check-in, validacao ou 1o pulo),
  os K primeiros de ordem(elegiveis) ficam travados a frente de X,
  mesmo que X venha antes deles na ordem.
  excecao: X tem urgencia confirmada.
  a trava acaba quando esses K forem chamados.

atraso (AD-010: pela ordem real, nunca pelo numero):
  se, quando X fica elegivel, ja foi chamado nesta etapa alguem
  que vem depois de X em ordem (e, se X tocou "Vou sair",
  chamado enquanto X estava fora), X perdeu a vez:
  X recebe o proximo numero livre (vai para o fim).
  excecao: X tem urgencia confirmada.

"a vez passou" (usado em falta e remanejamento) =
  ja foi chamado, na etapa atual de X, alguem que vem depois de X em ordem
```

- RN-ORD-01: exemplo: João está presente e é o próximo. Ana, que estava remota com posição igual ou melhor, faz check-in agora. João é chamado primeiro; Ana vem logo depois.
- RN-ORD-02: urgente confirmado remoto recebe aviso imediato **"venha agora"**, sem esperar o limite de 30 min.

* RN-ORD-03: exemplo de check-ins seguidos (K = 1). A ordem de inscrição é Bruno, Ana, João. João está presente e é o próximo. Ana faz check-in: ordem João, Ana. Bruno faz check-in a tempo: ordem **João, Bruno, Ana**. Bruno não furou a fila, porque sempre esteve à frente de Ana.
* RN-ORD-04: exemplo de atraso. Se Bruno chega depois que Ana já foi chamada, ele perdeu a vez e vai para o fim dos presentes.
* RN-ORD-05: como o app sempre mostra a posição real (RN-ETA-04), a posição de quem está presente nunca piora quando alguém chega a tempo.

### 8.4 Estimativa e aviso de saída

- RN-ETA-01 (paciente **remoto**): pessoas à frente = quantas entradas da mesma etapa e serviço vêm antes do paciente em ordem(todas), contando presentes e remotas e ignorando a elegibilidade. Tempo estimado = pessoas à frente × tempo médio da etapa (RN-ETA-05) ÷ estações abertas para aquele serviço e etapa.
- RN-ETA-01b (AD-002, paciente **presente**): posição = lugar na ordem de chamada real entre os elegíveis da etapa e do serviço, já com a janela protegida. Tempo estimado = (posição − 1) × tempo médio da etapa ÷ estações abertas.
- RN-ETA-01c (AD-009): em serviços com triagem, quem ainda não foi triado vê o tempo até a **triagem** (é ele que dispara o "saia de casa") e, à parte, a previsão da consulta.
- RN-ETA-02: sem estação aberta, o app mostra "aguardando início do atendimento" em vez de um tempo.
- RN-ETA-03: quando o tempo estimado de um paciente remoto até a etapa atual cair abaixo do limite da unidade (padrão 30 min), ele recebe o push "saia de casa". O aviso é enviado uma vez por etapa (AD-009).
- RN-ETA-04: no app, o paciente vê só a própria posição (RN-ETA-01 ou 01b) e o tempo estimado ("você é o 4º · \~12 min"), além dos contadores da TV. Remoto que já é o 1º, com estação aberta, vê **"venha agora"** em vez de "1º · \~0 min" (AD-003); ele só é chamado depois de ler o QR.

RN-ETA-05 (proposta de algoritmo): cálculo do tempo médio de uma etapa num serviço.

1. A duração de um atendimento é o intervalo entre a chamada do paciente e a próxima chamada na mesma estação. A última chamada do dia de cada estação não entra.
2. Pegam-se os últimos 10 atendimentos concluídos daquela etapa e serviço, no dia.
3. Descartam-se os fora da curva: abaixo de 1/3 ou acima de 3 vezes a mediana desses 10 (ex.: pausa para almoço, chamada repetida por engano).
4. A média dos que sobraram é o tempo médio.
5. Com menos de 3 atendimentos válidos no dia, usa-se o tempo médio inicial do serviço.

### 8.5 Chamada

- RN-CHAM-01: o profissional clica em **Chamar próximo**. O sistema pega o primeiro elegível da etapa e dos serviços daquela estação, mostra na TV e envia push. A seleção é atômica: se duas estações chamam ao mesmo tempo, cada uma recebe um paciente diferente.
- RN-CHAM-02: chamar o próximo encerra a chamada anterior como **atendido** (ou triado, na triagem). **Rechamar** repete o anúncio, sem reiniciar a tolerância. O botão Finalizar encerra o atendimento atual sem chamar outro (fim do expediente ou pausa).
- RN-CHAM-03 (AD-006): **não há pulo automático**. A tolerância (padrão 5 min) é só um contador na estação, que avisa "tolerância esgotada". A fila avança só quando o profissional toca **Chamar próximo** (fecha o atual como atendido) ou **Não compareceu** (pula o atual), que fica disponível a qualquer momento enquanto há alguém chamado. No 1º pulo, continua presente e é tratado como se tivesse acabado de ficar elegível: a janela protegida se aplica, e ele é chamado depois dos próximos K. No 2º pulo, volta para remoto; ao se reapresentar, vale a regra de atraso (fim dos presentes). No 3º pulo no dia, somando as etapas, sai da fila, registra "não compareceu à chamada" e pode entrar de novo na lista de espera como entrada nova.

### 8.6 Triagem

- RN-TRI-01: serviços com triagem têm duas etapas, triagem e atendimento, com as mesmas regras de presença, ordem e chamada.
- RN-TRI-02: uma estação de triagem pode atender vários serviços. Nesse caso, junta os pacientes deles numa só ordem (RN-ORD).
- RN-TRI-03: na triagem, o profissional confirma ou reclassifica o risco. Essa passa a ser a classificação confirmada.
- RN-TRI-04: depois da triagem, o paciente entra na fila de atendimento com a mesma senha. A ordem usa a classificação confirmada, a prioridade legal e a posição original na fila do dia (não a hora da triagem).
- RN-TRI-05 (AD-009): a regra de presença continua valendo entre as etapas. O paciente pode tocar em "Vou sair" depois da triagem e recebe um novo "saia de casa" quando o atendimento se aproximar (um aviso por etapa). Ao voltar, vale a regra de atraso pela ordem (AD-010).
- RN-TRI-06 (proposta): o sistema só sugere chamar para a triagem quem tem previsão de atendimento próxima, para que a triagem não vire uma segunda espera.

### 8.7 Encerramento

- RN-SES-01: a sessão só encerra quando o admin a encerra. No horário de fim, o painel lembra o admin.
- RN-SES-02: ao encerrar, quem ainda está na fila e cuja vez **não passou** vira **remanejado** (seção 13). Quem estava remoto e cuja vez passou registra falta (RN-FALTA-01). Quem estava presente na unidade é sempre remanejado, nunca faltoso.
- RN-SES-03: o encerramento só é permitido quando nenhuma estação tem paciente chamado. O painel mostra as estações que ainda precisam finalizar.

## 9. Máquinas de estado

Há dois ciclos de vida: o da **entrada na lista de espera** (dias ou semanas) e o da **entrada na fila do dia** (horas).

### 9.1 Entrada na lista de espera

| Estado | Significa | Final? |
| --- | --- | --- |
| Aguardando encaminhamento | Falta foto válida do encaminhamento | Não |
| Aguardando | Na lista, pronta para ser sugerida | Não |
| Alocada | Aguarda confirmação | Não |
| Confirmada | Entra na fila quando a sessão abrir | Não |
| Na fila | Está na fila do dia | Não |
| Remanejada | Perdeu o atendimento por culpa da unidade; tem precedência | Não |
| Arquivada | Não respondeu "ainda precisa?" | Não (pode reativar) |
| Concluída | Foi atendida na última etapa | Sim |
| Cancelada | Paciente desistiu | Sim |
| Encerrada sem atendimento | Saiu da fila por 3 pulos, ou faltou | Sim |

### 9.2 Entrada na fila do dia

&#91;embedded content: estados da entrada na fila do dia · 6 estados\]

Remoto e presente se alternam livremente; só o presente é chamado. Em serviços com triagem, o triado volta para presente na etapa de atendimento e segue as mesmas regras.

### 9.3 Contratos de comportamento

As tabelas abaixo são a fonte da verdade para implementação e testes. Toda transição não listada é **proibida** e deve retornar erro.

**Sessão**

| De | Evento | Quem / condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| — | Cria sessão | Admin | Planejada | — |
| Planejada | Horário de início chega, ou admin abre antes | Sistema / Admin | Aberta | Confirmadas entram na fila (RN-FILA-01); alocações pendentes liberadas (RN-CONF-04) |
| Planejada ou Aberta | Cancela | Admin | Cancelada | Entradas não finais, inclusive a chamada no momento, viram remanejadas; push |
| Aberta | Encerra | Admin; nenhuma estação com paciente chamado (RN-SES-03) | Encerrada | Separa faltas e remanejados (RN-SES-02) |
| Planejada ou Aberta | Muda visibilidade | Admin | (mesmo) | RN-PUB-03 |

**Entrada na lista de espera**

| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| — | Paciente ou recepção cria | RN-LE-01 ok; serviço exige encaminhamento | Aguardando encaminhamento | Nível sugerido calculado |
| — | Paciente ou recepção cria | RN-LE-01 ok; sem exigência | Aguardando | Nível sugerido calculado |
| — | Questionário = Emergência | — | (não cria) | Mostra 192 |
| Aguardando encaminhamento | Agendador aceita | Dentro da validade | Aguardando | Push |
| Aguardando encaminhamento | Agendador rejeita | — | (mesmo) | Push com motivo |
| Aguardando | Encaminhamento vence | — | Aguardando encaminhamento | Push |
| Aguardando ou Remanejada | Agendador aloca | Vaga livre (INV-02) | Alocada | Push "confirme"; aparece na lista de ligação |
| Alocada | Paciente ou agendador confirma | Antes da abertura | Confirmada | Log |
| Alocada | Recusa | Não remanejada, ou 2ª recusa de remanejada | Aguardando (data original) | Vaga liberada; sugere o próximo |
| Alocada | Recusa | 1ª recusa de remanejada | Remanejada | Recusas +1 |
| Alocada | Sessão abre sem confirmação | — | Aguardando (data original) | Vaga liberada |
| — | Inscrição pública | Vaga livre; sem encaminhamento exigido | Confirmada | AD-013 |
| — | Inscrição pública | Vaga livre; encaminhamento exigido | Aguardando encaminhamento (vaga segura) | RN-ENC-04 |
| Aguardando encaminhamento (vaga segura) | Agendador aceita | Antes da abertura | Confirmada | Push |
| Aguardando encaminhamento (vaga segura) | Sessão abre sem aceite | — | Aguardando encaminhamento | Vaga liberada; push |
| Confirmada | Sessão abre | — | Na fila | Senha; push |
| Alocada, Confirmada ou Na fila | Paciente cancela | — | Cancelada | Vaga liberada (RN-CANC-02) |
| Alocada, Confirmada ou Na fila | Sessão cancelada, ou encerrada antes da vez | — | Remanejada | Push |
| Na fila | Atendida na última etapa | — | Concluída | — |
| Na fila | 3º pulo, ou falta no encerramento | — | Encerrada sem atendimento | Registra ocorrência de falta |
| Aguardando | A cada 30 dias na lista | — | (mesmo) | Push "ainda precisa?" |
| Aguardando | 7 dias sem resposta à pergunta | — | Arquivada | Push |
| Arquivada | Paciente reativa | Até 30 dias (proposta) | Aguardando (data original) | — |
| Aguardando ou Aguardando encaminhamento | Paciente cancela | — | Cancelada | — |

**Entrada na fila do dia** (por etapa)

| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| — | Sessão abre | Entrada confirmada | Remoto | Senha; número por RN-FILA-01 |
| — | Inscrição pública com a sessão aberta (encaminhamento aceito, quando exigido), ou vaga da lista de reserva | Vaga livre | Remoto | Senha; próximo número |
| — | Recepção inclui no balcão | Vaga livre | Presente | Senha anotada ou impressa; próximo número |
| Remoto | QR válido ou recepção marca | Pré-cadastro validado, não exigido ou dispensado pela sessão | Presente | Aplica janela protegida e regra de atraso |
| Remoto | QR válido | Pré-cadastro exigido, não dispensado pela sessão e não validado | Presente aguardando validação | App: "passe na recepção" |
| Presente aguardando validação | Recepção valida | — | Presente | Aplica janela protegida e regra de atraso |
| Presente ou Presente aguardando validação | Paciente toca "Vou sair" | — | Remoto | Mantém o número |
| Presente | Estação chama o próximo | É o 1º de ordem(elegíveis) | Chamado | TV com som; push; inicia tolerância |
| Chamado | Rechamar | — | (mesmo) | Novo anúncio; tolerância não reinicia |
| Chamado | Estação chama o próximo ou toca Finalizar | — | Atendido na etapa | Há outra etapa: Presente nela, mesmo número. Senão: entrada Concluída |
| Chamado | Profissional toca "Não compareceu" (AD-006) | Pulos no dia = 0 | Presente | Pulos = 1; aplica janela protegida |
| Chamado | Profissional toca "Não compareceu" | Pulos no dia = 1 | Remoto | Pulos = 2; push |
| Chamado | Profissional toca "Não compareceu" | Pulos no dia = 2 | Saiu da fila | Pulos = 3; ocorrência de falta; push |
| Remoto, Presente ou Presente aguardando validação | Paciente cancela | — | Saiu da fila | Vaga vai para a lista de reserva, se houver |
| Qualquer não final | Sessão cancelada | — | Remanejado | Push |
| Remoto, Presente ou Presente aguardando validação | Sessão encerrada | A vez não passou | Remanejado | Push |
| Remoto | Sessão encerrada | A vez passou | Saiu da fila | Ocorrência de falta |
| Presente ou Presente aguardando validação | Sessão encerrada | A vez passou | Remanejado | Push (estava na unidade; não é falta) |

**Invariantes** (nunca podem ser violados; cada um vira teste)

- INV-01: um paciente tem no máximo uma entrada ativa por serviço.
- INV-02: entradas não finais numa sessão, somando alocadas, confirmadas, inscritas e do balcão, ≤ vagas.
- INV-03: só elegíveis são chamados. Remoto nunca é chamado.
- INV-04: um paciente está chamado em no máximo uma estação por vez.
- INV-05: a senha é única na sessão.
- INV-06: nenhuma resposta ao app do paciente contém dados de outro paciente. A TV mostra só senhas e contadores.
- INV-07: nível confirmado só é gravado por agendador ou triagem.
- INV-08: nenhuma alocação existe sem ação de um agendador.
- INV-09: a data de entrada original de uma entrada nunca muda.
- INV-10: remanejado nunca tira a vaga de quem já está confirmado.
- INV-11: a camada central nunca armazena sintomas, documentos ou dados de fila.
- INV-12: toda ação do painel gera evento de auditoria.

**Matriz de permissões**

| Ação | Paciente | Gestor | Admin | Agendador | Recepção | Triagem | Profissional |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Criar unidades, regras do município e usuários do painel |  | ✓ |  |  |  |  |  |
| Configurar serviços, sessões, estações; parear e revogar TV |  |  | ✓ |  |  |  |  |
| Abrir, cancelar, encerrar sessão; mudar visibilidade |  |  | ✓ |  |  |  |  |
| Criar entrada na lista | ✓ (própria) |  |  |  | ✓ |  |  |
| Incluir paciente no balcão; marcar presença |  |  |  |  | ✓ |  |  |
| Validar pré-cadastro; corrigir prioridade legal |  |  |  |  | ✓ |  |  |
| Ver documentos (foto do documento, Cartão SUS) | ✓ (próprios) |  |  | ✓ | ✓ |  |  |
| Ver respostas do questionário | ✓ (próprias) |  |  | ✓ | ✓ | ✓ |  |
| Ver resposta sobre pensamentos de tirar a própria vida | ✓ (própria) |  |  | ✓ |  | ✓ |  |
| Validar encaminhamento |  |  |  | ✓ |  |  |  |
| Alocar; confirmar ou recusar em nome do paciente |  |  |  | ✓ |  |  |  |
| Confirmar nível de risco |  |  |  | ✓ (na alocação) |  | ✓ |  |
| Chamar, rechamar, pular |  |  |  |  |  | ✓ (triagem) | ✓ (atendimento) |
| Cancelar a própria vaga; check-in; "Vou sair" | ✓ |  |  |  |  |  |  |

Perfis são acumuláveis e concedidos por unidade (seção 4). Quem precisa de mais de uma coluna recebe mais de um perfil.

## 10. Identidade, login e pré-cadastro

O paciente tem **uma conta central** (CPF + senha), válida em qualquer município. O pré-cadastro é feito **uma vez por unidade** e validado presencialmente.

### 10.1 Conta e login

- RN-ID-01: login com CPF + senha. O CPF é validado pelos dígitos verificadores. Sem SMS e sem segundo fator no MVP. A recuperação de senha é feita por código enviado ao e-mail cadastrado.
- RN-ID-02: um CPF só pode ter uma conta. Se alguém tentar criar conta com um CPF já usado, o app orienta procurar a recepção para contestar.
- RN-ID-03: a recepção pode vincular a identidade à pessoa presencialmente (documento com foto) e bloquear uma conta usurpada.
- RN-ID-04: senha com política mínima, armazenada com hash forte, e bloqueio temporário após tentativas seguidas de erro.

### 10.2 Pré-cadastro na unidade

- RN-PRE-01: se a unidade exige pré-cadastro, o paciente preenche: nome completo, data de nascimento, telefone, endereço, número do Cartão SUS, foto de **documento com foto** e foto do **Cartão SUS**.
- RN-PRE-02: o sistema gera um **ID de atendimento** de 6 caracteres, também em QR.
- RN-PRE-03: na primeira ida, o paciente mostra o ID na recepção. O atendente confere a pessoa com o documento e marca **validado**.
- RN-PRE-04: o cadastro validado vale para todas as próximas idas àquela unidade, até ser revogado.
- RN-PRE-05: se o município ativar "uma unidade por vez", validar o cadastro numa unidade nova desativa o da antiga (**transferência**). Não há fluxo próprio: o paciente faz o pré-cadastro na nova unidade, e a validação presencial conclui a transferência. As entradas da unidade antiga são arquivadas, e o paciente é avisado para se inscrever de novo na nova unidade, com data nova. Se ele tiver alocação ou consulta confirmada na unidade antiga, a validação na nova só é liberada depois dessa sessão ou se ele cancelar.
- RN-PRE-06: quem não tem app faz o pré-cadastro na recepção, que preenche os dados e fotografa os documentos.

## 11. Notificações

No MVP, o único canal automático é o **push do app**. Como muita gente não vê o push, o canal de segurança é a **lista de ligação** do agendador. O onboarding pede permissão de notificação e explica por que ela é essencial.

| Evento | Quem recebe | Canal |
| --- | --- | --- |
| Alocado numa sessão: confirme em 24 h | Paciente | Push + tela no app |
| Alocação pendente de confirmação (destacada após 24 h) | Agendador | Lista de ligação no painel |
| Sessão aberta: você está na fila remota | Paciente | Push |
| Saia de casa (tempo estimado abaixo do limite) | Paciente | Push |
| Venha agora (urgente confirmado) | Paciente | Push |
| Sua vez: senha, serviço e sala | Paciente | Push + TV |
| Você foi pulado / perdeu a vez | Paciente | Push |
| Sessão cancelada, remarcada ou aguardando nova data | Paciente | Push |
| Vaga liberada para quem está na lista de reserva | Paciente | Push |
| Encaminhamento aceito, rejeitado ou vencido | Paciente | Push |
| Cadastro validado ou transferido | Paciente | Push |
| Você faltou 2 vezes nos últimos 90 dias | Paciente | Push |
| Ainda precisa deste atendimento? | Paciente | Push + tela no app |
| Paciente refez o questionário e subiu para urgente | Agendador | Alerta no painel |

- RN-NOT-01: nenhuma notificação contém sintomas ou dados clínicos, só a ação e o local.
- RN-NOT-02: WhatsApp fica fora do MVP. Quando entrar, será a API oficial configurada e paga pela própria prefeitura.

## 12. Painel da TV e estação de chamada

A TV é **uma URL pareada**, uma por unidade, que mostra todos os serviços juntos. A estação é uma página no Chrome ou Edge do consultório, com uma mini-janela flutuante para chamar o próximo sem ocupar a tela do prontuário.

### 12.1 TV

- RN-TV-01: **pareamento**. A TV abre um endereço fixo e curto (ex.: `/tv`) e mostra um código de 6 dígitos. O admin digita o código no painel e vincula a TV à unidade. A TV fica autenticada até ser revogada.
- RN-TV-02: a URL sem pareamento não exibe nada da unidade. Isso protege o QR de entrada.
- RN-TV-03: **uma tela e uma fila por unidade** no MVP, com todos os serviços.
- RN-TV-04: botão **Iniciar painel** ao abrir, para liberar o som. Depois, um som de aviso a cada chamada. Sem voz.
- RN-TV-05 (AD-012): **sem nomes de pacientes**, nem o primeiro nome, só senhas. Quem é incluído no balcão recebe da recepção um papel com a senha, para conferir com a TV.
- RN-TV-06: página leve para TV fraca, fonte grande, legível do fundo da sala, reconexão automática. Indicador "online/offline" no painel do admin.
- RN-TV-07: duas chamadas ao mesmo tempo entram numa fila de anúncios; cada uma fica 10 s em destaque e depois desce para "últimas chamadas".

**Layout**

```
┌──────────────────────────────────────┬───────────────────┐
│          CHAMANDO AGORA              │ ÚLTIMAS CHAMADAS  │
│                                      │ O-007 · Consult. 2│
│        C-012                         │ G-031 · Consult. 1│
│        Cardiologia → Consultório 3   │ C-014 · Triagem 1 │
├──────────────────────────────────────┼───────────────────┤
│ CLÍNICO   5 aguardando · +3 a caminho │                   │
│ CARDIO    2 aguardando · +1 a caminho │   [ QR ENTRADA ]  │
│ ODONTO    1 aguardando                │   Leia ao chegar  │
└──────────────────────────────────────┴───────────────────┘
```

- Cada chamada mostra a senha e o destino: o consultório ou a sala de triagem. Como a senha é a mesma nas duas etapas, C-014 chamado para a triagem é o mesmo paciente que depois será chamado para o consultório.
- "Aguardando" conta os presentes; "a caminho", os remotos. São só números, nunca senhas da fila.
- Com mais de 4 serviços, a faixa de baixo rola automaticamente.

### 12.2 Estação de chamada

- RN-EST-01: cada consultório e sala de triagem é uma **estação**, ligada a uma etapa e a um ou mais serviços. O profissional faz login com o usuário dele e escolhe a estação.
- RN-EST-02: a estação roda no navegador e pode ser destacada numa **mini-janela flutuante**, sempre por cima do prontuário (recurso Document Picture-in-Picture do Chrome e do Edge). Ela mostra a próxima senha, o contador da tolerância e os botões Finalizar, **Chamar próximo**, **Rechamar** e **Não compareceu**.
- RN-EST-03: se a estação atende mais de um serviço, Chamar próximo junta os elegíveis desses serviços numa só ordem (RN-ORD). O profissional não escolhe o serviço.
- RN-EST-04: alternativa: a mesma estação em modo celular ou tablet, com botão grande.
- RN-EST-05 (AD-006): ao fim da tolerância a estação avisa, mas não pula sozinha; quem pula é o profissional, com "Não compareceu". Uma estação com paciente chamado não pode ser fechada.

### 12.3 Checklist de implantação (TI da prefeitura)

- [ ] Chrome ou Edge atualizado em cada consultório e sala de triagem
- [ ] Domínio do sistema liberado no firewall da rede municipal
- [ ] TV da sala de espera abrindo a URL da TV (smart TV, TV box ou computador no HDMI), com som ligado
- [ ] TV pareada no painel
- [ ] Estações cadastradas e testadas com uma chamada
- [ ] Usuários do painel criados com seus perfis

## 13. Exceções

A regra geral: **quem desiste perde a vez; quem é prejudicado pela unidade ganha preferência**.

### 13.1 Paciente cancela

- RN-CANC-01: botão "Não vou poder ir" no app, antes ou no dia.
- RN-CANC-02: a vaga é liberada e o sistema sugere o próximo (sessão privada) ou chama o primeiro da lista de reserva (sessão pública).
- RN-CANC-03: o paciente perde a vaga. Para tentar outro dia, faz uma **entrada nova** na lista de espera, sem a posição antiga.

### 13.2 Falta sem avisar

- RN-FALTA-01: é **falta** quando, no encerramento da sessão, o paciente confirmado estava remoto e a vez dele já tinha passado: foi chamado, na primeira etapa, alguém que vinha depois dele na ordem real (AD-010). Se a sessão encerrar antes da vez dele, ele é remanejado, não faltoso.
- RN-FALTA-02: sair da fila por 3 pulos no dia (RN-CHAM-03) também conta no mesmo limite.
- RN-FALTA-03: **não há bloqueio automático**. Ao atingir o limite (padrão 2 em 90 dias), o paciente recebe um alerta e o agendador vê o aviso ao alocá-lo.

### 13.3 Remanejamento (sessão cancelada ou encerrada)

Vira **remanejado** quem perdeu o atendimento por culpa da unidade:

- a sessão foi cancelada (médico faltou, feriado, outro motivo), incluindo inscritos de sessão pública;
- a sessão foi encerrada, ou cancelada no meio do dia, com gente na fila. No cancelamento, isso inclui o paciente que estava chamado (em atendimento) naquele momento. Quem já foi atendido não é afetado.

**Fluxo de cancelamento**

1. O admin cancela a sessão e informa o motivo.
2. O sistema pergunta: **"Já existe nova data?"**
3. **Sim**: o admin cria a **sessão de reposição** ali mesmo. Ela vem preenchida com os pacientes da sessão cancelada, como sugestão. O agendador revisa e confirma. Os pacientes recebem push com a nova data e seguem a confirmação normal.
4. **Não**: os pacientes vão para o grupo **"Aguardando remarcação"** daquele serviço e recebem push. Quando a próxima sessão do serviço for criada, o sistema mostra "N pacientes aguardam remarcação. Alocá-los primeiro?", já pré-selecionados.
5. Se a sessão de reposição tiver menos vagas que a cancelada, o sistema avisa quantos ficaram de fora; eles seguem como remanejados.

**Regras do remanejado**

- RN-REM-01: **precedência**: urgência confirmada → remanejado → lista comum.
- RN-REM-02: remanejado **nunca tira a vaga** de quem já está confirmado. A precedência vale só para vagas livres e sessões novas.
- RN-REM-03: pode **recusar a nova data uma vez** e continua remanejado. Na segunda recusa, volta para a lista comum com a data de entrada original.
- RN-REM-04: mantém a classificação de risco e a prioridade legal que já tinha.

### 13.4 Situação piorou

- RN-PIORA-01: ver RN-RISCO-03. O paciente refaz o questionário; urgente gera alerta ao agendador; emergência orienta SAMU (192).

### 13.5 Lista parada

- RN-PARADA-01: a cada 30 dias na lista, o app pergunta "Ainda precisa deste atendimento?".
- RN-PARADA-02: sem resposta em 7 dias, a entrada é **arquivada** (não apagada) e o paciente é avisado. Proposta: ele pode reativar a entrada mantendo a data original se fizer isso em até 30 dias.

## 14. Histórias de usuário e critérios de aceite

Prioridade P1 = sem ela o MVP não funciona; P2 = necessária para a operação real.

**US-01 · P1 · Ver unidades e agenda.** Como paciente, quero ver as unidades próximas e o que cada uma oferece.

- Dado que concedi localização, quando abro o app, então vejo no mapa as unidades dos municípios cadastrados ao meu redor.
- Quando toco numa unidade, então vejo horário de funcionamento e sessões futuras com serviço, dia, visibilidade e vagas restantes.
- Em nenhum momento vejo nomes ou dados de outros pacientes.

**US-02 · P1 · Entrar na lista de espera.** Como paciente, quero entrar na lista de um serviço informando o que sinto.

- Dado que o serviço aceita entrada pelo app e eu cumpro a regra de vínculo, quando respondo o questionário, então minha entrada é criada com nível sugerido.
- Dado que já tenho entrada ativa nesse serviço, quando tento entrar de novo, então o app recusa e mostra a entrada existente.
- Dado que marquei um sinal de alarme, então não entro na lista e o app mostra o botão para ligar 192.

**US-03 · P1 · Enviar encaminhamento.** Dado que o serviço exige encaminhamento, quando entro na lista, então preciso anexar a foto. O agendador aceita ou rejeita com motivo, e eu sou avisado.

**US-04 · P1 · Alocar pacientes.** Como agendador, quero preencher as vagas de uma sessão privada.

- Quando abro a sessão, então vejo a sugestão ordenada (urgência confirmada, remanejados, demais) com os motivos e alertas de falta.
- Quando confirmo, então cada paciente recebe push e o prazo de 24 h começa.
- Dado que outro agendador alocou a mesma vaga segundos antes, então recebo erro e a lista atualizada.

**US-05 · P1 · Confirmar presença no dia.** Dado que fui alocado, quando confirmo no app, então fico confirmado. Dado que ainda não confirmei, então apareço na lista de ligação (destacado após 24 h); o agendador liga e registra confirmado, recusado ou sem contato.

**US-06 · P1 · Fila remota.** Dado que estou confirmado, quando a sessão abre, então entro automaticamente na fila remota e vejo minha posição e tempo estimado. Quando o tempo estimado cai abaixo do limite, recebo "saia de casa".

**US-07 · P1 · Check-in e saída.** Quando leio o QR da TV, então fico presente. Dado que uso uma foto antiga do QR, então o check-in é recusado. Quando toco em "Vou sair", então volto para remoto com a mesma posição.

**US-08 · P1 · Janela protegida.** Dado que João está presente e é o próximo, quando Ana faz check-in com posição original melhor e mesma prioridade, então João é chamado antes e Ana logo depois.

**US-09 · P1 · Urgência confirmada.** Dado que a triagem confirmou meu caso como urgente, então passo à frente da janela protegida; se estou remoto, recebo "venha agora".

**US-10 · P1 · Chamar o próximo.** Como profissional, quando clico em Chamar próximo na mini-janela, então o primeiro presente da minha etapa aparece na TV com som, recebe push, e o anterior é marcado como atendido.

**US-11 · P1 · Tolerância.** Dado que fui chamado e não apareci, quando os 5 min passam, então a estação mostra "tolerância esgotada", mas só me pula quando o profissional toca "Não compareceu" (AD-006). No 1º pulo continuo presente, logo atrás da janela protegida. No 2º, volto para remoto. Dado que isso acontece pela 3ª vez no dia, somando as etapas, então saio da fila.

**US-12 · P1 · Balcão.** Como recepção, quero incluir quem não tem app. Quando cadastro o paciente no balcão, então ele entra presente, recebe senha anotada ou impressa e é chamado pela TV.

**US-13 · P1 · Pareamento da TV.** Quando a TV abre `/tv`, então mostra um código. Quando o admin digita o código, então a TV passa a exibir chamadas, contadores e QR da unidade. Quando o admin revoga, então a TV volta à tela de pareamento.

**US-14 · P2 · Pré-cadastro.** Dado que a unidade exige pré-cadastro, quando envio dados, documento com foto e Cartão SUS, então recebo o ID de atendimento. Quando mostro o ID na recepção e a pessoa confere, então meu cadastro fica validado para as próximas idas.

**US-15 · P2 · Cancelar sessão.** Como admin, quando cancelo uma sessão, então escolho entre criar a reposição ou deixar os pacientes aguardando remarcação, e todos recebem push. Na próxima sessão do serviço, eles aparecem pré-selecionados.

**US-16 · P2 · Sessão pública.** Dado que a sessão é pública e tem vagas, quando me inscrevo, então entro direto, já confirmado (AD-013); com encaminhamento exigido, minha vaga fica segura até a foto ser aceita (RN-ENC-04). Dado que lotou, então entro na lista de reserva e sou avisado se abrir vaga.

**US-17 · P2 · Cancelar minha vaga.** Quando toco em "Não vou poder ir", então a vaga é liberada e, para outro dia, preciso de uma entrada nova.

## 15. Requisitos não funcionais

A prefeitura é a **dona dos dados (controladora)** e a empresa é a **operadora**. Sintomas, documentos e localização são tratados como dados sensíveis.

### 15.1 Arquitetura de dados (direção, a detalhar no plan)

| Camada | Dono | O que guarda |
| --- | --- | --- |
| Central | Empresa | Catálogo de municípios e unidades (endereço, serviços, sessões públicas), identidade mínima do paciente (CPF, hash da senha, e-mail, telefone, consentimentos), roteamento para o município |
| Municipal | Prefeitura | Listas de espera, questionários, encaminhamentos, cadastros e fotos de documentos, filas, faltas, logs de acesso e auditoria |

- RNF-DADOS-01: cada município tem um banco **isolado**. O mesmo software roda na nuvem da empresa (conta separada) ou na infraestrutura da prefeitura.
- RNF-DADOS-02: a camada central nunca recebe sintomas, documentos ou dados de fila.
- RNF-DADOS-03: a prefeitura pode exportar todos os seus dados a qualquer momento. Dados armazenados no Brasil.

### 15.2 LGPD (validar com jurídico)

- RNF-LGPD-01: base legal provável é execução de política pública e tutela da saúde, e não só consentimento. O termo do app deve refletir isso.
- RNF-LGPD-02: Relatório de Impacto à Proteção de Dados (RIPD) antes da primeira implantação.
- RNF-LGPD-03: fotos de documentos ficam criptografadas, acessíveis só aos perfis autorizados, e **cada visualização é registrada**.
- RNF-LGPD-04: retenção das fotos enquanto o cadastro estiver ativo (são necessárias para validações futuras). Prazo de exclusão após inatividade a definir.
- RNF-LGPD-05: minimização: o questionário guarda respostas estruturadas, sem texto livre.
- RNF-LGPD-06: o paciente pode ver, corrigir e pedir exclusão dos seus dados pelo app, respeitadas as obrigações legais da prefeitura.

### 15.3 Segurança

- RNF-SEG-01: QR de entrada assinado, com validade curta e uso vinculado à conta.
- RNF-SEG-02: token da TV revogável; token da estação vinculado ao usuário logado.
- RNF-SEG-03: limite de tentativas no login e nas APIs públicas.
- RNF-SEG-04: auditoria de toda ação do painel (quem, o quê, quando).

### 15.4 Desempenho e confiabilidade

- RNF-DES-01: do clique em Chamar próximo até a senha aparecer na TV e o push sair: meta de até 3 s.
- RNF-DES-02: TV e app reconectam sozinhos após queda de internet e recuperam o estado atual.
- RNF-DES-03: o app funciona em redes lentas e celulares de entrada.

### 15.5 Acessibilidade e inclusão

- RNF-ACE-01: app com textos simples, fonte ajustável, contraste adequado e compatível com leitores de tela.
- RNF-ACE-02: todo fluxo do paciente tem equivalente pela recepção para quem não tem app.

## 16. Questões em aberto e próximos passos

**Em aberto**

- [ ] Validar o questionário v1 (7.3) e suas regras de classificação com enfermeiro ou médico.
- [x] Peso entre prioridade legal e nível de risco: configuração do município (AD-004).
- [ ] Validade do encaminhamento: o agendador informa a data de vencimento, ou o sistema assume um prazo padrão?
- [ ] Prazo de exclusão das fotos de documentos após inatividade do cadastro (RNF-LGPD-04).
- [ ] Migrar entradas entre unidades na transferência, mantendo a data original: fora do MVP, reavaliar com uso real.
- [ ] Triagem cadenciada pela previsão de atendimento (RN-TRI-06): validar com uma unidade piloto.
- [ ] Reativação de entrada arquivada mantendo a data original (RN-PARADA-02): confirmar os 30 dias.
- [ ] Área de abrangência por endereço como critério de vínculo, além do cadastro validado.
- [ ] Contingência: como a unidade opera se o sistema ou a internet cair (papel, senha manual).
- [ ] Hospedagem da camada municipal e modelo de custo para a prefeitura.
- [ ] Assumido nesta revisão, confirmar: sair da fila por 3 pulos conta como falta (RN-FALTA-02); destaque de 10 s por chamada na TV (RN-TV-07).

**Próximos passos (SDD)**

1. Revisar esta spec e fechar as questões acima.
2. `plan.md`: arquitetura, stack, modelo de dados físico, APIs, tempo real (TV e estação), estratégia multi-tenant.
3. `tasks.md`: quebra em tarefas por história, na ordem das P1.
4. Piloto em uma unidade com triagem e uma sem triagem.

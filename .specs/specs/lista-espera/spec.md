# Lista de espera, risco, alocação e confirmação

Caminho de uma sessão privada: **entrada na lista → questionário → (requisição) → sugestão → agendador aloca → paciente confirma → fila do dia**. Sessão pública, reserva, requisição e serviço regulado estão em [marcação](../marcacao/spec.md).

## Agenda da unidade

**RN-AG-01 · Agenda no app**
QUANDO o paciente conceder a localização, O SISTEMA DEVE mostrar no mapa as unidades dos municípios cadastrados ao redor. QUANDO ele tocar numa unidade, O SISTEMA DEVE mostrar o horário de funcionamento e as sessões futuras: serviço, dia, visibilidade e vagas restantes (ex.: "Terça, 12/11 · Cardiologia · privada · 20 vagas").

**RN-AG-02 · Nunca mostrar outros pacientes**
O SISTEMA NÃO DEVE mostrar ao paciente quem está na lista ou na sessão.

## Entrada na lista

**RN-LE-01 · Quem pode entrar**
QUANDO o paciente tentar criar uma entrada, O SISTEMA DEVE exigir que:
- o serviço aceite entrada pelo app (não seja regulado pela central, RN-ENC-05);
- se a unidade exige **vínculo**, ele já tenha pré-cadastro **validado** nela;
- se a unidade exige **pré-cadastro** (sem vínculo), ele já tenha **enviado** o pré-cadastro (a validação pode ser na primeira ida).

As duas exigências de pré-cadastro não valem para inscrição numa sessão pública que **dispensa pré-cadastro** (RN-PUB-04).
*Decisões: AD-016, AD-026.*

**RN-LE-02 · Uma entrada ativa por serviço**
O SISTEMA DEVE permitir no máximo **uma entrada ativa por serviço** por pessoa atendida (identificada pelo CPF ou, sem CPF, por nome + nascimento); ela pode estar em serviços diferentes ao mesmo tempo. Isso vale também para sessão pública do mesmo serviço: QUANDO quem está na lista tentar se inscrever numa sessão pública do serviço, O SISTEMA DEVE recusar, mostrar a entrada existente e explicar "você já está na lista deste serviço; para se inscrever nesta sessão, saia da lista (perde a posição)". Quem está só na reserva pode trocá-la por vaga em outra sessão (RN-PUB-02).
*Decisões: AD-032, AD-047.*
- *Dado* Maria há 40 dias na lista de odontologia, *quando* tenta se inscrever numa sessão pública de odontologia, *então* o app recusa com a explicação acima.
- *Dado* Maria já na lista de odontologia, *quando* tenta entrar de novo na lista do mesmo serviço, *então* o app recusa e mostra a entrada existente.

**RN-LE-03 · Data de entrada original**
A entrada guarda a **data de entrada original**, que serve de desempate em todas as ordenações e nunca muda (INV-09).

**RN-LE-04 · Entrada pela recepção**
A recepção PODE criar entradas pelo painel para quem não tem app; a pessoa vira uma **pessoa local**.
*Decisões: AD-035.*

**RN-LE-05 · Para quem é**
QUANDO o paciente entrar na lista ou se inscrever, O SISTEMA DEVE perguntar **para quem é**: ele mesmo ou outra pessoa. Para outra pessoa, ele informa nome, nascimento e CPF (se houver) e responde o questionário por ela. Classificação, prioridade legal e faltas são da pessoa atendida (RN-ID-06 para falta antes da conferência). O responsável recebe os pushes, vê a posição e lê o QR ao chegar com ela; o app mostra as inscrições de cada pessoa separadas. Não há cadastro de dependentes.
*Decisões: AD-018.*

**RN-LE-06 · Conferência da pessoa atendida**
QUANDO uma pessoa atendida que não é o dono da conta fizer o 1º check-in numa unidade, O SISTEMA DEVE recusar o check-in até a recepção conferir o documento dela (RN-FILA-05). Conferida uma vez, vale para as próximas idas àquela unidade.
*Decisões: AD-018, AD-054.*

## Classificação de risco (Manchester reduzido)

O questionário é estruturado (sem texto livre) e identifica risco de cara: sinais de emergência, sintomas relevantes e comorbidades.

| Nível | Significado | Efeito |
| --- | --- | --- |
| Emergência | Sinal de alarme (ex.: falta de ar intensa, dor no peito) | Não entra na lista. App orienta ligar para o SAMU (192) |
| Urgente | Risco relevante | Sugerido no topo; alerta ao agendador |
| Atenção | Comorbidade ou sintoma que pede prioridade | Acima de rotina |
| Rotina | Sem sinais de risco (ex.: exame de rotina) | Ordem normal |

**RN-RISCO-01 · Sugerido e confirmado**
O nível calculado pelo app é sempre **sugerido** (pré-triagem). QUANDO o enfermeiro classificar (triagem), O SISTEMA DEVE gravar o nível como **confirmado**; o agendador não confirma risco na alocação. Em serviço regulado, o agendador grava no lançamento a classificação vinda da regulação (RN-ENC-06).
*Decisões: AD-036, AD-056.*

**RN-RISCO-02 · Sem agendador**
Em sessão pública e no balcão não há agendador: o nível fica sugerido até a triagem confirmar, e em serviço sem triagem permanece sugerido. No balcão, a recepção aplica o mesmo questionário com o paciente; QUANDO o resultado for emergência, O SISTEMA DEVE orientar encaminhá-lo à emergência.

**RN-RISCO-03 · Refazer o questionário**
O paciente PODE refazer o questionário enquanto espera. QUANDO subir para urgente, O SISTEMA DEVE alertar o agendador; QUANDO cair em emergência, orientar ligar para o SAMU (192). Prioridade legal nova declarada por quem já está presente só vale depois que a recepção conferir; até lá ele segue no lugar, sem ela. Quem já está presente não muda o risco pelo app (RN-PIORA-01).
*Decisões: AD-054.*

**RN-RISCO-04 · Prioridade legal**
A **prioridade legal** é um campo separado, declarado pelo paciente. Grupos (lista fixa no código no MVP; Lei 10.048 com a redação da Lei 14.626/2023): idoso (60+, e 80+ com prioridade especial), gestante, lactante, pessoa com criança de colo, PcD, TEA, pessoa com mobilidade reduzida, doador de sangue, pessoa com obesidade. Grupos de leis estaduais ou municipais entram por mudança de código.
- **Ordem:** segue a lei, sem regras próprias: maiores de 80 anos antes dos demais idosos; entre grupos diferentes não há hierarquia.
- **Para outra pessoa:** conta a prioridade da pessoa atendida; se ela é criança de colo, vale "criança de colo"; a do acompanhante não passa para o atendido.
- **Declaração:** QUANDO o paciente marcar uma prioridade, O SISTEMA DEVE avisar que ela será conferida na unidade com documento e que declaração falsa pode configurar crime (texto validado pelo jurídico). Não há foto de laudo no app.
- **Conferência:** visual (gestante, criança de colo; idoso vem da data de nascimento) ou por documento (PcD, TEA), na recepção (RN-FILA-05). Conferida, vale nas próximas idas à unidade, exceto as que têm prazo (gestante, lactante, criança de colo), que expiram e são conferidas de novo.
- **Recepção:** PODE tirar uma prioridade declarada errada a qualquer momento e PODE dar prioridade ao incluir alguém no balcão (registrando o documento visto), mas NÃO PODE dar prioridade a quem já está na lista ou na fila. Para paciente sem app, a 1ª marcação de presença vale como inclusão no balcão.
- **A definir no D5:** forma de conferência e prazo de lactante, mobilidade reduzida, doador de sangue e obesidade; prazos de gestante e criança de colo; idade de "criança de colo"; regra do acompanhante.

*Decisões: AD-023, AD-024, AD-025, AD-027, AD-054.*
- *Dado* Pedro na fila sem prioridade, *quando* a recepção tenta marcá-lo como PcD, *então* o painel recusa (só o próprio paciente declara pelo app).
- *Dado* uma mãe que marca a consulta do bebê de colo, *quando* a fila é ordenada, *então* a entrada tem a prioridade "criança de colo".

### Questionário v1 (proposta: validar com enfermeiro ou médico, D8)

Meta: menos de 1 minuto, só toques, sem texto livre. "Nenhum destes" e "Nenhuma" são exclusivos: marcá-los desmarca as outras opções da tela. A Tela 3 só aparece para "problema novo".

| Tela | Pergunta | Opções |
| --- | --- | --- |
| 1 | Você está com algum destes agora? (vários) | Falta de ar forte ou dificuldade para respirar · Dor ou aperto forte no peito · Desmaio, confusão ou sonolência estranha · Fraqueza, formigamento ou boca torta de repente · Sangramento que não para · Convulsão · Pensamentos de tirar a própria vida ou de se machucar · Nenhum destes |
| 2 | Por que você quer o atendimento? (uma) | Problema novo ou que piorou · Acompanhamento de doença que já tenho · Exame, check-up ou rotina · Renovar receita |
| 3 | Como está esse problema? (uma) | Leve, faço as coisas normalmente · Moderado, atrapalha o dia · Forte, não consigo fazer quase nada |
| 4 | Você tem alguma destas condições? (vários) | Diabetes · Pressão alta · Doença do coração · Asma, bronquite ou DPOC · Câncer em tratamento · Imunidade baixa (transplante, HIV, uso de corticoide) · Nenhuma |
| 5 | Alguma destas se aplica a você? (vários) | Gestante · Lactante · Com criança de colo · Pessoa com deficiência · TEA · Mobilidade reduzida · Doador de sangue · Obesidade · Nenhuma |

A idade vem da data de nascimento. A Tela 5 alimenta a prioridade legal (RN-RISCO-04) e vem preenchida com a resposta anterior; marcar qualquer opção mostra o aviso de conferência.

**Regras de classificação** (vale a primeira que bater, de cima para baixo):

| Resultado | Quando | Efeito |
| --- | --- | --- |
| Emergência | Qualquer item da Tela 1, exceto pensamentos de tirar a própria vida | Não entra na lista. O app mostra o botão para ligar 192 (SAMU) |
| Urgente + apoio | Pensamentos de tirar a própria vida ou de se machucar | O app mostra CVV (188) e SAMU (192) em destaque. A pessoa **pode seguir** e entra como Urgente; o agendador recebe alerta |
| Urgente | Problema novo forte; ou gestante com problema novo moderado | Topo da sugestão; alerta ao agendador |
| Atenção | Problema novo moderado; ou problema novo com condição da Tela 4; ou problema novo com idade abaixo de 2 ou a partir de 60 anos; ou gestante com problema novo leve | Acima de rotina |
| Rotina | Todo o resto | Ordem normal |

**RN-RISCO-05 · Ficha do agendador**
A ficha do agendador DEVE mostrar o nível sugerido, a regra que o gerou, as respostas, a idade e a prioridade legal. Todo resultado do questionário, inclusive "Urgente + apoio", é gravado como sugerido; só vira urgência confirmada por agendador ou triagem.

**RN-RISCO-06 · Resposta sobre autolesão**
A resposta sobre pensamentos de tirar a própria vida só é visível para agendador e triagem daquela unidade. Exceção: QUANDO a recepção aplicar o questionário no balcão, O SISTEMA DEVE mostrar-lhe a pergunta durante a aplicação e, se a resposta for sim, CVV (188) e SAMU (192) no painel; depois de salvo, ela não vê mais.
*Decisões: AD-044.*

**RN-PIORA-01 · Situação piorou**
Remoto: refaz o questionário pelo app (RN-RISCO-03). Presente: o app não muda o risco de quem já está na unidade; no lugar de "Refazer questionário", mostra o botão **"Meus sintomas pioraram"**, que orienta avisar a recepção ou a enfermagem no local (e ligar para o SAMU, 192, em caso de emergência). A recepção reaplica o questionário no balcão e o risco é reclassificado na hora, com auditoria; num serviço com triagem, a triagem continua com a palavra final (RN-TRI-03).

## Alocação em sessão privada

**RN-AL-01 · Sugestão com motivos**
O SISTEMA DEVE **sugerir** quais entradas ocupam as vagas da sessão, com os motivos de cada uma em relação às demais (ex.: "urgente sugerido · idosa, 82 anos · espera há 41 dias").

**RN-AL-02 · Ordem da sugestão**
1. urgência confirmada;
2. remanejados;
3. demais, por nível de risco vigente e prioridade legal (na ordem configurada pelo município), depois data de entrada original.

*Decisões: AD-004.*

**RN-AL-03 · Alerta de faltas**
A sugestão DEVE mostrar o alerta de faltas do paciente, quando houver (RN-FALTA-03).

**RN-AL-04 · Nada automático**
O agendador confirma, remove ou troca pacientes. **Nada é alocado automaticamente** (INV-08).

**RN-AL-05 · Até a véspera**
A alocação acontece até a véspera da sessão.

**RN-AL-06 · Vagas**
Nenhum caminho coloca mais pacientes que as vagas da sessão: alocação, inscrição pública, lançamento ou balcão. Nem admin nem recepção podem furar o limite (INV-02).

## Confirmação

**RN-CONF-01 · Push e prazo**
QUANDO o paciente for alocado, O SISTEMA DEVE enviar push e mostrar a confirmação no app, com prazo de 24 h, sem passar da abertura da sessão.

**RN-CONF-02 · Em nome do paciente**
O agendador PODE registrar, depois de ligar para o paciente, confirmado, recusado ou sem contato.

**RN-CONF-03 · Lista de ligação**
Toda alocação pendente aparece desde já na **lista de ligação** do painel, ordenada pela sessão mais próxima; depois de 24 h sem resposta, fica destacada. Na prática, esse é o caminho principal, porque muita gente não vê o push.

**RN-CONF-04 · Recusa e abertura**
QUANDO o paciente recusar, O SISTEMA DEVE liberar a vaga na hora e sugerir o próximo. QUANDO a sessão abrir com a alocação ainda pendente, DEVE liberá-la. Em ambos os casos a entrada volta para a lista mantendo a data original. Não vale para lançamento regulado (RN-ENC-06).

## Lista parada

**RN-PARADA-01 · Ainda precisa?**
A cada 30 dias na lista, O SISTEMA DEVE perguntar "Ainda precisa deste atendimento?".

**RN-PARADA-02 · Arquivamento**
QUANDO não houver resposta em 7 dias, O SISTEMA DEVE **arquivar** a entrada (não apagar) e avisar o paciente. Proposta: ele pode reativá-la mantendo a data original em até 30 dias, exceto se o serviço tiver virado regulado (RN-ENC-07).

## Transições

<!-- gerado: contratos:lista-espera:entrada -->
| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| — | Paciente ou recepção cria | RN-LE-01 ok; serviço sem requisição | Aguardando | Nível sugerido calculado |
| — | Questionário = Emergência | — | (não cria) | Mostra 192 |
| Aguardando ou Remanejada | Agendador aloca | Vaga livre (INV-02) | Alocada | Push "confirme"; aparece na lista de ligação |
| Alocada | Paciente ou agendador confirma | Antes da abertura | Confirmada | Log |
| Alocada | Recusa | Serviço não regulado; não remanejada, ou 2ª recusa de remanejada de sessão privada | Aguardando (data original) | Vaga liberada; sugere o próximo |
| Alocada | Recusa (agendador, em nome do paciente) | 1ª recusa de remanejada | Remanejada | Recusas +1 |
| Alocada | Sessão abre sem confirmação | — | Aguardando (data original) | Vaga liberada |
| Confirmada | Sessão abre | — | Na fila | Senha; push |
| Alocada, Confirmada ou Na fila | Paciente cancela ("Não vou poder ir") | Serviço não regulado | Cancelada | Vaga liberada (RN-CANC-02) |
| Aguardando, Aguardando encaminhamento ou Remanejada | Paciente cancela | — | Cancelada | — |
| Na fila | Atendida na última etapa | — | Concluída | — |
| Aguardando | A cada 30 dias na lista | — | (mesmo) | Push "ainda precisa?" |
| Aguardando | 7 dias sem resposta | — | Arquivada | Push |
| Arquivada | Paciente reativa | Até 30 dias (proposta); serviço não regulado | Aguardando (data original) | — |
<!-- /gerado -->

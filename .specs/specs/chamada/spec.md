# Chamada: estação, pulos, triagem, encerramento e faltas

Quem é chamado e em que ordem está em [fila-do-dia](../fila-do-dia/spec.md#ordem-de-chamada).

## Estação

**RN-EST-01 · Estação**
Cada consultório e sala de triagem é uma **estação**, ligada a uma etapa e a um ou mais serviços. O profissional faz login com o usuário dele e escolhe a estação.

**RN-EST-02 · Mini-janela**
A estação roda no navegador (Chrome ou Edge) e pode ser destacada numa **mini-janela flutuante** por cima do prontuário (Document Picture-in-Picture). Ela mostra a próxima senha, o contador da tolerância e os botões Finalizar, **Chamar próximo**, **Rechamar** e **Não compareceu**.

**RN-EST-03 · Vários serviços**
QUANDO a estação atender mais de um serviço, "Chamar próximo" DEVE juntar os elegíveis desses serviços numa só ordem (RN-ORD). O profissional não escolhe o serviço.

**RN-EST-04 · Modo celular**
A mesma estação existe em modo celular ou tablet, com botão grande.

**RN-EST-05 · Sem pulo sozinho**
Ao fim da tolerância a estação avisa, mas não pula sozinha. Uma estação com paciente chamado não pode ser fechada. A estação envia sinal de vida (RN-SES-05).
*Decisões: AD-006, AD-043.*

## Chamar

**RN-CHAM-01 · Chamar próximo**
QUANDO o profissional clicar em **Chamar próximo**, O SISTEMA DEVE pegar o primeiro elegível da etapa e dos serviços daquela estação, mostrá-lo na TV e enviar push. A seleção é atômica: duas estações chamando ao mesmo tempo recebem pacientes diferentes (INV-04).

**RN-CHAM-02 · Encerrar a chamada**
Chamar o próximo encerra a chamada anterior como **atendido** (ou triado). **Rechamar** repete o anúncio sem reiniciar a tolerância. **Finalizar** encerra o atendimento atual sem chamar outro.

**RN-CHAM-03 · Não compareceu**
Não há pulo automático: a tolerância (padrão 5 min) é só um contador que avisa "tolerância esgotada". QUANDO o profissional tocar **Não compareceu** (disponível a qualquer momento com alguém chamado), O SISTEMA DEVE:
- no 1º pulo do dia: mantê-lo presente, tratado como se tivesse acabado de ficar elegível (atrás dos próximos K);
- no 2º pulo: devolvê-lo a remoto; ao se reapresentar, vale a regra de atraso;
- no 3º pulo do dia, somando as etapas: tirá-lo da fila e registrar falta "não compareceu à chamada" (RN-FALTA-02). Ele pode entrar de novo na lista como entrada nova.

*Decisões: AD-006, AD-021.*
- *Dado* Ana chamada com 0 pulos, *quando* o profissional toca "Não compareceu", *então* Ana fica presente atrás dos próximos K.
- *Dado* Ana com 2 pulos (1 na triagem, 1 no consultório), *quando* é pulada de novo, *então* sai da fila com uma falta.

## Triagem

**RN-TRI-01 · Duas etapas**
Serviços com triagem têm duas etapas, triagem e atendimento, com as mesmas regras de presença, ordem e chamada.
*Decisões: AD-007.*

**RN-TRI-02 · Estação de triagem com vários serviços**
Uma estação de triagem pode atender vários serviços; junta os pacientes deles numa só ordem.

**RN-TRI-03 · Classificação na triagem**
Na triagem o profissional confirma ou reclassifica o risco; essa passa a ser a classificação confirmada.

**RN-TRI-04 · Depois da triagem**
O paciente entra na fila de atendimento com a mesma senha. A ordem usa a classificação confirmada, a prioridade legal e a posição original na fila do dia (não a hora da triagem).

**RN-TRI-05 · Sair entre etapas**
A regra de presença continua valendo entre as etapas: o paciente pode tocar "Vou sair" depois da triagem e recebe um novo "saia de casa" quando o atendimento se aproximar. Ao voltar, vale a regra de atraso.
*Decisões: AD-009, AD-010.*

**RN-TRI-06 · Triagem cadenciada (proposta)**
O sistema só sugere chamar para a triagem quem tem previsão de atendimento próxima, para que a triagem não vire uma segunda espera. Validar no piloto.

## Encerramento

**RN-SES-01 · Só o admin encerra**
A sessão só encerra quando o admin a encerra. No horário de fim, o painel lembra o admin.

**RN-SES-02 · Faltas e remanejados**
QUANDO a sessão for encerrada, O SISTEMA DEVE, para cada um ainda na fila:
- vez **não passou** → remanejado;
- estava **presente** → remanejado, nunca faltoso;
- estava **remoto** e a vez passou → falta, exceto se já foi atendido em alguma etapa do dia (remanejado) ou se a vez passou durante um período de contingência registrado (remanejado, RN-CONT-03).

*Decisões: AD-041, AD-033.*
- *Dado* Luísa triada que tocou "Vou sair", *quando* a sessão encerra antes da consulta dela, *então* ela é remanejada, não faltosa.

**RN-SES-03 · Encerrar com chamado aberto**
O encerramento só é permitido quando nenhuma estação tem paciente chamado; o painel mostra as estações que precisam finalizar. Antes de encerrar, vale o aviso de sinal perdido (RN-SES-04).

## Faltas

**RN-FALTA-01 · Falta no encerramento**
É **falta** quando, no encerramento, o paciente confirmado estava remoto e a vez dele já tinha passado na etapa atual (RN-SES-02, com as exceções lá). Quem leva a falta segue a RN-ID-06.
*Decisões: AD-010, AD-040, AD-041.*

**RN-FALTA-02 · Falta por 3 pulos**
Sair da fila por 3 pulos no dia também conta no mesmo limite, com ou sem check-in. A recepção PODE anular essa falta quando o paciente comprova que estava na unidade; a anulação exige motivo, vai para a auditoria e para o relatório do gestor.
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
| Chamado | Estação chama o próximo ou toca Finalizar | — | Atendido na etapa | Há outra etapa: Presente nela, mesmo número. Senão: entrada Concluída |
| Chamado | "Não compareceu" | Pulos no dia = 0 | Presente | Pulos = 1; aplica janela protegida |
| Chamado | "Não compareceu" | Pulos no dia = 1 | Remoto | Pulos = 2; push |
| Chamado | "Não compareceu" | Pulos no dia = 2 | Saiu da fila | Pulos = 3; falta; entrada Encerrada sem atendimento; push |
| Qualquer não final | Sessão cancelada | — | Remanejado | Push |
| Remoto ou Presente | Sessão encerrada | A vez não passou | Remanejado | Push |
| Presente | Sessão encerrada | A vez passou | Remanejado | Push (estava na unidade) |
| Remoto | Sessão encerrada | A vez passou; nunca atendido no dia; fora de contingência | Saiu da fila | Falta; entrada Encerrada sem atendimento |
| Remoto | Sessão encerrada | Já atendido em etapa anterior | Remanejado | Push; não é falta |
<!-- /gerado -->

Entrada (lista):

<!-- gerado: contratos:chamada:entrada -->
| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| Na fila | Sessão encerrada com o paciente presente, já atendido em etapa anterior ou com a vez passada em contingência | — | Remanejada | Push |
| Na fila | 3º pulo, ou falta no encerramento | — | Encerrada sem atendimento | Registra ocorrência de falta |
| Na fila | Recepção: identidade não confere (RN-FILA-05) | — | Cancelada | Sem falta; motivo na auditoria |
<!-- /gerado -->

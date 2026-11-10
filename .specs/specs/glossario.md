# Glossário

Termos usados em todas as specs. Toda regra é obrigatória no MVP, exceto as marcadas como **proposta**, que dependem de validação (piloto ou discovery). Datas e horas ("véspera", "no dia", "24 h") seguem o fuso da unidade. "Padrão" indica um valor configurável ([modelo](modelo/spec.md#configurações)).

| Termo | Definição |
| --- | --- |
| Município | O cliente: prefeitura com sua secretaria de saúde. Um tenant com várias unidades e dados isolados. |
| Unidade | UBS, policlínica ou UPA, com endereço, horário e configurações próprias. |
| Serviço | O que a unidade oferece: clínico geral, cardiologia, odontologia. A lista de espera é do serviço, não do profissional. Define como é marcado: livre, requisição pelo app ou regulado pela central ([marcação](marcacao/spec.md)). |
| Sessão | Um dia de um serviço: data, horário de início e fim, vagas e visibilidade. Pode nascer de uma série recorrente (RFC 5545); cada ocorrência é uma sessão com estado e configuração próprios. O profissional é só texto informativo. |
| Sessão aberta | Sessão com a fila do dia ativa. Abre no horário de início (ou antes, pelo admin) e só fecha quando o admin a encerra. |
| Sessão privada | O agendador decide quem entra: a partir da lista de espera do serviço ou, em serviço regulado, lançando os pacientes que a regulação mandou. |
| Sessão pública | O paciente se inscreve sozinho até acabarem as vagas. |
| Lista de espera | Pacientes aguardando uma sessão de um serviço. Nenhum paciente a vê. |
| Lista de reserva | Inscritos que sobraram quando uma sessão pública lotou. Recebem as vagas liberadas, em ordem. |
| Entrada | Inscrição de uma pessoa atendida num serviço (lista de espera, sessão pública, reserva, lançamento ou balcão). No máximo uma ativa por serviço e por pessoa atendida. |
| Pessoa atendida | Quem será atendido numa entrada: o dono da conta ou outra pessoa informada por ele (nome, nascimento, CPF se houver). O dono da conta é o **responsável** pela entrada. |
| Pessoa local | Registro no banco do município de quem não tem app (balcão, entrada criada pela recepção, lançamento regulado). Vincula-se à conta central pelo CPF quando ela existe e é verificada. |
| Sem app | Paciente representado por uma pessoa local, ou com conta não verificada num lançamento regulado: não recebe push; a recepção marca a presença e entrega o papel com a senha. |
| Data de entrada original | Momento em que a entrada foi criada. Serve de desempate e é preservada em recusas e remanejamentos. |
| Alocação | Atribuição de uma entrada a uma sessão (um dia, sem horário), feita pelo agendador. |
| Lançamento | Inclusão, pelo agendador, de um paciente mandado pela regulação numa sessão de serviço regulado. Entra já confirmado. |
| Vaga segura | Vaga guardada para quem ainda não teve a foto da requisição aceita; liberada se não for aceita até a abertura. |
| Pré-cadastro | Cadastro do paciente numa unidade, com documentos, validado presencialmente. Feito uma vez por unidade. |
| Vínculo | Exigência da unidade de que o paciente já tenha o pré-cadastro **validado** nela para entrar na lista. Uma sessão pública pode dispensá-la. |
| ID de atendimento | Código de 6 caracteres (e QR) do pré-cadastro, mostrado na recepção para a validação. |
| Fila do dia | Fila de uma sessão aberta. Tem uma etapa (atendimento) ou duas (triagem e atendimento). |
| Etapa | Triagem ou atendimento. Cada etapa tem sua própria ordem e suas chamadas. |
| Remoto / Presente | Estado de presença na fila do dia: fora ou dentro da unidade. |
| Pendência | Algo a conferir de quem está presente: conta não verificada, pessoa atendida não conferida, pré-cadastro não validado ou prioridade declarada não conferida. Não tira a vez; é conferida na recepção ou na chamada. |
| Elegível | Presente (com ou sem pendência), na etapa e num serviço atendido pela estação que chama. |
| Conta verificada | Conta cujo dono do CPF foi confirmado: a recepção ou o profissional conferiu o documento com foto (MVP) ou, depois do piloto, gov.br prata/ouro. Antes disso a conta é **não verificada**. |
| Posição original | Número sequencial do paciente na fila do dia, dado ao entrar. Não muda quando ele sai e volta; só muda pela regra de atraso. |
| Estação | Ponto de chamada (consultório ou sala de triagem), ligado a uma etapa e a um ou mais serviços. Está aberta enquanto houver um profissional logado nela. |
| Senha | Código do paciente na fila do dia, com prefixo do serviço (ex.: C-012). É a mesma na triagem e no atendimento. |
| Classificação de risco | Nível do Manchester reduzido: emergência, urgente, atenção ou rotina. É *sugerida* pelo app e *confirmada* por agendador ou triagem. |
| Urgência confirmada | Nível urgente validado por um humano. É a única condição que fura a janela protegida. |
| Prioridade legal | Prioridade prevista em lei (idoso, gestante, PcD etc.). Eixo separado do risco. |
| Janela protegida | Os K primeiros elegíveis da etapa, que quem acabou de ficar elegível não pode ultrapassar. |
| Tolerância de chamada | Tempo que o paciente chamado tem para se apresentar. É só um contador na estação: quem pula é o profissional, com "Não compareceu". |
| A vez passou | Já foi chamado, na etapa atual do paciente, alguém que vem depois dele na ordem real. |
| Falta | Ocorrência registrada quando o paciente sai da fila por 3 pulos, ou quando, no encerramento, estava remoto e a vez dele passou ([chamada](chamada/spec.md#faltas)). |
| Remanejado | Paciente que perdeu o atendimento por culpa da unidade (sessão cancelada, ou encerrada antes da vez dele ou com ele presente). Tem preferência. |
| Período de contingência | Intervalo em que o sistema ou a internet da unidade caiu e a unidade chamou pela lista em papel. |
| Modo manual | Estado de uma unidade cuja TV e todas as estações perderam o sinal ao mesmo tempo. |

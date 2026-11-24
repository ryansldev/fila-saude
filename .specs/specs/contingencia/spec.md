# Contingência: queda do sistema ou da internet

O piloto não tem alta disponibilidade. Quando o sistema ou a internet cai, a unidade não pode parar: chama pela lista em papel e, na volta, reconcilia. Painel offline com sincronização fica fora do MVP.
*Decisões: AD-020, AD-033, AD-043.*

**RN-CONT-01 · Lista do dia impressa**
O painel DEVE permitir imprimir, a qualquer momento, a lista do dia de uma sessão: senhas, presentes e remotos em ordem, prioridades. A recepção imprime na abertura como rotina e reimprime quando entra muita gente. A lista é de **uso interno** da recepção e dos profissionais, nunca exposta na sala de espera.

**RN-CONT-02 · Reconciliação na volta**
QUANDO o sistema voltar, a recepção registra quem foi atendido no papel e o **período de contingência** (início, fim, motivo). O SISTEMA DEVE mostrar, ao lado, o que viu no período (sinais de vida da TV e das estações) e levar o registro ao relatório do gestor; período sem nenhum sinal offline fica destacado.
*Decisões: AD-020, AD-023.*

**RN-CONT-03 · Ninguém é punido pela queda**
Para quem estava remoto, O SISTEMA DEVE parar o relógio do prazo de chegada durante uma queda, seja um período de contingência registrado, seja uma queda que o próprio sistema percebeu (RN-SES-05, ou o servidor fora do ar por mais de 3 min): o prazo se estende pelo tempo da queda, e só depois a pessoa perde a vez ou leva falta (dentro dele, vira remanejada). QUANDO o período for registrado depois do encerramento, no mesmo dia, O SISTEMA DEVE recalcular e apagar essas faltas.
*Decisões: AD-033, AD-076.*
- *Dado* Bruno remoto recebe o "venha agora" às 9:10 (prazo 30 min), durante a queda das 9h às 10h, *quando* ele faz check-in às 10:25, *então* não vai para o fim (o prazo só começou a correr às 10h).
- *Dado* a sessão encerrada às 12h com falta de Bruno, *quando* a recepção registra às 13h a queda das 9h às 10h que cobria a vez dele, *então* a falta é apagada e ele vira remanejado.

**RN-CONT-04 · App sem a API**
QUANDO o app não conseguir falar com a API, O SISTEMA DEVE mostrar "sistema indisponível, procure a recepção" em vez de uma posição velha.

**RN-SES-04 · Aviso antes de encerrar**
QUANDO o admin for encerrar uma sessão em que a TV ou alguma estação ficou sem sinal e não há período de contingência registrado, O SISTEMA DEVE avisar (não bloqueia).

**RN-SES-05 · Modo manual (queda só da unidade)**
QUANDO a unidade perder o sinal, O SISTEMA DEVE pôr as sessões abertas dela em **modo manual**: o app mostra "atendimento em modo manual, procure a recepção", o "saia de casa", o "venha agora" e o "perdeu a vez" são suspensos e a estimativa some, até o sinal voltar. A queda vale desde o último sinal e para o relógio do prazo de chegada (RN-CONT-03). Com TV pareada que já deu sinal na sessão, só a TV conta: ela fica sempre na frente, e sem ela ninguém vê as chamadas; 2 min sem sinal é queda. Sem TV (ou com uma TV nova que ainda não deu sinal), contam as estações, com 10 min de silêncio, porque o navegador pode congelar a aba da estação em segundo plano. Sem estação aberta não há queda a perceber (ninguém chama), e a queda aberta fecha. Enquanto o sinal está parado e a queda ainda não se confirmou, o atraso de quem recebeu "venha agora" não é julgado (não vai para o fim, não recebe "perdeu a vez"): a queda pode voltar no tempo e estender o prazo. O sinal está parado se, no giro da varredura, já passava da folga da fonte (TV 45 s, estações 100 s), se agora passa da folga mais um giro, ou se a varredura parou há mais de 2 min; um sinal que volta entre dois giros só conta no giro seguinte. O check-in pelo app continua (a unidade pode ter o QR em outra tela).
*Decisões: AD-043, AD-076.*
- *Dado* só a internet da UBS (com TV) caiu e a API continua no ar, *quando* passam 2 min sem sinal da TV, *então* nenhum paciente recebe "saia de casa" até o sinal voltar.
- *Dado* uma UBS sem TV com a aba da estação em segundo plano, *quando* passam 5 min sem sinal, *então* não é queda; com 10 min, é, desde o último sinal.

## Transições

<!-- gerado: contratos:contingencia:item,entrada -->
| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| Remoto, Presente ou Chamado (fila do dia) | Recepção registra atendido na reconciliação | Período de contingência registrado | Atendido na etapa | Auditoria; mesmo efeito de "Atendido na etapa" |
| Remoto (fila do dia) | Sessão encerrada | Perdeu o prazo de chegada durante uma queda, registrada ou percebida pelo sistema | Remanejado | Push |
| Encerrada sem atendimento por falta (entrada) | Período de contingência registrado depois do encerramento, no mesmo dia, cobrindo a vez dele | Única reversão de estado final | Remanejada | Falta apagada; auditoria |
<!-- /gerado -->

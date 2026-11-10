# Contingência: queda do sistema ou da internet

O piloto não tem alta disponibilidade. Quando o sistema ou a internet cai, a unidade não pode parar: chama pela lista em papel e, na volta, reconcilia. Painel offline com sincronização fica fora do MVP.
*Decisões: AD-020, AD-033, AD-043.*

**RN-CONT-01 · Lista do dia impressa**
O painel DEVE permitir imprimir, a qualquer momento, a lista do dia de uma sessão: senhas, presentes e remotos em ordem, prioridades. A recepção imprime na abertura como rotina e reimprime quando entra muita gente. A lista é de **uso interno** da recepção e dos profissionais, nunca exposta na sala de espera.

**RN-CONT-02 · Reconciliação na volta**
QUANDO o sistema voltar, a recepção registra quem foi atendido no papel e o **período de contingência** (início, fim, motivo). O SISTEMA DEVE mostrar, ao lado, o que viu no período (sinais de vida da TV e das estações) e levar o registro ao relatório do gestor; período sem nenhum sinal offline fica destacado.
*Decisões: AD-020, AD-023.*

**RN-CONT-03 · Ninguém é punido pela queda**
Para quem estava remoto, O SISTEMA DEVE ignorar as chamadas feitas no período de contingência na regra de atraso, e não registrar falta cuja vez passou nesse período (vira remanejado). QUANDO o período for registrado depois do encerramento, no mesmo dia, O SISTEMA DEVE recalcular e apagar essas faltas.
*Decisões: AD-033.*
- *Dado* Bruno remoto durante a queda das 9h às 10h, em que a unidade chamou pelo papel, *quando* ele faz check-in às 10:15, *então* as chamadas das 9h às 10h não o mandam para o fim.
- *Dado* a sessão encerrada às 12h com falta de Bruno, *quando* a recepção registra às 13h a queda das 9h às 10h que cobria a vez dele, *então* a falta é apagada e ele vira remanejado.

**RN-CONT-04 · App sem a API**
QUANDO o app não conseguir falar com a API, O SISTEMA DEVE mostrar "sistema indisponível, procure a recepção" em vez de uma posição velha.

**RN-SES-04 · Aviso antes de encerrar**
QUANDO o admin for encerrar uma sessão em que a TV ou alguma estação ficou sem sinal e não há período de contingência registrado, O SISTEMA DEVE avisar (não bloqueia).

**RN-SES-05 · Modo manual (queda só da unidade)**
QUANDO a TV e todas as estações de uma unidade perderem o sinal ao mesmo tempo por mais de ~2 min, O SISTEMA DEVE pôr as sessões abertas dela em **modo manual**: o app mostra "atendimento em modo manual, procure a recepção", o "saia de casa" é suspenso e a estimativa some, até o sinal voltar.
*Decisões: AD-043.*
- *Dado* só a internet da UBS caiu e a API continua no ar, *quando* passam 2 min sem sinal da TV e das estações, *então* nenhum paciente recebe "saia de casa" até o sinal voltar.

## Transições

| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| Remoto, Presente ou Chamado (fila do dia) | Recepção registra atendido na reconciliação | Período de contingência registrado | Atendido na etapa | Auditoria; mesmo efeito de "Atendido na etapa" |
| Remoto (fila do dia) | Sessão encerrada | A vez passou durante período de contingência registrado | Remanejado | Push |
| Encerrada sem atendimento por falta (entrada) | Período de contingência registrado depois do encerramento, no mesmo dia, cobrindo a vez dele | Única reversão de estado final | Remanejada | Falta apagada; auditoria |

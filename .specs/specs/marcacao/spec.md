# Marcação: requisição, serviço regulado, sessão pública e reserva

Cada serviço define **como é marcado** (RN-ENC-05). A lista de espera e a alocação estão em [lista-espera](../lista-espera/spec.md). Discovery: [discovery-regulacao](../../features/mvp-filas/discovery-regulacao.md).

## Como o serviço é marcado

**RN-ENC-05 · Três modos**
Cada serviço é de um modo:
- **livre:** sem exigência;
- **requisição pelo app** ("exige encaminhamento"): o paciente marca de casa enviando a foto do papel de requisição, e o agendador confere (RN-ENC-01..04);
- **regulado pela central:** quem marca é a central de regulação; o paciente não entra na lista pelo app (o app orienta "este serviço é marcado pela regulação"), e o agendador da unidade lança os pacientes que a regulação mandou (RN-ENC-06). Serviço regulado só tem sessões privadas e não aceita inclusão no balcão.

A integração com o sistema de regulação (e-SUS Regulação ou SISREG) fica para depois do piloto (D6).
*Decisões: AD-026, AD-048.*

## Requisição pelo app

**RN-ENC-01 · Foto na entrada**
QUANDO o serviço exigir requisição, O SISTEMA DEVE pedir a foto da requisição na entrada.

**RN-ENC-02 · Conferência pelo agendador**
O agendador confere autenticidade, se é para aquele serviço e se está dentro da validade, e aceita ou rejeita com motivo. A regra de validade vem do D6.

**RN-ENC-03 · Sem foto aceita não aloca**
Entrada com requisição pendente, rejeitada ou vencida não é alocável. O SISTEMA DEVE avisar o paciente, que pode enviar outra.

**RN-ENC-04 · Vaga segura**
QUANDO alguém sem foto aceita receber uma vaga (inscrição pública, troca ou vaga da reserva, remanejamento), O SISTEMA DEVE guardá-la como **vaga segura**: aceita a foto, vira confirmada; rejeitada, o paciente pode enviar outra; sem aceite até a abertura, a vaga é liberada e a entrada volta a "aguardando encaminhamento".
*Decisões: AD-015, AD-046.*
- *Dado* Ana inscrita numa sessão pública de odontologia sem foto aceita, *quando* a sessão abre e o agendador não aceitou, *então* a vaga vai para o próximo e Ana volta a "aguardando encaminhamento".

## Serviço regulado

**RN-ENC-06 · Lançamento**
QUANDO o agendador lançar pelo CPF um paciente mandado pela regulação, O SISTEMA DEVE:
- exigir vaga livre (INV-02) e sessão privada;
- gravar a classificação de risco informada pela regulação (padrão "rotina") como confirmada pelo agendador (INV-07);
- colocar a entrada **já confirmada**, sem prazo de confirmação nem liberação na abertura; com a sessão já aberta, direto na fila remota com o próximo número;
- ligar o lançamento à conta só se ela for **verificada**: aí o paciente recebe "sua consulta está marcada", pode declarar prioridade pela Tela 5 (conferida, RN-FILA-05) e pode desmarcar. Sem conta, ou com conta não verificada, ele é tratado como **sem app** (pessoa local): sem push e sem ver o serviço; a recepção marca a presença, entrega o papel com a senha e pode dar a prioridade na 1ª presença.

O agendador PODE remover um lançamento ainda não chamado (CPF errado, regulação desmarcou), com motivo: vaga liberada, auditoria e push se houver conta verificada. QUANDO o paciente lançado desmarcar ou desistir, O SISTEMA DEVE liberar a vaga **sem sugerir ninguém** (não há lista), avisar o agendador na lista de ligação para comunicar a regulação, e orientar o paciente a procurar a regulação ou a UBS.
*Decisões: AD-026, AD-035, AD-036, AD-037, AD-049.*
- *Dado* Seu José sem app lançado para terça, *quando* chega na unidade, *então* a recepção confere o documento, marca a presença e entrega o papel com a senha.
- *Dado* um CPF lançado cuja conta não é verificada, *quando* o lançamento é feito, *então* nenhum push sai e a conta não vê o serviço.
- *Dado* a sessão de hoje já aberta, *quando* o agendador lança um paciente, *então* ele entra na fila remota com o próximo número.

**RN-ENC-07 · Trocar o modo de um serviço**
- QUANDO o admin tentar mudar o serviço para "regulado" com entradas ativas, O SISTEMA DEVE bloquear e mostrar quantas são.
- QUANDO a troca para "regulado" acontecer, O SISTEMA DEVE tornar privadas as sessões públicas futuras sem inscritos e o padrão das séries, e cancelar as entradas arquivadas com o push "este serviço passou a ser marcado pela regulação; procure sua UBS"; o painel mostra quantas mudaram.
- Entre "livre" e "requisição pelo app" a troca é livre: quem já está na lista não passa a precisar de foto, e as entradas que aguardam foto viram "aguardando" (ou confirmadas, se tinham vaga segura) ao virar livre.

*Decisões: AD-038.*

## Sessão pública

**RN-PUB-01 · Inscrição confirmada**
QUANDO o paciente se inscrever numa sessão pública com vaga, O SISTEMA DEVE confirmá-lo na hora, sem alocação nem aprovação (ele escolheu o dia); com a sessão já aberta, ele entra direto na fila remota com o próximo número. Exceção: serviço com requisição (RN-ENC-04).
*Decisões: AD-013.*

**RN-PUB-02 · Lista de reserva**
QUANDO a sessão pública lotar, O SISTEMA DEVE pôr os novos inscritos na **lista de reserva**. Cada vaga liberada vai para o primeiro da reserva (remanejados de sessão pública ficam no topo, RN-REM-05), que recebe push e entra confirmado (direto na fila remota, se a sessão já abriu). Se faltar a foto: antes da abertura, recebe como vaga segura; com a sessão aberta, a vaga passa ao próximo da reserva. Quem está na reserva PODE trocá-la por uma vaga em outra sessão pública do mesmo serviço: o app avisa que ele sairá da reserva e, ao confirmar, a reserva é cancelada.
*Decisões: AD-046, AD-047.*

**RN-PUB-03 · Trocar a visibilidade**
QUANDO uma sessão pública virar privada, O SISTEMA DEVE manter quem já entrou, bloquear novas inscrições e desligar a "dispensa pré-cadastro". QUANDO uma privada virar pública, deve abrir autoinscrição até preencher as vagas restantes; isso não é permitido em serviço regulado.
*Decisões: AD-038.*

**RN-PUB-04 · Dispensa pré-cadastro**
Uma sessão **pública** PODE ter a opção "dispensa pré-cadastro" (padrão desligada; ex.: plantão, que atende quem aparecer): ignora as exigências de pré-cadastro e de vínculo da unidade para aquela sessão. É uma opção genérica, não um tipo "plantão". A conta continua sujeita à conferência de identidade (RN-FILA-05). Sessão privada não tem a opção.
*Decisões: AD-016.*

## Transições

<!-- gerado: contratos:marcacao:entrada -->
| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| — | Paciente ou recepção cria | RN-LE-01 ok; serviço com requisição | Aguardando encaminhamento | Nível sugerido calculado |
| Aguardando encaminhamento | Agendador aceita | Dentro da validade | Aguardando | Push |
| Aguardando encaminhamento | Agendador rejeita | — | (mesmo) | Push com motivo |
| Aguardando | Requisição vence | — | Aguardando encaminhamento | Push |
| Aguardando encaminhamento | Serviço muda para "livre" | — | Aguardando | — |
| Aguardando encaminhamento (vaga segura) | Serviço muda para "livre" | Antes da abertura | Confirmada | Push |
| Aguardando encaminhamento (vaga segura) | Agendador aceita | Antes da abertura | Confirmada | Push |
| Aguardando encaminhamento (vaga segura) | Sessão abre sem aceite | — | Aguardando encaminhamento | Vaga liberada; push |
| — | Inscrição pública | Vaga livre; sem requisição | Confirmada (ou Na fila, se a sessão já abriu) | RN-PUB-01 |
| — | Inscrição pública | Vaga livre; com requisição | Aguardando encaminhamento (vaga segura) | RN-ENC-04 |
| — | Inscrição pública | Sessão lotada | Na reserva | RN-PUB-02 |
| Na reserva | Vaga liberada e é o primeiro da reserva | Foto aceita, se exigida (com a sessão aberta e sem foto, a vaga passa ao próximo) | Confirmada (ou Na fila, se a sessão já abriu) | Push |
| Na reserva | Vaga liberada e é o primeiro da reserva | Requisição sem foto aceita; antes da abertura | Aguardando encaminhamento (vaga segura) | Push; RN-ENC-04 |
| Na reserva | Troca por vaga em outra sessão pública do serviço | Confirma no app; foto aceita, se exigida | Confirmada (ou Na fila) | Reserva cancelada |
| Na reserva | Troca por vaga em serviço com requisição, sem foto aceita | Antes da abertura | Aguardando encaminhamento (vaga segura) | Reserva cancelada |
| Na reserva | Paciente cancela | — | Cancelada | — |
| Na reserva | Sessão encerrada ou cancelada sem vaga para ele | — | Cancelada | Push; não é remanejado |
| — | Agendador lança (serviço regulado) | Vaga livre; sessão privada planejada | Confirmada | Push "consulta marcada" só para conta verificada |
| — | Agendador lança (serviço regulado) | Vaga livre; sessão aberta | Na fila | Senha; próximo número; push se a conta for verificada |
| Confirmada ou Na fila (nunca chamado) | Agendador remove lançamento, com motivo | Serviço regulado | Cancelada | Vaga liberada; auditoria; push se conta verificada |
| Confirmada ou Na fila (lançada) | Paciente desmarca ou desiste | Serviço regulado | Cancelada | Vaga liberada sem sugestão; agendador avisado na lista de ligação |
| Arquivada | Serviço muda para "regulado" | — | Cancelada | Push "procure sua UBS" |
<!-- /gerado -->

Na fila do dia:

<!-- gerado: contratos:marcacao:item -->
| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| — | Inscrição pública com a sessão aberta, ou vaga da reserva | Vaga livre; foto aceita, se exigida | Remoto | Senha; próximo número |
| — | Agendador lança paciente regulado com a sessão aberta | Vaga livre | Remoto | Senha; próximo número |
| Remoto ou Presente | Agendador remove lançamento | Serviço regulado; nunca chamado no dia | Saiu da fila | Vaga liberada; auditoria |
<!-- /gerado -->

# Exceções: cancelamento e remanejamento

Regra geral: **quem desiste perde a vez; quem é prejudicado pela unidade ganha preferência**. Falta e lista parada estão em [chamada](../chamada/spec.md#faltas) e [lista-espera](../lista-espera/spec.md#lista-parada).

## Paciente cancela

**RN-CANC-01 · "Não vou poder ir"**
O app tem o botão "Não vou poder ir", antes ou no dia.

**RN-CANC-02 · Vaga liberada**
QUANDO o paciente cancelar, O SISTEMA DEVE liberar a vaga e sugerir o próximo (sessão privada) ou chamar o primeiro da reserva (sessão pública). Em serviço regulado não há sugestão: o agendador é avisado para comunicar a regulação (RN-ENC-06).

**RN-CANC-03 · Perde a vaga**
Quem cancela perde a vaga. Para tentar outro dia, faz uma **entrada nova**, sem a posição antiga.

## Remanejamento

Vira **remanejado** quem perdeu o atendimento por culpa da unidade: sessão cancelada (médico faltou, feriado, outro motivo), incluindo inscritos de sessão pública e a vaga segura; ou sessão encerrada ou cancelada no meio do dia com gente na fila, incluindo quem estava chamado. Quem já foi atendido não é afetado.

**Fluxo de cancelamento de sessão**
1. O admin cancela a sessão e informa o motivo.
2. O sistema pergunta: **"Já existe nova data?"**
3. **Sim:** o admin cria a **sessão de reposição** ali mesmo, com a mesma visibilidade da cancelada, pré-preenchida com os pacientes dela. **Privada:** o agendador revisa e confirma, e os pacientes seguem a confirmação normal. **Pública:** cada remanejado escolhe se fica com a reposição ou outra data (RN-REM-05). **Regulada:** o agendador relança, e eles entram confirmados (RN-ENC-06).
4. **Não:** os pacientes vão para "aguardando remarcação" do serviço e recebem push. Quando a próxima sessão privada ou regulada for criada, o sistema mostra "N pacientes aguardam remarcação. Alocá-los primeiro?", já pré-selecionados. Remanejado de sessão pública escolhe a data ele mesmo.
5. Se a reposição tiver menos vagas que a cancelada, o sistema avisa quantos ficaram de fora; eles seguem remanejados.

**RN-REM-01 · Precedência**
urgência confirmada → remanejado → lista comum.

**RN-REM-02 · Não tira vaga de confirmado**
O remanejado nunca tira a vaga de quem já está confirmado (INV-10). A precedência vale só para vagas livres e sessões novas.

**RN-REM-03 · "Outra data" e "Desistir"**
O remanejado de sessão privada ou regulada vê **"Outra data"** e **"Desistir"** na nova data.
- **"Outra data", 1ª vez:** continua remanejado, com a preferência.
- **"Outra data", 2ª vez:** perde a preferência. Em sessão privada, volta para a lista comum com a data de entrada original; se era remanejado de sessão pública alocado numa privada, é encerrado com aviso "inscreva-se de novo"; em serviço regulado, sai e o agendador é avisado para comunicar a regulação.
- **"Desistir":** cancela de vez (em serviço regulado, com aviso ao agendador).

*Decisões: AD-045.*

**RN-REM-04 · Mantém risco e prioridade**
O remanejado mantém a classificação de risco e a prioridade legal que já tinha.

**RN-REM-05 · Remanejado de sessão pública escolhe a data**
QUANDO um inscrito de sessão pública virar remanejado, O SISTEMA DEVE avisá-lo ("sua sessão foi cancelada; escolha outra data com preferência") e deixá-lo em "aguardando remarcação", sem encaixe automático. Ele (ou a recepção e o agendador por ele, para quem não tem app) escolhe qualquer ocorrência pública do serviço, inclusive de séries:
- com vaga → confirmado (ou vaga segura, se faltar a foto, RN-ENC-04);
- lotada → **topo da lista de reserva**.

A inscrição segue as exigências da sessão escolhida (RN-LE-01, RN-PUB-04).
*Decisões: AD-031.*
- *Dado* Ana remanejada da sessão pública de terça, *quando* escolhe a de quinta, que está lotada, *então* entra no topo da reserva de quinta.

## Transições

Entrada:

<!-- gerado: contratos:excecoes:entrada -->
| De | Evento | Condição | Para | Efeitos |
| --- | --- | --- | --- | --- |
| Alocada, Confirmada, Na fila ou Aguardando encaminhamento (vaga segura) | Sessão cancelada, ou encerrada antes da vez | — | Remanejada | Push |
| Remanejada (de sessão pública) | Escolhe ocorrência pública do serviço | Vaga livre; exigências cumpridas; foto aceita, se exigida | Confirmada (ou Na fila, se a sessão já abriu) | RN-REM-05 |
| Remanejada (de sessão pública) | Escolhe ocorrência pública lotada | — | Na reserva (no topo) | RN-REM-05 |
| Remanejada (de sessão pública) | Escolhe ocorrência com vaga, sem foto aceita em serviço com requisição | Antes da abertura (com a sessão aberta, só com foto aceita) | Aguardando encaminhamento (vaga segura) | RN-ENC-04 |
| Remanejada (serviço regulado) | Agendador lança na reposição ou na próxima sessão | Vaga livre | Confirmada (ou Na fila, se a sessão já abriu) | RN-ENC-06 |
| Confirmada, Alocada, vaga segura ou Na fila ainda remoto (remanejada) | "Outra data" | 1ª recusa | Remanejada | Recusas +1; vaga liberada |
| Confirmada ou Alocada (remanejada de sessão privada) | "Outra data" | 2ª recusa | Aguardando (data original) | Perde a preferência |
| Confirmada ou Alocada (remanejada de sessão pública, alocada numa privada) | "Outra data" | 2ª recusa | Cancelada | Push "inscreva-se de novo" |
| Confirmada ou Alocada (remanejada, serviço regulado) | "Outra data" | 2ª recusa | Cancelada | Agendador avisado para comunicar a regulação |
| Confirmada, Alocada, vaga segura ou Na fila (remanejada) | "Desistir" | — | Cancelada | Vaga liberada; em serviço regulado, aviso ao agendador |
<!-- /gerado -->

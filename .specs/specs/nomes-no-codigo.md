# Nomes no código (inglês)

O código, os campos da API e do banco, os comentários e os testes são em inglês (decisão de 2026-11-16). Os textos que as pessoas leem (app, painel, TV) e os endereços das telas do painel e do app continuam em português; as specs continuam em português e citam os nomes do código como estão. Esta tabela é a fonte única: um termo do domínio tem um nome só em todo o código. IDs das specs (RN-…, AD-…, PD-…) não mudam.

## Conceitos

| Português (specs, telas) | Código |
| --- | --- |
| município | `municipality` |
| unidade (UBS, policlínica, UPA) | `unit` (`ubs`, `polyclinic`, `upa`) |
| serviço | `service` |
| sessão (atendimento numa data) | `session` |
| dia da sessão (fila do dia) | `sessionDay` |
| estação de chamada | `station` |
| TV | `tv` |
| entrada (pedido de atendimento de uma pessoa num serviço) | `entry` |
| item da fila | `queueItem` |
| fila do dia | `dayQueue` |
| lista de espera | `waitlist` |
| reserva | `reserve` |
| senha | `ticket` (o número: `ticketNumber` quando precisar distinguir) |
| vaga | `slot` |
| chamada | `call` |
| pulo | `skip` |
| falta | `noShow` |
| presença / check-in | `attendance` / `checkIn` |
| conferência (na recepção) | `verification` |
| pendência | `pending` (tipo `PendingCheck`) |
| inscrição (paciente entra numa sessão pública) | `signUp` |
| alocação (agendador põe numa sessão privada) | `allocation` |
| lançamento (serviço regulado) | `regulatedEntry` |
| remanejamento | `reassignment` |
| requisição (pedido médico) | `referral` |
| pré-cadastro | `preRegistration` |
| vínculo (com a unidade) | `unitLink` |
| contingência | `contingency` |
| auditoria | `audit` |
| aviso (push) | `notice` (canal de push: `push`) |
| "saia de casa" / "venha agora" | `leaveHome` / `comeNow` |
| "vou sair" | `leaving` |
| estimativa | `estimate` |
| tempo médio | `averageTime` |
| janela | `window` |
| prazo | `deadline` |
| fuso | `timeZone` |
| configuração | `config` |
| regras do município | `municipalityRules` |
| série (recorrência) | `series` |
| paciente (conta do app) | `patient` |
| pessoa local (atendida sem conta ou informada por outra conta) | `localPerson` |
| pessoa atendida | `attendedPerson` |
| responsável (conta que inscreveu) | `guardianPatientId` / `guardian` |
| relação com a pessoa | `relationship` (`legal_guardian`, `caregiver`, `family_or_friend`) |
| declaração | `declared` |
| usuário do painel | `staffUser` |
| equipe | `staff` |
| ocupação | `occupation` |
| função (de gestão) | `role` |
| perfil (de permissão) | `profile` |
| permissão / ação | `permission` / `action` |
| questionário | `questionnaire` |
| respostas | `answers` |
| classificação de risco | `riskClassification` |
| nível de risco | `riskLevel` |
| prioridade legal | `legalPriority` |
| grupo (de prioridade) | `priorityGroup` |
| triagem / atendimento (etapas) | `triage` / `care` |
| agenda (sessões públicas) | `schedule` |
| sugestão (do agendador) | `suggestion` |
| ligação (lista de ligação) | `callList` |

## Valores guardados (enums)

| Português | Código |
| --- | --- |
| risco: emergência, muito urgente, urgente, atenção, rotina | `emergency`, `very_urgent`, `urgent`, `attention`, `routine` |
| estado da entrada: aguardando encaminhamento, aguardando, alocada, confirmada, na reserva, na fila, remanejada, arquivada, concluída, cancelada, encerrada sem atendimento | `awaiting_referral`, `waiting`, `allocated`, `confirmed`, `in_reserve`, `in_queue`, `reassigned`, `archived`, `completed`, `cancelled`, `closed_without_care` |
| estado do item: remoto, presente, chamado, atendido na etapa, saiu da fila, remanejado | `remote`, `present`, `called`, `done_in_stage`, `left_queue`, `reassigned` |
| estado da sessão: planejada, aberta, cancelada, encerrada | `planned`, `open`, `cancelled`, `closed` |
| visibilidade: pública, privada | `public`, `private` |
| modo do serviço: livre, requisição, regulado | `direct`, `referral`, `regulated` |
| origem: privada, pública, regulada | `private`, `public`, `regulated` |
| status do município: criando, ativo, suspenso | `creating`, `active`, `suspended` |
| motivo de saída: pulos, falta, não conferiu, cancelou, removido | `skips`, `no_show`, `not_verified`, `cancelled`, `removed` |
| pendência: conta, pessoa atendida, pré-cadastro, prioridade | `account`, `attended_person`, `pre_registration`, `priority` |
| ordem do município: risco, prioridade | `risk`, `priority` |
| alarmes: falta de ar, dor no peito, desmaio, fraqueza de um lado, sangramento, convulsão, autolesão | `shortness_of_breath`, `chest_pain`, `fainting`, `one_sided_weakness`, `bleeding`, `seizure`, `self_harm` |
| motivo: novo, acompanhamento, exame, receita | `new`, `follow_up`, `exam`, `prescription` |
| gravidade: leve, moderado, forte | `mild`, `moderate`, `severe` |
| condições: diabetes, pressão alta, coração, respiratória, câncer, imunidade baixa | `diabetes`, `high_blood_pressure`, `heart`, `respiratory`, `cancer`, `low_immunity` |
| grupos: gestante, lactante, criança de colo, PcD, TEA, mobilidade reduzida, doador de sangue, obesidade | `pregnant`, `breastfeeding`, `infant_in_arms`, `disability`, `autism`, `reduced_mobility`, `blood_donor`, `obesity` |
| funções: gestão SMS, regulação SMS, gerente UBS, agendar | `sms_management`, `sms_regulation`, `unit_manager`, `scheduler` |
| perfis: paciente, recepção, enfermeiro, técnico de enfermagem, atendimento (+ as funções) | `patient`, `reception`, `nurse`, `nursing_technician`, `care` |
| ocupações: médico, enfermeiro, técnico de enfermagem, cirurgião-dentista, auxiliar de saúde bucal, ACS, recepção, farmacêutico, psicólogo, fisioterapeuta, nutricionista, assistente social | `physician`, `nurse`, `nursing_technician`, `dentist`, `oral_health_assistant`, `community_health_agent`, `reception`, `pharmacist`, `psychologist`, `physiotherapist`, `nutritionist`, `social_worker` |
| tipo de unidade: UBS, policlínica, UPA | `ubs`, `polyclinic`, `upa` |

Códigos de erro e ações de permissão seguem as mesmas palavras em `snake_case` (ex.: `transicao_proibida` → `forbidden_transition`, `sem_vaga` → `no_slot`, `conferir_e_marcar_presenca` → `verify_and_mark_attendance`).

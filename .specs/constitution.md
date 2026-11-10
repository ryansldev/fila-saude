# Constituição do Fila Saúde

Princípios que valem para todo o projeto, acima de qualquer feature. Toda spec, plan e task é conferida contra este documento. Mudar um princípio exige uma decisão registrada em [decisions.md](decisions.md).

## Produto

1. **Somos só a fila.** Não guardamos prontuário. Depois da triagem e do atendimento, a responsabilidade é de outro sistema.
2. **O humano decide.** O sistema sugere prioridade e alocação, sempre com justificativa. Agendador e triagem confirmam. Quem está na sala só chama e atende; conferir documento é da recepção. Nada é alocado sem ação de um agendador.
3. **Presente tem preferência.** Só é chamado quem está na unidade, e quem já está esperando não é ultrapassado por quem chega atrasado.
4. **Saúde em primeiro lugar.** Urgência confirmada por um profissional passa na frente.
5. **Ninguém fica de fora.** Quem não tem celular ou internet entra pela recepção, no mesmo fluxo. Todo fluxo do paciente tem equivalente no balcão.
6. **Privacidade.** Um paciente nunca vê outros pacientes, nem na lista de espera nem na fila. A TV mostra só senhas. Notificação nunca leva dado clínico.
7. **Quem é prejudicado pela unidade ganha preferência; quem desiste perde a vez.**
8. **Um app só, da empresa, para todos os municípios.** O Fila Saúde é uma central de filas para atendimento público. Cada prefeitura tem seus dados isolados; nunca há um app por prefeitura.
9. **A prefeitura é dona dos dados** (controladora); a empresa é a operadora. Dados no Brasil.
10. **Código aberto, serviço pago.** O código é AGPL-3.0; todo município que usa o app paga mensalidade, pela hospedagem completa ou pela conexão à central e ao app. A marca é da empresa.

## Processo

1. **TDD sempre.** Toda task começa pelo teste que falha. Plans e tasks dizem isso explicitamente.
2. **Uma fonte por fato.** Cada regra é escrita uma vez, na spec da sua capacidade (`specs/<capacidade>/spec.md`). Decisões, plan, tasks e testes citam o ID, sem reescrever a regra.
3. **A spec mostra só o que vale hoje.** Histórico e motivo ficam em [decisions.md](decisions.md). Uma decisão substituída sai das specs.
4. **Formato das regras.** Cada regra tem ID estável (`RN-<ÁREA>-NN`), título, texto no formato "QUANDO … O SISTEMA DEVE …" sempre que descreve comportamento, e as decisões que a moldaram. Regras novas ou alteradas vêm com cenários Dado/Quando/Então; as herdadas ganham cenários quando viram teste.
5. **Contratos de estado.** As tabelas de transição das specs, somadas, são o contrato: transição não listada é proibida e retorna erro. Na fase 1 elas viram dados no `packages/domain`, e as tabelas das specs passam a ser geradas.
6. **Fluxo de uma decisão:** editar a regra na spec da capacidade, registrar a decisão em `decisions.md` (com as regras que muda) e rodar `npm run specs:check`. A task só muda se o escopo mudar.
7. **Mudança grande** (uma feature nova) nasce em `changes/<data-nome>/` (proposta, delta, tasks) e é incorporada às specs quando concluída.
8. **Explicar antes de perguntar.** Decisões técnicas são apresentadas com um caso concreto do sistema e as consequências de cada opção.

# Plano: triagem numa sala só, com ou sem classificação de risco

> Combinado na conversa de 2026-11-27, na revisão da OC12 (PR #47). Branch própria depois da `feat/pause-and-close`, antes da PA5. Substitui a AD-061 (acolhimento do técnico volta para o enfermeiro) e o mecanismo da OC9 e da OC12 (a estação guarda se quem a opera classifica).

## Por quê

Hoje a triagem tem duas esperas: o técnico acolhe, a pessoa volta à fila como "acolhida" e a enfermeira a chama de novo para classificar (AD-061). Para a pausa saber quem ainda pode chamar a acolhida, a estação adivinha se classifica pelo perfil de quem fez a última ação (OC9), e erra no começo do dia e na troca de turno (OC12). Na unidade, o objetivo da sala não muda com quem está nela.

## O que você decidiu

- **A triagem é numa sala só:** chamar, acolher e (quando há) classificar no mesmo atendimento. Sai o estado "acolhida" e a segunda espera.
- **A sessão diz se tem classificação de risco** ("esta sessão tem classificação de risco?"). Nem toda unidade classifica; às vezes é só acolhimento.
- **Com classificação, segue a lei** (Cofen 661/2021, RN-PERF-05): chamar não é privativo (técnico ou enfermeira chamam); finalizar com a cor do risco, só a enfermeira.
- **Só acolhimento:** finaliza sem cor, técnico ou enfermeira; o atendimento depois segue só a prioridade legal e a chegada.
- **O questionário do app continua** na sessão só de acolhimento, pelos encaminhamentos de emergência (192, CVV), sem sugerir cor.
- **O padrão da pergunta:** "sim" quando o serviço pede triagem; muda só enquanto a sessão está planejada, como o horário.

## A decidir no desenho da branch

- Com classificação, a estação logada pelo técnico: como a enfermeira finaliza com a cor (ex.: a senha dela na hora de classificar, e a auditoria guarda quem chamou e quem classificou).
- O que a pausa conta: toda estação de triagem aberta chama qualquer um da etapa, então a pergunta da opção C só olha as estações abertas e fora de pausa.
- Dados: a coluna na sessão (migração: as sessões com triagem viram "com classificação"), o estado "acolhida" no banco e o teste `welcomed.test.ts`.

## Fatias (TDD em cada uma)

A definir no início da branch, a partir do desenho acima. Ao terminar: a AD nova (substitui a AD-061 e a OC9 da AD-078), as specs (RN-PERF-05, permissões, chamada), a E3 revista e este plano no arquivo.

# Decisões

Registro curto de cada decisão: o que, por quê e quais regras muda. A regra em si vive só na spec da capacidade ([specs/](specs/)). Status: **ativa**, **substituída por …** ou **parcial** (parte substituída). Decisões de produto são `AD-*`; de arquitetura, `PD-*`. Para mudar algo: editar a regra, registrar aqui e rodar `npm run specs:check`.

## Índice

| ID | Título | Status |
| --- | --- | --- |
| AD-001 | Protótipo antes do MVP | ativa |
| AD-002 | Presente vê a posição na ordem real | ativa |
| AD-003 | "Venha agora" para o 1º remoto | ativa |
| AD-004 | Risco × prioridade legal configurável | ativa |
| AD-005 | Protótipo no visual da landing | parcial (AD-008) |
| AD-006 | Sem pulo automático | ativa |
| AD-007 | Triagem como etapa própria | ativa |
| AD-008 | Protótipo com fluxo principal e modo livre | ativa |
| AD-009 | Um "saia de casa" por etapa | ativa |
| AD-010 | Atraso pela ordem real | substituída por AD-076 |
| AD-011 | Visibilidade por sessão | ativa |
| AD-012 | TV só com senhas | ativa |
| AD-013 | Inscrição pública já confirmada | ativa |
| AD-014 | Recorrência RFC 5545 | ativa |
| AD-015 | Vaga segura em sessão pública com requisição | ativa |
| AD-016 | Dispensa pré-cadastro | ativa |
| AD-017 | Identidade por nível de confiança | ativa (efeito no check-in pela AD-054) |
| AD-018 | Inscrever outra pessoa | ativa (efeito no check-in pela AD-054) |
| AD-019 | E-mail obrigatório; recepção redefine acesso | ativa |
| AD-020 | Contingência | ativa |
| AD-021 | Sair da fila por pulos sempre gera falta, anulável | ativa |
| AD-022 | Destaque da TV configurável | ativa |
| AD-023 | Limite da recepção sobre a prioridade | ativa |
| AD-024 | Prioridade autodeclarada é conferida | ativa (efeito no check-in pela AD-054) |
| AD-025 | Grupos de prioridade fixos no código | ativa |
| AD-026 | Dois modos de marcação de especialidade | ativa |
| AD-027 | Prioridade da pessoa atendida | ativa (a confirmar no D5) |
| AD-028 | Um app só, da empresa | ativa |
| AD-029 | Linha de base e sucesso do piloto | ativa |
| AD-030 | Perdão de atraso para quem esperou validação | substituída por AD-050 |
| AD-031 | Remanejado de sessão pública escolhe a data | ativa |
| AD-032 | Lista de espera bloqueia sessão pública do serviço | ativa |
| AD-033 | Contingência nas regras de falta e atraso | ativa |
| AD-034 | Prioridade nova só vale após conferência | substituída por AD-050 |
| AD-035 | Pessoa sem app é pessoa local | ativa |
| AD-036 | Risco e prioridade do lançado | ativa |
| AD-037 | Lançamento no dia e remoção | ativa |
| AD-038 | Mudanças de configuração seguras | ativa |
| AD-039 | "Não conferiu" | ativa |
| AD-040 | Falta antes da conferência vai ao responsável | ativa |
| AD-041 | "A vez passou" na etapa atual | ativa |
| AD-042 | Eventos de fila e CSV de métricas | ativa |
| AD-043 | Modo manual na queda da unidade | ativa |
| AD-044 | Pergunta de autolesão no balcão | ativa |
| AD-045 | "Outra data" e "Desistir" | ativa |
| AD-046 | Vaga sem foto aceita é vaga segura | ativa |
| AD-047 | Reserva troca por vaga | ativa |
| AD-048 | Sem balcão em serviço regulado | ativa |
| AD-049 | Lançamento só liga a conta verificada | ativa |
| AD-050 | Pendência não tira a vez | substituída por AD-054 |
| AD-051 | Estrutura das specs | ativa |
| AD-052 | Licença AGPL-3.0 e receita por município | ativa |
| AD-053 | Pré-cadastro com foto ligado por padrão | ativa |
| AD-054 | Conferência antes de entrar na fila presencial | ativa |
| AD-055 | Uma leitura do QR vale para todas as pessoas da conta | ativa |
| AD-056 | Decisões da revisão de 2026-11-13 | ativa |
| AD-057 | Prazo de chegada depois do "venha agora" | parcial (AD-076) |
| AD-058 | Triagem pelo Manchester padrão (cinco cores) | ativa |
| AD-059 | Vermelho fica na unidade; encaminhar à emergência é à parte | ativa |
| AD-060 | Refazer o questionário em casa no dia, com alerta de declaração falsa | ativa |
| AD-061 | Acolhimento do técnico volta para o enfermeiro classificar | ativa |
| AD-062 | Captcha: Cloudflare Turnstile, já na v0.1 (inscrição pública e login acima do teto) | ativa |
| AD-063 | Contagem de tentativas no Postgres (UNLOGGED, chave em HMAC) | ativa |
| AD-064 | Bloqueio do login pelo par (login, IP), com teto por login que pede captcha | ativa |
| AD-065 | Regras e valores das tentativas de login e de CPFs informados | ativa |
| AD-066 | Docs públicas com Fumadocs no site, referência gerada do OpenAPI | ativa |
| AD-067 | Schemas Zod declarados nas rotas do Fastify | ativa |
| AD-068 | Versões da API: o que quebra vai para uma nova, a anterior fica 6 meses | ativa |
| AD-069 | Domínios de produção: `api.filasaude.com.br` e `<município>.filasaude.com.br` | ativa |
| AD-070 | Decisões do alinhamento de 2026-11-19 | ativa |
| AD-071 | `google-services.json` fora do git; no EAS, variável de arquivo | ativa |
| AD-072 | Rechamar também manda push | ativa |
| AD-073 | Push no Android: sempre o coração azul, sem imagem grande | ativa |
| AD-074 | Push sai na hora do evento; chamada que perdeu a hora não sai | ativa |
| AD-075 | 80+ antes dos demais idosos, sem hierarquia entre grupos (vagas dos idosos) | ativa |
| AD-076 | Perde a vez só quem não chega no prazo; 2 pulos tiram da fila | ativa |
| AD-077 | Pausa avisada, fechar a estação e horário em faixas | ativa |
| PD-01..PD-31 | Arquitetura do MVP | ativas (ver [plan](features/mvp-filas/plan.md); PD-14..PD-31 detalhadas nos planos das fases 1B e 2) |

## Produto

### AD-001 · Protótipo antes do MVP
2026-11-04 · ativa · Muda: —
Protótipo HTML+CSS+JS antes de qualquer código do MVP. **Por quê:** validar as regras de fila barato.

### AD-002 · Presente vê a posição na ordem real
2026-11-04 · ativa · Muda: RN-ETA-01b
O presente vê o lugar na ordem de chamada real (com janela protegida); tempo = (posição − 1) × média ÷ estações abertas. **Por quê:** a contagem do remoto enganava quem já estava na sala.

### AD-003 · "Venha agora" para o 1º remoto
2026-11-04 · ativa · Muda: RN-ETA-04
Remoto que já é o 1º, com estação aberta, vê "venha agora"; só é chamado após ler o QR. **Por quê:** "1º · ~0 min" enganava.

### AD-004 · Risco × prioridade legal configurável
2026-11-04 · ativa · Muda: RN-ORD, RN-AL-02
A ordem entre risco e prioridade legal é configuração do município (padrão: risco antes), sempre abaixo de urgência confirmada. **Por quê:** é decisão local.

### AD-005 · Protótipo no visual da landing
2026-11-04 · parcial (substituída em parte pela AD-008) · Muda: —
Protótipo no visual de `apps/web`, sem animações.

### AD-006 · Sem pulo automático
2026-11-04 · ativa · Muda: RN-CHAM-03, RN-EST-05
A tolerância é só contador; a fila avança por "Chamar próximo" ou "Não compareceu". **Por quê:** o pulo automático pulava quem estava em consulta.

### AD-007 · Triagem como etapa própria
2026-11-04 · ativa · Muda: RN-TRI-01..05
Serviço "exige triagem" + estação de triagem; mesma senha nas duas filas.

### AD-008 · Protótipo com fluxo principal e modo livre
2026-11-04 · ativa · Muda: —
Protótipo = apresentação + fluxo principal único + modo livre, com botão que avança o relógio.

### AD-009 · Um "saia de casa" por etapa
2026-11-04 · ativa · Muda: RN-ETA-01c, RN-ETA-03, RN-TRI-05
Antes da triagem, o aviso usa só o tempo até a triagem; a previsão da consulta aparece à parte. **Por quê:** o aviso da consulta nunca disparava.

### AD-010 · Atraso pela ordem real
2026-11-04 · substituída por AD-076 · Muda: RN-ORD (atraso), RN-FALTA-01
Perde a vez só quem teve chamado, na mesma etapa, alguém que vinha depois na ordem real. **Por quê:** urgente com número maior tirava a vez de quem chegava.

### AD-011 · Visibilidade por sessão
2026-11-09 · ativa · Muda: RN-PUB, RN-AL
Pública = autoinscrição; privada = lista de espera e agendador. **Por quê:** nem toda unidade tem os mesmos serviços.

### AD-012 · TV só com senhas
2026-11-09 · ativa · Muda: RN-TV-05
Nenhum nome na TV; quem é incluído no balcão recebe papel com a senha. **Por quê:** primeiro nome repete e mais que isso fere a privacidade.

### AD-013 · Inscrição pública já confirmada
2026-11-09 · ativa · Muda: RN-PUB-01
**Por quê:** o paciente escolheu o dia.

### AD-014 · Recorrência RFC 5545
2026-11-09 · ativa · Muda: modelo (Série, Sessão)
Sessões com DTSTART/DTEND, RRULE, EXDATE, RDATE; cada ocorrência é uma sessão própria. **Por quê:** padrão de mercado.

### AD-015 · Vaga segura em sessão pública com requisição
2026-11-10 · ativa · Muda: RN-ENC-04
A inscrição segura a vaga até a foto ser aceita; sem aceite na abertura, a vaga é liberada.

### AD-016 · Dispensa pré-cadastro
2026-11-10 · ativa · Muda: RN-PUB-04, RN-LE-01
Opção genérica de sessão pública que ignora pré-cadastro e vínculo (ex.: plantão). **Por quê:** plantão atende quem aparecer.

### AD-017 · Identidade por nível de confiança
2026-11-10 · ativa · Muda: RN-ID-05..07, RN-FILA-05
Conta nasce não verificada e já usa o app; vira verificada quando o documento é conferido presencialmente; gov.br depois do piloto; biometria reavaliada depois. **Por quê:** lançar sem depender da prefeitura. Discovery: [identidade](features/mvp-filas/discovery-identidade.md).

### AD-018 · Inscrever outra pessoa
2026-11-10 · ativa · Muda: RN-LE-05, RN-LE-06
O app pergunta "para quem é?"; classificação, prioridade e falta são da pessoa atendida; sem cadastro de dependentes. **Por quê:** pais marcam para filhos, familiares para idosos.

### AD-019 · E-mail obrigatório; recepção redefine acesso
2026-11-10 · ativa · Muda: RN-ID-01
**Por quê:** parte do público não lembra o e-mail. WhatsApp depois do MVP.

### AD-020 · Contingência
2026-11-10 · ativa · Muda: RN-CONT-01, RN-CONT-02, RN-CONT-04
Lista do dia impressa, chamada pelo papel e reconciliação na volta, com motivo e sinais de vida. **Por quê:** o piloto não tem alta disponibilidade.

### AD-021 · Sair da fila por pulos sempre gera falta, anulável
2026-11-10 · ativa · Muda: RN-CHAM-03, RN-FALTA-02
**Por quê:** o sistema não distingue quem foi embora de quem não ouviu; a recepção corrige o caso injusto.

### AD-022 · Destaque da TV configurável
2026-11-10 · ativa · Muda: RN-TV-07
Por unidade, padrão 10 s. **Por quê:** unidades de tamanhos diferentes.

### AD-023 · Limite da recepção sobre a prioridade
2026-11-10 · ativa · Muda: RN-RISCO-04, RN-PERF-03
A recepção dá prioridade só ao incluir no balcão (ou na 1ª presença de sem app) e tira a qualquer momento; ajustes que mexem na ordem vão ao relatório do gestor. **Por quê:** evitar subir quem já está na fila.

### AD-024 · Prioridade autodeclarada é conferida
2026-11-10 · ativa · Muda: RN-RISCO-04, RN-FILA-05
Aviso ao declarar; conferência visual ou por documento; vale nas próximas idas, exceto as com prazo. **Por quê:** autodeclaração aberta demais.

### AD-025 · Grupos de prioridade fixos no código
2026-11-10 · ativa · Muda: RN-RISCO-04
Lei 10.048 com a Lei 14.626/2023 (inclui mobilidade reduzida e doador de sangue). **Por quê:** sem tela de edição antes de saber se algum município precisa.

### AD-026 · Dois modos de marcação de especialidade
2026-11-10 · ativa · Muda: RN-ENC-05, RN-ENC-06
Requisição pelo app (paciente marca de casa) ou regulado pela central (agendador lança); integração com a regulação depois do piloto. **Por quê:** municípios diferem. Discovery: [regulação](features/mvp-filas/discovery-regulacao.md).

### AD-027 · Prioridade da pessoa atendida
2026-11-10 · ativa (a confirmar no D5) · Muda: RN-RISCO-04
A do acompanhante não passa ao atendido; criança de colo atendida mantém a prioridade.

### AD-028 · Um app só, da empresa
2026-11-10 · ativa · Muda: constituição
O Fila Saúde é uma central de filas para atendimento público; nunca um app por prefeitura. Publicação nas lojas no D10.

### AD-029 · Linha de base e sucesso do piloto
2026-11-10 · ativa · Muda: RNF-MET-01
Linha de base por entrevista de 1 h com a recepção (D4); critérios: espera na unidade, % pelo app, faltas, avaliação da equipe. **Por quê:** sem tempo para observação dedicada.

### AD-030 · Perdão de atraso para quem esperou validação
2026-11-10 · **substituída por AD-050**
Contava o atraso pela hora do check-in, com prazo de 15 min. Criava a brecha de "congelar" o lugar.

### AD-031 · Remanejado de sessão pública escolhe a data
2026-11-10 · ativa · Muda: RN-REM-05
Sem encaixe automático: escolhe com preferência (com vaga, confirmado; lotada, topo da reserva). **Por quê:** o encaixe gerava falta por data não aceita, alcançava quem não tem app e ignorava exigências.

### AD-032 · Lista de espera bloqueia sessão pública do serviço
2026-11-10 · ativa · Muda: RN-LE-02
Uma entrada ativa por serviço vale também para sessão pública; o app explica.

### AD-033 · Contingência nas regras de falta e atraso
2026-11-10 · ativa · Muda: RN-CONT-01, RN-CONT-03, RN-SES-04, RN-ORD (atraso)
Aviso antes de encerrar com sinal perdido; registro tardio apaga faltas; chamadas do papel não contam para atraso; lista imprimível a qualquer momento, uso interno.

### AD-034 · Prioridade nova só vale após conferência
2026-11-10 · **substituída por AD-050**

### AD-035 · Pessoa sem app é pessoa local
2026-11-10 · ativa · Muda: modelo, RN-LE-04, RN-PRES-03
Registro no banco do município, vinculável pelo CPF. **Por quê:** o central fica só com quem tem conta.

### AD-036 · Risco e prioridade do lançado
2026-11-10 · ativa · Muda: RN-ENC-06, RN-RISCO-01
Agendador informa a classificação da regulação (padrão rotina); paciente com app declara prioridade pela Tela 5.

### AD-037 · Lançamento no dia e remoção
2026-11-10 · ativa · Muda: RN-ENC-06
Lançar com sessão aberta entra direto na fila; agendador remove lançamento não chamado, com motivo.

### AD-038 · Mudanças de configuração seguras
2026-11-10 · ativa · Muda: RN-ENC-07, RN-PUB-03
Serviço regulado não tem sessão pública; privada perde a dispensa; troca para regulado bloqueada com entradas ativas e converte o resto.

### AD-039 · "Não conferiu"
2026-11-10 · ativa · Muda: RN-FILA-05
Identidade que não confere tira da fila sem remanejamento nem falta; prioridade que não confere só é retirada. (A conferência é só na recepção desde a AD-054.)

### AD-040 · Falta antes da conferência vai ao responsável
2026-11-10 · ativa · Muda: RN-ID-06, RN-FALTA-01
Exceção: lançado regulado leva a falta pelo CPF da regulação. **Por quê:** evitar falta no CPF de um terceiro.

### AD-041 · "A vez passou" na etapa atual
2026-11-10 · ativa · Muda: RN-SES-02, RN-FALTA-01
No encerramento, quem já foi atendido numa etapa não leva falta; a falta por pulos segue valendo.

### AD-042 · Eventos de fila e CSV de métricas
2026-11-10 · ativa · Muda: RNF-MET-01, modelo
**Por quê:** sem isso o piloto termina sem a métrica principal.

### AD-043 · Modo manual na queda da unidade
2026-11-10 · ativa · Muda: RN-SES-05, RN-ETA-03
TV e todas as estações sem sinal por ~2 min suspendem "saia de casa" e estimativa. **Por quê:** a API no ar não sabe que a unidade chama pelo papel.

### AD-044 · Pergunta de autolesão no balcão
2026-11-10 · ativa · Muda: RN-RISCO-06
A recepção vê a pergunta só durante a aplicação, com CVV e SAMU no painel.

### AD-045 · "Outra data" e "Desistir"
2026-11-10 · ativa · Muda: RN-REM-03
**Por quê:** "Não vou poder ir" cancelava o remanejado na 1ª vez, contra a regra da recusa única.

### AD-046 · Vaga sem foto aceita é vaga segura
2026-11-10 · ativa · Muda: RN-ENC-04
Vale para remanejamento, reserva e troca.

### AD-047 · Reserva troca por vaga
2026-11-10 · ativa · Muda: RN-PUB-02, RN-LE-02

### AD-048 · Sem balcão em serviço regulado
2026-11-10 · ativa · Muda: RN-ENC-05
**Por quê:** a vaga é da regulação.

### AD-049 · Lançamento só liga a conta verificada
2026-11-10 · ativa · Muda: RN-ENC-06
**Por quê:** quem criou conta com CPF alheio receberia dado de saúde e poderia desmarcar.

### AD-050 · Pendência não tira a vez
2026-11-10 · **substituída por AD-054** · Substituía: AD-030, AD-034
Presente com pendência é elegível; o app manda passar na recepção; se chamado antes, o profissional confere. **Por quê:** o prazo do perdão punia quem esperava no balcão e exigia vigilância da recepção; os pulos já resolvem quem foi embora.

### AD-051 · Estrutura das specs
2026-11-10 · ativa · Muda: constituição
Specs por capacidade com só a verdade atual, regras "QUANDO … O SISTEMA DEVE …" com cenários, este registro curto de decisões, `changes/` para mudança grande, núcleo executável na fase 1 e checagem automática.

### AD-052 · Licença AGPL-3.0 e receita por município
2026-11-10 · ativa · Muda: constituição (produto)
O código passa de MIT para **AGPL-3.0** daqui em diante (o já publicado segue MIT). A receita é mensal por município: **hospedagem completa** (VPS do município, central e app; mínimo R$ 1.500) ou **taxa de conexão** à central e ao app para quem roda o backend por conta própria (valor no D7). Quem quiser operar sem a central e sem o app precisa de outro app com outro nome; a quem fizer isso, vende-se licença comercial. Pendências: CLA para contribuições e revisão do advogado (D5/D7). **Por quê:** código aberto para portfólio e comunidade, sem permitir fork fechado; o que gera receita (central, app publicado, marca e operação) não se copia do repositório. Discovery: [preço](features/mvp-filas/discovery-preco.md).

### AD-053 · Pré-cadastro com foto ligado por padrão
2026-11-10 · ativa · Muda: configuração da unidade (specs/modelo), RN-PRE-01
Toda unidade começa exigindo o pré-cadastro (foto do documento com foto e do Cartão SUS); o município pode desligar por unidade. Para a adesão de quem tem dificuldade com o celular, a implantação inclui uma **campanha de cadastro**: sessões públicas na unidade em que a recepção faz o pré-cadastro no balcão (RN-PRE-06). **Por quê:** conferência mais rápida e segura (foto × rosto × documento) e dados prontos na primeira ida; o atrito para o público de 60+ é compensado pela campanha. Plantão e sessões com dispensa seguem dispensando (RN-PUB-04).

### AD-054 · Conferência antes de entrar na fila presencial
2026-11-10 · ativa · Muda: RN-FILA-05, RN-ID-05, RN-PRE-03, RN-LE-06, RN-RISCO-03, RN-RISCO-04, permissões · Substitui: AD-050
Com pendência, o check-in pelo QR é **recusado** ("passe na recepção"); a pessoa segue remota, com o lugar que tinha. A recepção confere e **marca a presença na mesma ação**; a regra de atraso conta a partir dela. O app avisa antes da chegada para passar na recepção primeiro. O profissional só chama e atende; a estação não confere nada. Prioridade nova declarada por quem já está presente só vale depois de conferida. **Por quê:** na rotina real quem está na sala controla a fila e não confere documento; tira o estado "presente com pendência" e a conferência na estação; a brecha de "congelar" o lugar continua fechada (quem nunca entrou presencialmente não tem lugar presencial). Custo: num balcão lento, quem leu o QR antes de passar na recepção pode ser ultrapassado; acontece uma vez por pessoa e a campanha de cadastro (AD-053) reduz.

### AD-055 · Uma leitura do QR vale para todas as pessoas da conta
2026-11-12 · ativa · Muda: RN-PRES-01
Quem lê o QR marca a presença de todas as pessoas da conta com senha nas sessões abertas da unidade; cada uma tem o próprio resultado (presente ou pendente). Confirmada com a v0.1 (Q3); a conferência na 1ª ida (Q5) já era RN-ID-05 e AD-054. **Por quê:** quem leva o filho lê um QR só. Custo: quem marcou para alguém que não veio junto marca a presença dela; se ninguém aparecer na chamada, os pulos resolvem.

### AD-056 · Decisões da revisão de 2026-11-13
2026-11-13 · ativa · Muda: RN-TRI-04, RN-RISCO-01, notificações (specs/tv-e-avisos)
(1) **O atendimento é uma fila nova:** quem sai da triagem recebe o próximo número e entra atrás de quem já estava no atendimento, dentro do seu nível de risco e prioridade, com a mesma senha. (2) **Só o enfermeiro confirma risco:** o questionário do app é pré-triagem (sugerido); o agendador não confirma na alocação. Na triagem (fatia 3), o enfermeiro classifica pelas cores do Acolhimento com Classificação de Risco do Ministério da Saúde. (3) **Quem perde a vez** vai para o fim do seu nível de risco e prioridade. (4) **"Venha agora"** vale para todo remoto sem ninguém na frente, não só urgência confirmada. **Por quê:** decisões suas na revisão (RV8–RV11).

### AD-057 · Prazo de chegada depois do "venha agora"
2026-11-14 · parcial (substituída em parte pela AD-076: perder a vez agora é só não chegar no prazo, padrão 30 min) · Muda: AD-010, RN-ORD (atraso), RN-ETA-06
O remoto só perde a vez por chamadas feitas depois do fim do prazo de chegada (padrão 15 min, config da unidade), contado da hora em que recebeu o "venha agora". Quem nunca recebeu "venha agora" não perde a vez porque a fila andou. Quem estoura o prazo deixa de contar à frente dos outros. **Por quê:** com a regra antiga, o 10º remoto podia perder a vez porque o balcão andou rápido, sem nunca ter sido avisado para vir. Custo: em modo manual não há "venha agora", então remoto não perde a vez por atraso; quem decide é o pulo.

### AD-058 · Triagem pelo Manchester padrão (cinco cores)
2026-11-14 · ativa · Muda: AD-056 (2), RN-TRI-03, RN-RISCO-01
A triagem classifica pelas cinco cores do Sistema Manchester: vermelho (emergência, imediato), laranja (muito urgente, até 10 min), amarelo (urgente, até 60 min), verde (pouco urgente, até 120 min), azul (não urgente, até 240 min). O nível novo `muito_urgente` só vem da triagem; o questionário do app continua sugerindo quatro níveis. Laranja e amarelo confirmados são urgência confirmada (sempre primeiro), e laranja vem antes de amarelo. Vermelho: ver AD-059. **Por quê:** decisão sua, 2026-11-14 ("usa o protocolo manchester padrão"). Os tempos-alvo aparecem só como referência na estação; a fila não muda de ordem pelo tempo.

### AD-059 · Vermelho fica na unidade; encaminhar à emergência é à parte
2026-11-14 · ativa · Muda: AD-058, RN-TRI-03, RN-TRI-04
Vermelho na triagem põe a pessoa em 1º lugar no atendimento desta unidade, à frente do laranja (urgência confirmada de maior peso). Encaminhar à emergência é uma ação explícita do enfermeiro, só com vermelho, com confirmação: a triagem fecha, a pessoa sai da fila da unidade e a entrada fica concluída, com o evento `encaminhado_emergencia`. **Por quê:** decisão sua, 2026-11-14: muitas vezes a pessoa está na unidade e pode ser atendida ali; tirar da fila de imediato não faz sentido.

### AD-060 · Refazer o questionário em casa no dia, com alerta de declaração falsa
2026-11-17 · ativa · Muda: RN-RISCO-03, RN-PIORA-01 (substitui a provisória I9)
Quem está na fila do dia ainda em casa refaz o questionário pelo app e o risco sugerido sobe na fila, como a RN-PIORA-01 já dizia; na unidade continua valendo "meus sintomas pioraram". A 1ª pergunta do questionário (inscrição, lista e refazer) avisa que as respostas mudam a ordem da fila e que informar sintoma falso para passar na frente pode ser crime de falsidade ideológica (art. 299 do Código Penal); o texto aguarda a revisão jurídica (D5). **Por quê:** decisão sua, 2026-11-17 ("precisamos seguir a spec. MAS, devemos alertar do crime de falsidade ideológica pra ninguém passar um sintoma ou algo do tipo que não seja verdade").

### AD-061 · Acolhimento do técnico volta para o enfermeiro classificar
2026-11-17 · ativa · Muda: RN-PERF-05, RN-TRI-03
O técnico de enfermagem chama na estação de triagem para o acolhimento e os sinais vitais, mas não manda cor (a API recusa). Ao finalizar, a pessoa volta presente à fila da triagem, marcada como acolhida; quem classifica (enfermeiro) a chama antes dos outros e a manda para o atendimento com a cor. O técnico não chama de novo quem já acolheu. **Por quê:** decisão sua, 2026-11-17 ("volta para o enfermeiro"): a classificação de risco é ato privativo do enfermeiro (Cofen 661/2021) e a pessoa não pode ir ao atendimento sem ela.

### AD-062 · Captcha: Cloudflare Turnstile, já na v0.1 (inscrição pública e login acima do teto)
2026-11-18 · ativa · Muda: RN-ID-07
O captcha da RN-ID-07 é o Cloudflare Turnstile (grátis, sem limite de pedidos, quase sempre invisível). No app, entra por uma WebView que carrega uma página do widget num domínio nosso; a API confere o token na Cloudflare antes de inscrever em sessão pública. Se o desafio falhar no aparelho, a pessoa recebe um aviso e é levada à recepção. O Turnstile manda IP e sinais do aparelho à Cloudflare (EUA): é transferência internacional (LGPD, art. 33), que entra no contrato com o município e no aviso de privacidade (D5). O mesmo captcha serve ao login do app e do painel passado o teto de erros (AD-064); no painel e na prévia web do app, o widget entra direto na página. O token vai no cabeçalho `X-Captcha-Token` e vale uma vez. Sem token, a API responde `captcha_required` e o cliente mostra o captcha; token recusado é `captcha_failed`, e o cliente só mostra o aviso, sem reenviar sozinho; na inscrição, a Cloudflare fora do ar é 503 `captcha_unavailable` (detalhes em CP1 e CP2 das [decisões para revisar](features/mvp-filas/decisoes-para-revisar.md)). Em produção, a API recusa subir com as chaves de teste da Cloudflare. **Entra já na v0.1.** **Por quê:** decisão sua, 2026-11-18, depois do [discovery do captcha](features/mvp-filas/discovery-captcha.md): segura melhor que a prova de trabalho e bate com o que um edital espera. Primeiro ficou para depois da v0.1 ("não acho que precisamos pra essa v0.1 ainda"); no mesmo dia, com o teto do login pedindo captcha, virou "mete marcha direto no Cloudflare mesmo (já que é gratuito)".

### AD-063 · Contagem de tentativas no Postgres (UNLOGGED, chave em HMAC)
2026-11-18 · ativa · Muda: RN-ID-04, RN-ID-07
A contagem de senhas erradas e de CPFs informados fica numa tabela UNLOGGED (`attempt`) do banco central, comum a todas as instâncias da API, e não mais na memória do processo. A chave é o HMAC (SHA-256 com o segredo da API) de CPF, login ou IP, nunca o valor. A linha some quando vence; os erros do login, depois de 7 dias sem tentativa (quem espaça os erros para escapar tenta no máximo 4 senhas por semana). O limitador do próprio better-auth segue em memória (janela de segundos). **Por quê:** decisão sua, 2026-11-18, depois do [discovery do armazenamento](features/mvp-filas/discovery-tentativas-armazenamento.md): não quebra com mais de uma instância nem num deploy, não acrescenta serviço (sem Redis, PD-07), e UNLOGGED deixa as contagens fora do WAL, do backup e das réplicas.

### AD-064 · Bloqueio do login pelo par (login, IP), com teto por login que pede captcha
2026-11-18 · ativa · Muda: RN-ID-04
5 senhas erradas seguidas bloqueiam o par (login, IP) por 15 min, e não mais o login inteiro: quem erra de propósito bloqueia só o próprio par, e o dono do login, de outro IP (o da UBS), entra. No IPv6 conta o bloco /64. Contra quem troca de IP (VPN, botnet), há um teto por login: passadas 30 senhas erradas numa hora, somando os IPs, o login pede captcha (AD-062) a todos até a hora passar. O IP é só o que a API resolve pelos proxies de `TRUSTED_PROXIES`; o `X-Forwarded-For` do cliente é ignorado. **Por quê:** decisão sua, 2026-11-18 ("acho que IP é melhor", com a dúvida da VPN), depois do [discovery da contagem por IP](features/mvp-filas/discovery-bloqueio-por-ip.md): bloquear só por IP derrubaria a UBS inteira (NAT) e os vizinhos de operadora (CGNAT), e só por login deixava qualquer um trancar o "gestor".

### AD-065 · Regras e valores das tentativas de login e de CPFs informados
2026-11-18 · ativa · Muda: RN-ID-04, RN-ID-07
**Login** (app pelo CPF, painel pelo login do município; o login por e-mail fica fechado nos dois): 5 senhas erradas seguidas do mesmo par (login, IP) bloqueiam o par por 15 min inteiros (AD-064). Não há janela: só acertar zera, e espaçar os erros não escapa (até 7 dias sem tentativa, AD-063). Só senha errada conta; corpo inválido e login ou senha vazios, não. A tentativa é reservada antes de conferir a senha: pedidos em paralelo não passam do limite e ouvem "espere alguns segundos"; cada pedido solta a própria reserva, que vence em 1 min se o pedido cair. Teto por login: 30 senhas erradas por hora, somando os IPs; passado o teto, o login pede captcha (AD-062), e acertar não zera o teto; quem erra depois de resolver o captcha também conta (a janela segue cheia enquanto o ataque continua), e um token que a Cloudflare recusa conta como erro no par (com a Cloudflare sem responder, não conta). Sem IP no pedido, esses pedidos dividem um par. **Inscrição:** 20 CPFs de outras pessoas por conta por hora, em janela deslizante (a resposta diz se o CPF tem conta). **Os valores são de partida** (5, 15 min, 30 por hora, 20 por hora), sem medição com uso real; reajustar com o piloto se for preciso. **Por quê:** decisão sua, 2026-11-18 ("siga a convenção base e depois reajustamos se necessário"); era a NC5 das decisões para revisar. Discoveries: [armazenamento](features/mvp-filas/discovery-tentativas-armazenamento.md), [captcha](features/mvp-filas/discovery-captcha.md), [IP](features/mvp-filas/discovery-bloqueio-por-ip.md).

### AD-066 · Docs públicas com Fumadocs no site, referência gerada do OpenAPI
2026-11-18 · ativa
As docs ficam no `apps/web`, em `/docs`, com o Fumadocs (o mesmo Next 16 + Tailwind do site). São guias em MDX, em português, para quem integra, e a referência de cada rota da API, gerada dos `apps/api/openapi/v{n}.json`, um por versão (`npm run docs:openapi`), que sai das próprias rotas. A referência cobre toda a `/v1` menos as rotas de teste e as do better-auth (o login entra nos guias), agrupada por quem usa: Município, Paciente, Painel, TV e Sistema. Caminhos e campos ficam em inglês, como no código. **Por quê:** decisão sua, 2026-11-18 (DOC1, DOC4 e DOC5 do [plano das docs](arquivo/planos/docs-api/plan.md)): mesma pilha do site, sem serviço pago, e a referência não fica para trás do código.

### AD-067 · Schemas Zod declarados nas rotas do Fastify
2026-11-18 · ativa
Cada rota declara os schemas de `packages/schemas` no próprio Fastify (`params`, `querystring`, `body`, `response`). O Fastify valida a entrada antes do handler, com o mesmo erro `invalid_input` com campos de antes; id malformado no caminho é 404. A resposta passa pelo schema (fora dele é 500 com log). O município e o login do painel são conferidos antes do schema, no `preValidation`. Um teste falha se uma rota da `/v1` ficar sem schema, e outro se o `v1.json` no git ficar para trás das rotas. **Por quê:** decisão sua, 2026-11-18 (DOC2 do [plano das docs](arquivo/planos/docs-api/plan.md)), entre declarar no Fastify, manter um catálogo à parte ou exportar a descrição de cada rota: o schema que valida é o que documenta, sem lista para manter.

### AD-068 · Versões da API: o que quebra vai para uma nova, a anterior fica 6 meses
2026-11-18 · ativa
A versão é um número no começo do caminho (`/v1`, `/v2`… `/v{n}`), sem nenhuma versão tratada como fixa. Mudança que só acrescenta (rota nova, campo novo na resposta, campo opcional no corpo) fica na versão atual. Mudança que quebra vai para a próxima (`/v{n+1}`), lançada junto com o app que já a usa. A anterior continua no ar por 6 meses depois disso, com os cabeçalhos `Deprecation` e `Sunset`. Como cada versão vira um documento e uma referência está na DA9 das [decisões para revisar](features/mvp-filas/decisoes-para-revisar.md). **Por quê:** decisão sua, 2026-11-18 (DOC3 do [plano das docs](arquivo/planos/docs-api/plan.md)): o app antigo continua no celular de quem não atualizou, e a mudança no app sai junto com a da API, então os 6 meses contam do lançamento. "v1 e v2 não são fixas, as vezes podemos estar na v5" (2026-11-18).

### AD-069 · Domínios de produção: `api.filasaude.com.br` e `<município>.filasaude.com.br`
2026-11-18 · ativa
O app do paciente fala com a API em `https://api.filasaude.com.br` (o município no caminho); o painel e a TV, em `https://<município>.filasaude.com.br` (o município no subdomínio). A homologação segue o mesmo desenho em `https://api.homolog.filasaude.com.br` e `https://<município>.homolog.filasaude.com.br`. As docs mostram os endereços de produção, os locais em dev e os de homologação no build dela (`DOCS_API_URL` e `DOCS_PANEL_URL`), sem endereço fixo nos guias (`{{API_URL}}` e `{{PANEL_URL}}`); a referência da API lista os três ambientes. **Por quê:** decisão sua, 2026-11-18 ("exatamente isso"), ao ver que as docs mostravam `localhost` fixo; a homologação, "pode seguir com esses endereços de homolog". Substitui a DA7 das decisões para revisar.

### AD-070 · Decisões do alinhamento de 2026-11-19
2026-11-19 · ativa · Muda: — (o código já segue)
Aprovadas como estavam em decisoes-para-revisar: (1) **CA1:** e-mail obrigatório no cadastro. (2) **F1:** idoso (60+ e 80+) não gera pendência de prioridade no check-in; a idade vem da identidade conferida. (3) **S5:** prioridade declarada no balcão vale na hora, conferida pela recepção. (4) **RV1:** CPF já cadastrado só é aceito com a mesma data de nascimento ("outra pessoa": também o mesmo primeiro nome, sem acento); senão `409 person_mismatch`, sem dizer o que diverge. (5) **RV2:** até 5 inscrições ativas por conta em cada sessão. (6) **PD-21:** senha com no mínimo 8 caracteres; 5 erros seguidos bloqueiam por 15 min (hoje pelo par login e IP, AD-064 e AD-065). (7) **G7:** envio de push dentro do processo da API, a cada 60 s; vira processo próprio antes do piloto. (8) **I3:** vínculo e pré-cadastro não exigidos na lista de espera até a fatia 5. **Por quê:** decisões suas, 2026-11-19 ("ok").

### AD-071 · `google-services.json` fora do git; no EAS, variável de arquivo
2026-11-20 · ativa · Muda: G6
O projeto EAS fica na organização `fila-saude` (pacote `br.com.filasaude.app`). O `apps/mobile/google-services.json` não vai para o git: cada dev usa o do seu Firebase; o EAS Build lê o arquivo da variável secreta `GOOGLE_SERVICES_JSON` (`app.config.ts`, com o arquivo local como alternativa). A chave da conta de serviço do Firebase (`*-firebase-adminsdk-*.json`) vai só para as credenciais do EAS. **Por quê:** decisão sua, 2026-11-20 ("faz mais sentido cada um inicializar seu próprio firebase"), num repositório público. A doc da Expo diz que o arquivo pode ir para o git (só tem identificadores públicos); fica fora mesmo assim.

### AD-072 · Rechamar também manda push
2026-11-20 · ativa · Muda: G5, tv-e-avisos
Cada rechamada vira um aviso "chamando você de novo! senha X", com a sala e a unidade, como o "sua vez". **Por quê:** você, 2026-11-20, testando no celular: "quando chamo novamente, não notifica". O G5 tinha deixado a rechamada de fora porque a TV e a tela já mostram, mas quem espera em casa ou longe da TV só fica sabendo pelo push. Sem limite: cada toque em "rechamar" é um aviso, como cada chamada na TV.

### AD-073 · Push no Android: sempre o coração azul, sem imagem grande
2026-11-23 · ativa · Muda: G13
Todo aviso de push no Android leva só o símbolo do coração com a cruz (o do painel), como ícone pequeno (`assets/notification-icon.png`, branco) pintado com o azul `#1a6fd1` (`color` do plugin `expo-notifications`). Sem imagem grande (`largeIcon`). **Por quê:** você, 2026-11-23: "use sempre o símbolo do coração azul" e "precisa estar em todas notificações push". Com título e texto, a Expo manda uma mensagem de notificação do FCM: com o app fechado ou em segundo plano quem mostra é o Android, que usa o ícone pequeno do manifesto e ignora a imagem grande; ela só aparecia com o app aberto. A proposta com o Dr. Lino como imagem grande foi recusada. Avisos só de dados, com uma tarefa em segundo plano montando cada aviso, ficam de fora: mais código, e o Android pode atrasar no modo soneca.

### AD-074 · Push sai na hora do evento; chamada que perdeu a hora não sai
2026-11-23 · ativa · Muda: AD-070 (G7), G14
O aviso continua gravado na outbox, na mesma transação do evento (PD-49). Logo depois da resposta de cada escrita com município (mesmo com erro na resposta), a API envia os pendentes dele, sem segurar a resposta (`sendAfterWrites`, hook `onResponse`); pedidos durante um envio do mesmo município viram uma rodada a mais. A varredura de 60 s (G7) fica para as novas tentativas e os avisos do tempo ("saia de casa", "venha agora"). No envio, olhando o histórico da entrada no banco, não sai a chamada ("sua vez" ou rechamada) seguida de um "pulado" nem a seguida de uma chamada que ainda vale (enviada ou pendente); fica como `stale`. Com o envio na hora, chamada e rechamada saem cada uma no seu momento; só as atrasadas juntas (a Expo caiu, envio que falhou) viram uma, a última. A chamada só sai enquanto a fila do dia espera a pessoa entrar na sala daquela chamada (`awaitedItems`: item `called` sem o "Compareceu"); atendida, pulada, já na sala ou chamada em outra etapa, fica como `stale`. "Saia de casa" e "venha agora" só saem enquanto a pessoa espera em casa na mesma etapa (`remoteItems`). Sessão fechada ou cancelada não espera ninguém. "Saia de casa" e um "venha agora" antigo não saem depois de um "venha agora" da mesma etapa que ainda vale, nem um "pulado" depois de uma chamada mais nova (em qualquer estado). Erro no envio sempre conta como tentativa: antes da chamada à Expo, com a mesma espera crescente; depois dela, a reserva de 5 min vence sozinha e, esgotadas as tentativas, o aviso fica `unconfirmed` (pode ter chegado), não `failed`. A Expo tem 10 s para responder e mais 10 s para o corpo; com o 200 e o corpo travado, o lote conta como enviado (nada sai duas vezes); corpo lido sem os recibos é falha. O resultado de cada aviso é gravado logo depois da Expo, antes de apagar os aparelhos recusados. O envio na hora e a varredura seguem enquanto o lote vier cheio (100). A ordem dos avisos é a de gravação (`notice.seq`), não `created_at`, que empata na mesma transação. O estado é lido fora da trava da sessão: uma mudança entre a leitura e o envio ainda deixa sair um aviso. **Pedido seu**, 2026-11-23 ("pq nn corrigiu a questao da fila?"): a nova tentativa de uma chamada não sai para quem já foi atendido. No desligamento, a API espera os envios em andamento e não começa outros. **Por quê:** você, 2026-11-23 ("faz o envio na hora do evento"): com a varredura, o "é a sua vez!" chegava até 60 s depois, e os avisos do mesmo minuto chegavam juntos e fora de ordem. Substitui a G14.

### AD-075 · 80+ antes dos demais idosos, sem hierarquia entre grupos (vagas dos idosos)
2026-11-23 · ativa · Muda: RV7, RN-ORD (fila-do-dia), lista-espera (ordem da sugestão)
Segue a lei: entre as pessoas idosas, os maiores de 80 anos vêm antes (Lei 10.741/2003, art. 3º, § 2º, incluído pela Lei 13.466/2017); entre os grupos da Lei 10.048/2000 não há hierarquia. Antes o código punha o 80+ antes de todos os grupos. Comparando duas pessoas de cada vez as duas regras formam um ciclo (80+ antes de 60–79, os dois empatados com uma gestante), então a regra vale na fila inteira (`orderItems`, `orderSuggestions`): já em ordem, dentro de cada bloco de quem tem prioridade com a mesma urgência e o mesmo risco, as vagas ocupadas por idosos vão primeiro aos 80+, cada grupo na ordem da senha (ou da data, na lista de espera); os outros grupos ficam no lugar da senha, inclusive o idoso de 60-79 que também é de outro grupo (aprovado por você em 2026-11-24); o 80+ de outro grupo continua com a vaga de idoso. O 80+ já chamado na etapa segue com a vaga que ocupou, pela chave da hora da chamada (a triagem pode mudar o risco e o número dele depois): o idoso de 60-79 que ele passou fica com o lugar dele, e a ordem não muda depois de cada chamada. Se ele volta a esperar na etapa (pulo, "Vou sair"), deixa de guardar a vaga e ocupa uma só pelo lugar de agora. O 80+ que a janela protegida trava atrás de um idoso de 60-79 não tira a vaga dele (as vagas se repartem entre quem já pode ser chamado). As vagas valem na ordem de chamada da estação, na sugestão de alocação e na posição de quem está em casa (estimativa, "saia de casa" e "venha agora"), para o 80+ em casa ser avisado na hora certa (você, 2026-11-24). Como as vagas só trocam idosos entre si, a posição dos outros grupos e de quem não tem prioridade não muda; a do idoso de 60-79 pode piorar quando entra um 80+, como já piora a de quem não tem prioridade quando entra alguém com prioridade. Chamar outra pessoa não tira a vez de ninguém (AD-076), então as vagas não entram na perda de vez. **Por quê:** você, 2026-11-19 ("o que a lei mandar") e 2026-11-23 ("é só seguir o que está previsto em lei"). Confirmar a leitura com o advogado (D5).

### AD-076 · Perde a vez só quem não chega no prazo; 2 pulos tiram da fila
2026-11-24 · ativa · Muda: AD-010, AD-057, RN-ORD (atraso), RN-ETA-06, RN-CHAM-03, RN-SES-02, RN-FALTA-01, RN-FALTA-02, RN-CONT-03
Chamar outra pessoa não tira a vez de ninguém. O remoto perde a vez só quando recebe o "venha agora" e não chega no prazo de chegada (padrão 30 min, antes 15; config da unidade); o aviso diz o prazo, e quando o prazo acaba ele recebe uma vez o push "você perdeu a vez". Ao chegar depois, vai para o fim. Quem chega no prazo mantém o lugar, sejam quais forem as chamadas feitas nesse tempo, mas a vez não é intocável: urgências e prioridades que chegam passam à frente pela ordem de sempre. O relógio do prazo para durante um período de contingência registrado (uma queda de 10 min estende o prazo em 10 min). "Não compareceu": no 1º, a vez fica guardada: volta atrás dos próximos K e é chamado de novo (como antes); no 2º do dia, somando as etapas, sai da fila com falta, anulável pela recepção (AD-021), também com urgência confirmada (antes o 2º voltava a remoto e só o 3º tirava da fila). Falta no encerramento: quem perdeu o prazo e não foi atendido no dia; perdeu o prazo e foi atendido depois não é falta. Sem "venha agora" (modo manual, varredura fora do ar) não há prazo: quem não vem é remanejado sem falta. A urgência confirmada não perde a vez pelo prazo, mas, se não chegar até o encerramento, leva falta como os outros (você, 2026-11-24, PV6 e PV7). O push "perdeu a vez" sai mesmo durante uma queda ainda não registrada; a correção aprovada é o sistema perceber a queda sozinho (sem sinal da TV e das estações, RN-SES-05, ou com a varredura parada) e parar o relógio do prazo, (você, 2026-11-24, PV5). A queda percebida: só depois do primeiro sinal da unidade na sessão; com TV pareada (que já deu sinal na sessão), só a TV conta e 2 min sem ela é queda; sem TV, contam as estações, com 10 min de silêncio, porque o navegador pode congelar a aba da estação em segundo plano (você, 2026-11-24, opção 2 da revisão da #37); com o sinal parado e a queda ainda não confirmada, o atraso de quem está a caminho espera (não vai para o fim nem recebe "perdeu a vez"); o sinal parado é julgado pela folga da fonte no giro (TV 45 s, estações 100 s), pela folga mais um giro na hora da ação, ou pela varredura parada há mais de 2 min, sem consultar o sinal ao vivo: um sinal que volta só conta no giro seguinte, e com TV quem perde o prazo nos primeiros ~105 s de uma queda vai para o fim, anulável pela recepção (você, 2026-11-24, QP7); a queda vai do último sinal até o giro da varredura que vê o sinal de volta (ou até ninguém mais chamar); o servidor reiniciado depois de mais de 3 min fora do ar também é queda, até o primeiro giro depois da volta; em modo manual nenhum aviso de tempo sai e o app manda procurar a recepção, sem esconder o check-in (você, 2026-11-24, QP1 a QP5). **Por quê:** você, 2026-11-24 ("se uma gestante for chamada, isso nao pode fazer com que a Bia perca a vez. A Bia só pode perder a vez se nao chegar a unidade no prazo estimado ou se for chamada diversas vezes e nn comparecer"; "Esse prazo precisa ser relativamente longo"; "chama a primeira vez, se nao compareceu, atende o próximo e ela fica com a vez guardada, portanto, vai ser chamada novamente (segunda vez), se nao compareceu, é dada falta, pode sair da fila"; "se nao foi das 2 vezes, tira da fila"; push no fim do prazo: "manda o push"). Com a regra antiga, perder a vez dependia de comparar a pessoa com quem foi chamado, o que as vagas dos idosos (AD-075) tornavam ambíguo.

### AD-077 · Pausa avisada, fechar a estação e horário em faixas
2026-11-24 · ativa · Muda: RN-EST-05, RN-EST-06, RN-EST-07, RN-SES-05, RN-SES-06, RN-ETA-06
A pausa nunca pega ninguém a caminho: ou é planejada (o horário da sessão é um conjunto de faixas, e o vão entre elas é a pausa de todas as estações), ou é avisada na hora e só começa depois do prazo de chegada da unidade. A pausa é por estação; a fila da etapa só para quando todas estão em pausa. A volta é opcional, e o app mostra "pausa, volta às 13:00". Fechar é a estação deixar de atender na sessão (o médico foi embora); pode reabrir. Estação em pausa ou fechada não conta como queda (QP6 da AD-076). Detalhes aprovados (você, 2026-11-24): a volta em minutos conta do início da pausa; com pausa marcada ou em curso, pausar de novo é recusado (volte ou desmarque antes); a estimativa soma todas as pausas no caminho da espera; a estação em pausa com volta conta na capacidade da fila, e a que para sem volta antes da vez, não; com a unidade sem sinal não pausa, e uma queda que começa depois de marcada a pausa pode fazer quem vem chegar e esperar a volta (PA1, PA3, PA4); na hora da pausa (PR própria, depois desta), quem estava a caminho e chegou sem ser chamado: o profissional escolhe atender antes (a pausa e a volta andam) ou pausar agora, e a pessoa recebe uma justificativa por escrito e continua na frente da fila ("o médico sabe se aquela pessoa realmente tem urgência; se não, cabe a pessoa entender, quem está do outro lado também é humano e precisa de uma pausa", opção C); quem está a caminho não vê a pausa do consultório no tempo, só o intervalo da sessão (PA6); a urgência confirmada que passou do prazo sem chegar não segura a pausa (PA5; o limite de 2 "venha agora" para ela vem numa PR própria); quem já recebeu "venha agora" continua com ele, e o "venha agora" só sai até a hora que não sobreponha a pausa; sem hora de volta, o app não mostra tempo, não manda "saia de casa" e diz "pausa por tempo indeterminado"; depois de uma pausa (ou de "voltar agora" e reabrir), o silêncio da queda percebida conta da volta; desmarcar uma pausa que não começou não muda essa conta; em pausa, "finalizar e chamar o próximo" só finaliza.  **Por quê:** você, 2026-11-24 ("não é pra ter uma pausa se tem gente a caminho, portanto, deve-se sinalizar um intervalo de pausa NA CRIACAO da sessao. Ou sinalizar a pausa pra daqui a 30min"; "o horário de funcionamento deve ser um conjunto de intervalos"; "fechar e pausar tem diferencas").

## Arquitetura

As decisões PD-01..PD-13 estão na tabela de decisões do [plan](features/mvp-filas/plan.md#1-decisões-de-arquitetura), com o porquê de cada uma. Todas ativas.

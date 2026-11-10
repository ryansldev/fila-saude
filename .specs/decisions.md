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
| AD-010 | Atraso pela ordem real | ativa |
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
| AD-021 | 3º pulo sempre gera falta, anulável | ativa |
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
| PD-01..PD-13 | Arquitetura do MVP | ativas (ver [plan](features/mvp-filas/plan.md)) |

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
2026-11-04 · ativa · Muda: RN-ORD (atraso), RN-FALTA-01
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

### AD-021 · 3º pulo sempre gera falta, anulável
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
No encerramento, quem já foi atendido numa etapa não leva falta; 3 pulos seguem valendo.

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
Specs por capacidade com só a verdade atual, regras "QUANDO … O SISTEMA DEVE …" com cenários, este registro curto de decisões, `changes/` para mudança grande, núcleo executável na fase 1 e checagem automática. Discovery: [estrutura](discovery-estrutura-specs.md).

### AD-052 · Licença AGPL-3.0 e receita por município
2026-11-10 · ativa · Muda: constituição (produto)
O código passa de MIT para **AGPL-3.0** daqui em diante (o já publicado segue MIT). A receita é mensal por município: **hospedagem completa** (VPS do município, central e app; mínimo R$ 1.500) ou **taxa de conexão** à central e ao app para quem roda o backend por conta própria (valor no D7). Quem quiser operar sem a central e sem o app precisa de outro app com outro nome; a quem fizer isso, vende-se licença comercial. Pendências: CLA para contribuições e revisão do advogado (D5/D7). **Por quê:** código aberto para portfólio e comunidade, sem permitir fork fechado; o que gera receita (central, app publicado, marca e operação) não se copia do repositório. Discovery: [preço](features/mvp-filas/discovery-preco.md).

### AD-053 · Pré-cadastro com foto ligado por padrão
2026-11-10 · ativa · Muda: configuração da unidade (specs/modelo), RN-PRE-01
Toda unidade começa exigindo o pré-cadastro (foto do documento com foto e do Cartão SUS); o município pode desligar por unidade. Para a adesão de quem tem dificuldade com o celular, a implantação inclui uma **campanha de cadastro**: sessões públicas na unidade em que a recepção faz o pré-cadastro no balcão (RN-PRE-06). **Por quê:** conferência mais rápida e segura (foto × rosto × documento) e dados prontos na primeira ida; o atrito para o público de 60+ é compensado pela campanha. Plantão e sessões com dispensa seguem dispensando (RN-PUB-04).

### AD-054 · Conferência antes de entrar na fila presencial
2026-11-10 · ativa · Muda: RN-FILA-05, RN-ID-05, RN-PRE-03, RN-LE-06, RN-RISCO-03, RN-RISCO-04, permissões · Substitui: AD-050
Com pendência, o check-in pelo QR é **recusado** ("passe na recepção"); a pessoa segue remota, com o lugar que tinha. A recepção confere e **marca a presença na mesma ação**; a regra de atraso conta a partir dela. O app avisa antes da chegada para passar na recepção primeiro. O profissional só chama e atende; a estação não confere nada. Prioridade nova declarada por quem já está presente só vale depois de conferida. **Por quê:** na rotina real quem está na sala controla a fila e não confere documento; tira o estado "presente com pendência" e a conferência na estação; a brecha de "congelar" o lugar continua fechada (quem nunca entrou presencialmente não tem lugar presencial). Custo: num balcão lento, quem leu o QR antes de passar na recepção pode ser ultrapassado; acontece uma vez por pessoa e a campanha de cadastro (AD-053) reduz.

## Arquitetura

As decisões PD-01..PD-13 estão na tabela de decisões do [plan](features/mvp-filas/plan.md#1-decisões-de-arquitetura), com o porquê de cada uma. Todas ativas.

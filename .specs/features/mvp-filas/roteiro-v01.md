# Roteiro da v0.1

Como rodar a v0.1 local e apresentá-la, tela a tela. Cada fatia acrescenta o seu trecho.

## Preparar

```bash
npm install
npm run dev:seed      # apaga e recria o município "exemplo"; imprime logins e sessões
npm run dev           # API em :3333, painel em http://exemplo.localhost:3000
npm run dev:mobile    # app no celular (Expo Go); IP da API em apps/mobile/.env (copie de .env.example)
```

Senha de todos: `exemplo123`. O seed cria a sessão pública **Curativos** começando na hora cheia de agora (4 h), na "Sala de procedimentos", com Ana e Bruno já inscritos, e a **Clínico geral (com triagem)** no mesmo horário, na "Triagem 1" e no "Consultório 1", com Ana (rotina), Bruno (urgente) e Carla (atenção) inscritos.

## Fatia 1 — Pública básica

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Paciente | App | Entrar com a Carla (CPF `39053344705`) ou criar conta; escolher "Município Exemplo" | Tela "Olá, Carla" com a Odontologia aguardando |
| 2 | Paciente | App → Agenda | Tocar em "Curativos", "Para mim", responder (problema novo, leve; gestante) | Aviso de que a prioridade é conferida; a gaveta "só um instante" (captcha, AD-062) se resolve sozinha; inscrição confirmada |
| 3 | Paciente | App | Marcar um sinal de alarme numa nova tentativa | Tela "Procure atendimento agora" com o botão 192; não entra na fila |
| 4 | Gerente | Painel → Fila do dia | Entrar como `gerente`, escolher a sessão de Curativos, "Abrir sessão" | Senhas V-001.. remotas; no app, a senha e "Venha agora"/posição |
| 5 | Recepção | Painel → QR de entrada | Entrar como `recepcao` e deixar a tela do QR aberta no monitor | QR que muda a cada 30 s |
| 6 | Paciente | Câmera do celular ou app → "Cheguei" | Ler o QR | 1ª ida (conta não verificada): "passe na recepção para confirmar seus documentos" |
| 7 | Recepção | Painel → Fila do dia | "Conferir documentos e marcar presença" em quem aparece com pendência | "Na unidade"; a conta fica verificada e nas próximas idas o QR basta |
| 8 | Enfermeira | Painel → Estação | Entrar como `enfermeira`, escolher "Sala de procedimentos", "Chamar próximo" | Senha e nome grandes, cronômetro; no app, "É a sua vez! Vá para Sala de procedimentos" |
| 9 | Enfermeira | Estação | Rechamar, Finalizar, Chamar próximo, Não compareceu | Pulado volta à fila; sem ninguém, "Ninguém aguardando na unidade" |
| 10 | Gerente | Fila do dia | "Encerrar sessão" | Atendidos ficam; quem não foi chamado vira remanejado; no app, "Sua vez não chegou hoje" |

**Executado em 2026-11-12** por HTTP (script com as mesmas rotas do app e do painel): passos 1, 2, 4–10 conferidos (QR lido pelo link que a tela gera). Falta o clique no navegador e no celular (Expo Go); o app foi empacotado com `expo export` e passou no `expo-doctor`.

## Fatia 2 — Na unidade

Para o push chegar no celular é preciso um projeto EAS e um build de desenvolvimento (ver G6 em [decisoes-para-revisar](decisoes-para-revisar.md#fatia-2-da-v01-2026-11-13)); sem isso, o resto da fatia funciona e o aviso fica registrado como `sem_dispositivo`.

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | TV | Navegador da TV (ou outra aba) | Abrir `http://exemplo.localhost:3000/tv` | Fundo azul com um código de 6 dígitos |
| 2 | Gerente | Painel → TVs | Escolher a UBS Centro, digitar o código, "Parear" | A TV troca para "iniciar painel"; no painel, a TV aparece "online" |
| 3 | TV | /tv | Tocar "iniciar painel" | Tela da sala de espera: "atendimento ainda não começou" até abrir a sessão |
| 4 | Gerente | Painel → Fila do dia | Abrir a sessão de Curativos | A TV mostra "curativos · N aguardando · +M a caminho" e o QR de entrada |
| 5 | Paciente | Câmera do celular | Ler o QR da TV | O mesmo check-in da fatia 1 |
| 6 | Enfermeira | Painel → Estação | "Chamar próximo" duas vezes seguidas (ou chamar e rechamar) | A TV toca dois tons e mostra cada senha em destaque por 10 s, uma depois da outra; depois descem para "últimas chamadas"; nunca aparece nome |
| 7 | Paciente | App → Minha fila | Presente na unidade, tocar "vou sair um pouco" | Volta a "pode esperar em casa" com a mesma posição; ao voltar, lê o QR de novo |
| 8 | Paciente | Celular (push) | Esperar a vez | "hora de sair de casa", "venha agora", "é a sua vez! senha V-001" e, se pulado, "chamamos a senha… e você não apareceu" |
| 9 | Gerente | Painel → TVs | "Revogar" | A TV volta para um código novo |

**Executado em 2026-11-13** por HTTP contra `npm run dev` (mesmas rotas do painel e da TV): passos 1–4 e 6 conferidos, com a rechamada anunciada de novo e sem nomes na tela; a varredura gravou o "sua vez" e marcou `sem_dispositivo`. `next build` do painel ok com `/tv` e `/tvs`. Falta o clique no navegador (som e fila de anúncios) e o push num celular com build de desenvolvimento.

## Acabamento do app (revisão de design de 2026-11-14)

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Paciente | App, conta nova num celular que nunca deu a permissão | Criar conta | Tela "a gente te avisa a hora de sair de casa" antes do pedido do celular; "agora não" segue sem pedir |
| 2 | Paciente | App → Minha fila | Com os avisos negados ou pulados | Faixa "os avisos estão desligados" com "ligar os avisos" (ou "abrir os ajustes", se o celular não pergunta mais) |
| 3 | Paciente | App → Minha fila | Inscrito em Curativos, tocar "não vou poder ir" | Gaveta de baixo: "você perde esta vaga"; ao confirmar, a entrada some e, no painel, fica como "saiu da fila"; o 1º da reserva entra |
| 4 | Paciente | App → Unidades | Tocar em qualquer parte do cartão do atendimento | Abre "para quem é?" com o Dr. Lino e o atendimento em pílulas; não há mais um botão azul por cartão |
| 4b | Paciente | App → "para quem é?" | "para outra pessoa" | Nome, nascimento e CPF, uma tela cada, com o selo "dados de quem vai ser atendido"; depois "qual a sua relação com Ana?" e a declaração (sem as duas, não segue); "agora umas perguntinhas rápidas"; nas perguntas, "nenhum destes" primeiro; no fim, o Dr. Lino: "prontinho! a vaga de Ana está garantida." |
| 4c | Recepção | Painel → Fila do dia | Olhar a linha de quem foi inscrito por outra conta | A pílula "por Bruno (responsável legal)" |
| 5 | Paciente | App, modo avião | Abrir minha fila, unidades ou municípios | Faixa "sem internet" com "tentar de novo"; ao abrir, logo e roda girando em vez de tela branca |
| 6 | Paciente | App → Entrar e Criar conta (iPhone) | Tocar no último campo | O teclado não cobre o campo nem o botão |

**Ainda não executado.** Conferido por código: `tsc`, lint, testes do app e da API (rota de cancelar), `expo export` para Android e iOS e `expo-doctor`. Falta rodar no celular.

## Fatia 3 — Triagem

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Gerente | Painel → Fila do dia | Abrir a sessão "Clínico geral" | Senhas C-001.. remotas |
| 2 | Recepção | Painel → Fila do dia | Conferir e marcar presença de Ana, Bruno e Carla | "Na unidade"; no app, "primeiro, a triagem" |
| 3 | Enfermeira | Painel → Estação | Escolher "Triagem 1 · Triagem", "Chamar próximo" | Bruno (urgente sugerido) vem primeiro; abaixo, "Sugerido pelo app: Amarelo · Problema novo forte", a prioridade declarada e as cinco cores do Manchester com o tempo-alvo; "Finalizar" e "Chamar próximo" ficam bloqueados até escolher |
| 4 | Enfermeira | Estação de triagem | Tocar "Verde" e "Chamar próximo" | Bruno vai para a fila do atendimento com a mesma senha; no app dele, "triagem feita. agora, o atendimento" |
| 5 | Enfermeira | Estação de triagem | Com Carla chamada, tocar "Vermelho" e "Finalizar" | Faixa explicando que vermelho vai ao 1º lugar do atendimento; Carla passa à frente de todos na fila do Consultório 1 |
| 5b | Enfermeira | Estação de triagem | Com outra pessoa chamada, "Vermelho" e "Encaminhar à emergência" | Pede confirmação; a pessoa sai da fila; no app, selo "emergência" e "a enfermagem encaminhou você para a emergência" |
| 6 | Médica | Painel → Estação | Entrar como `medica` (ou a enfermeira), "Consultório 1 · Atendimento", "Chamar próximo" | Só quem já passou pela triagem é chamado; sem cores nesta tela |
| 7 | Paciente | App → Minha fila | Presente, tocar "meus sintomas pioraram" | Faixa vermelha: avisar a recepção ou a enfermagem, e o botão "ligar 192" |

**Ainda não executado** no navegador nem no celular. Conferido por teste de integração (`tests/integration/v1/panel/stations/triage.test.ts`: passos 3–6 pelas mesmas rotas) e pelos testes do painel e do app.

## Tela da fila no app (2026-11-14)

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Paciente | App → Hoje ou Atendimentos | Tocar no cartão de "Curativos" (Bruno) | Tela da fila: senha bem grande, "1º na fila" e o tempo, o próximo passo e "seu caminho hoje" (inscrição → em casa → na unidade → atendimento), com a etapa de agora em destaque |
| 2 | Paciente | Tela da fila, num serviço com triagem | Antes e depois da triagem | A triagem aparece na linha do tempo; depois dela, "atendimento · agora" |
| 3 | Enfermeira | Painel → Estação | Chamar o Bruno | Com a tela da fila aberta, ela vira a tela verde "é a sua vez!" com a sala |

**Conferido** pela prévia web (Chrome headless, com CORS desligado só para o teste): passo 1 e o toque no cartão de "hoje" levando à tela. Falta no celular.

## Fatia 4 — Privada (lista de espera, alocação e confirmação)

O seed põe Ana, Bruno, Carla (urgente sugerida) e José (sem app) na lista da **Odontologia**, com duas sessões privadas: amanhã às 13h e daqui a 3 dias às 13h. Na segunda, Bruno foi alocado há 30 h e não respondeu.

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Paciente | App → Unidades → UBS Centro | Rolar até "lista de espera" | Os serviços da unidade; Odontologia com o selo "na lista" para quem já está; tocar em outro serviço abre "para quem" e o questionário, e no fim "você está na lista de espera!" |
| 2 | Recepção (agenda) | Painel → Agendamento | Abrir a tela | Menu "Agendamento" com o contador "1"; no topo, os serviços (Odontologia com "1 alerta"), a faixa "1 pessoa para ligar · Bruno Lima sem resposta há 30 h" e, à esquerda, as duas sessões privadas com as barrinhas de vagas |
| 3 | Recepção | Agendamento → Sugestão | Ler a sugestão | Carla no topo, em amarelo, com o selo "Urgente (app)" e "Problema novo forte · gestante · espera há N dias"; só ela com o "Alocar" principal; depois Ana (pessoa idosa) e José ("sem app") |
| 4 | Recepção | Sugestão | "Alocar" Ana | Ana nas vagas da sessão com "Aguardando resposta", o prazo e as respostas; a barrinha fica amarela e o contador do menu sobe; no app dela, "confirme até …" com "vou, confirmar" e "não posso nesta data" (e o push "confirme sua consulta", com o projeto EAS) |
| 5 | Paciente (Ana) | App → cartão da Odontologia | "vou, confirmar" | Selo "inscrito"; no painel, "Confirmou" |
| 6 | Recepção | Faixa do topo → "Ver lista de ligação" | Ver Bruno no painel lateral | Linha destacada "Sem resposta: ligar", com o telefone; "Sem contato" anota a tentativa e mantém pendente |
| 7 | Paciente (Bruno) | App → cartão | "não posso nesta data" e confirmar | "você continua na lista"; no painel, a vaga fica livre e Bruno não é sugerido de novo para essa data |
| 8 | Dois agendadores | Agendamento, mesma sessão com uma vaga | "Alocar" ao mesmo tempo | Um aloca; o outro vê "A sessão não tem mais vaga. A lista foi atualizada." e a lista nova |
| 9 | Paciente | App → cartão de quem está na lista | "minha situação mudou: responder de novo" | O questionário sem "para quem"; urgente sobe a pessoa e acende o alerta do agendador |

**Tela de Agendamento refeita no design system (2026-11-16, caminho A).** **Executado por HTTP** (2026-11-16, de novo depois do design system, script contra `npm run dev` com o seed): passos 1–7 pelas mesmas rotas; o passo 8 é coberto pelo teste com dois escritores (`tests/integration/v1/panel/scheduling/scheduling.test.ts`). A página `/agendamento` responde no Next. **Falta** o clique no navegador e no celular.

## Fila do dia refeita (design system, 2026-11-16)

[Design](../design-system/fila-do-dia.md): a unidade inteira numa fila só, com busca e pílulas por serviço.

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Gerente | Painel → Fila do dia | Abrir a tela antes das sessões | Pílulas "Curativos · abre às HH:MM" e "Clínico geral · abre às HH:MM"; "A fila abre às HH:MM. Inscritos até agora: 5. Escolha o serviço acima para abrir a sessão." |
| 2 | Gerente | Pílula "Clínico geral" | "Abrir sessão" na faixa da sessão (e o mesmo em Curativos) | A faixa só aparece com um serviço escolhido; em "Todas", a recepção não vê abrir nem encerrar |
| 3 | Recepção | Fila do dia, em "Todas" | Olhar a fila | As pessoas das duas sessões juntas, em grupos com ícone e contagem (chamado agora, na unidade, a caminho); cada linha com o serviço, a situação e há quanto tempo |
| 4 | Recepção | Busca | Digitar "c002", depois o CPF inteiro de alguém | Fica só a pessoa da senha C-002; com o CPF, a pessoa (os 6 dígitos do meio batem com o mascarado) |
| 5 | Recepção | Linha "a caminho" | "Marcar presença" | A pessoa passa a "Na unidade" com "esperando a triagem · agora" |

**Conferido** por teste (domínio, rota `fila-de-hoje`, funções da busca e da linha, `Filtros` e `Busca`) e por prints no Chrome (1440 e 1024 px, estado antes de abrir, cenário com as duas sessões abertas, busca). **Falta** o clique no navegador.

## QR de entrada e unidade no menu (design system, 2026-11-16)

[Design](../design-system/qr-e-unidade.md).

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Recepção | Painel → QR de entrada | Abrir a tela com uma sessão aberta | O QR (pontos pretos, coração azul) com a barrinha de troca, as sessões abertas e o Dr. Lino explicando a quem atende, em 4 passos, como o QR funciona |
| 2 | Recepção | QR de entrada | "Abrir para o paciente (tela cheia)" | Abre `/qr-paciente` numa aba nova: QR grande, o Dr. Lino falando com o paciente e os 3 passos; arraste a aba para o monitor do balcão |
| 3 | Paciente | Monitor do balcão | Ler o QR com o celular | A pessoa passa a "na unidade" na Fila do dia |
| 4 | Gestor | Menu → cartão da unidade | Tocar no cartão | "Em qual unidade você está?": as 4 unidades com endereço, CEP, tipo, CNES e o que acontece hoje; escolher troca o painel inteiro |
| 5 | Recepção | Menu | Olhar o topo do menu | Só o cartão "UBS Centro" (uma unidade, sem troca); as páginas não têm mais seletor de unidade |

**Conferido** por teste (QR lido por leitor automático a 600 e 160 px, resumo de hoje na API, escolha da unidade e menu por unidade) e por prints no Chrome; o QR real (107 caracteres) foi lido nos prints. **Falta** o clique no navegador e ler com um celular de verdade.

## Estação refeita (design system, 2026-11-16)

[Design](../design-system/estacao.md). Antes: `npm run dev:seed`, abrir a sessão de hoje e marcar a presença de dois pacientes na Fila do dia.

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Enfermeira | Painel → Estação | Abrir a tela | No topo, o serviço e o cartão "Triagem 1"; a fila com "aguardando na unidade" (senha, primeiro nome, há quanto tempo) e "a caminho"; "Estação livre" com **Chamar o próximo** |
| 2 | Enfermeira | Estação | Chamar o próximo | A faixa "chamado, esperando entrar" com Rechamar, Não compareceu e **Compareceu**; a classificação fica fechada |
| 3 | Enfermeira | Estação | Compareceu | "na sua sala há 00:05", "desfazer" e a classificação; o selo "app sugeriu" na cor sugerida |
| 4 | Enfermeira | Estação | Marcar uma cor e "Finalizar e chamar o próximo" | A pessoa vai ao atendimento e a próxima é chamada |
| 5 | Médico | Estação de atendimento | Chamar e "Finalizar e chamar o próximo" sem Compareceu | Fecha normalmente (o comparecimento é marcado sozinho) |

**Conferido** por teste (domínio, API com triagem e fila à vista, tela nas duas fases) e por prints no Chrome. **Falta** o clique no navegador.

## TV branca e azul (design system, 2026-11-16)

[Design](../design-system/tv.md).

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Gestor | Navegador da TV → `/tv` | Abrir | Fundo branco, o coração azul e o código de 6 dígitos num quadro azul-claro |
| 2 | Gerente | Painel → TVs | Parear com o código | A TV mostra a unidade e o botão azul "iniciar painel" |
| 3 | Gerente | TV | Tocar em "iniciar painel" | Topo com a marca, a unidade e a hora; "aguarde a sua senha"; serviços com "aguardando" e "a caminho" com ícone; o QR |
| 4 | Enfermeira | Estação | Chamar o próximo | Na TV, o cartão da chamada fica azul com a senha enorme e "→ triagem 1" por alguns segundos; a senha entra em "últimas chamadas" |

**Conferido** por teste de componente e por prints a 1920×1080. **Falta** ver numa TV de verdade, de longe.

## App: página da unidade com a faixa de dias (design system, 2026-11-16)

[Design](../design-system/app-unidade.md). Reinicie `npm run dev:mobile` antes (o Metro antigo não vê o pacote de design).

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Paciente | App → Agenda → UBS Centro | Abrir | Cartão da unidade (tipo como etiqueta, endereço em duas linhas, "como chegar"); "escolha o dia" com "novembro de 2026" em azul; a faixa com "hoje 16" e "amanhã 17" e o botão "calendário" no fim |
| 2 | Paciente | Faixa | Tocar em "amanhã 17" | Só os atendimentos de amanhã, cada um com horário e profissional com ícone, a pílula de vagas e "quero ir" |
| 3 | Paciente | Faixa | Tocar em "calendário" | O mês sobe por baixo: dias com atendimento azuis, o resto apagado; "ver terça, 17 de novembro" escolhe o dia |
| 4 | Paciente | Lista de espera | Olhar | Um cartão por serviço com "entrar na lista" ou "na lista" e "outra pessoa" |

**Conferido** por teste (dias, mês e ano, grade do mês) e por prints na prévia web. **Falta** no celular de verdade (gaveta nativa, rolagem da faixa trocando o mês).

## App: entrar (design system, 2026-11-16)

[Design](../design-system/app-entrar.md).

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Paciente | Boas-vindas → "já tenho conta" | Abrir | O Dr. Lino grande, "que bom te ver de novo!", CPF e senha com o olho no campo, "esqueci a senha", "entrar" aceso e "ainda não tenho conta" |
| 2 | Paciente | Entrar | Tocar "entrar" vazio | Os dois campos em vermelho: "digite o CPF." e "digite a senha." |
| 3 | Paciente | Entrar | Tocar o olho | A senha aparece; tocar de novo esconde |
| 4 | Paciente | Entrar | "esqueci a senha" | A gaveta com o Dr. Lino ("sem problema!"), "leve um documento com foto" e "ver as unidades perto de mim" |

**Conferido** por teste (o que falta em cada campo) e por prints na prévia web. **Falta** no celular de verdade (teclado aberto, gaveta nativa).

## App: criar conta, uma pergunta por tela (design system, 2026-11-16)

[Design](../design-system/app-cadastro.md).

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Paciente novo | Boas-vindas → começar → criar conta | Abrir | "oi! vamos criar a sua conta. qual é o seu nome completo?" com o Dr. Lino pequeno; X na barra; "já tenho conta" |
| 2 | Paciente novo | CPF | "continuar" vazio | "digite o CPF." embaixo do campo; com um CPF errado, "CPF inválido…" |
| 3 | Paciente novo | Senha | Digitar | "pelo menos 8 caracteres" fica verde com ✓ ao chegar em 8 |
| 4 | Paciente novo | Confira | "corrigir" no celular, mudar e "continuar" | Volta ao confira com o celular novo; "criar conta" entra no app |
| 5 | Paciente | Criar conta com o CPF da Ana | Criar | Volta à tela do CPF com o erro e "entrar com este CPF" (o "entrar" abre com o CPF preenchido) |
| 6 | Paciente | Entrar | Abrir | O Dr. Lino pequeno com o balão "que bom te ver de novo!…" |

**Conferido** por teste (ordem das telas, erros, regra da senha, corrigir, erro do servidor) e por prints na prévia web. **Falta** no celular de verdade (teclado de cada campo, voltar do Android).

## App: a aba "hoje" (design system, 2026-11-16)

[Design](../design-system/app-hoje.md). Antes: `npm run dev:seed` e o cenário da fila (sessão de hoje aberta, uma pessoa chamada).

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Bruno | App → hoje | Abrir | "boa tarde, Bruno!"; o bilhete "venha agora!" do clínico geral com a senha enorme e "cheguei: ler o QR"; em "também hoje", curativos com "2º" |
| 2 | Bruno | Bilhete | Tocar no "⋯" | A gaveta com "ver o caminho do dia" e só as ações que valem |
| 3 | Bruno | Topo | Com os avisos desligados | O sininho com ponto amarelo; tocar liga os avisos |
| 4 | Ana | App → hoje | Abrir | O bilhete dos curativos ("venha agora!") e o clínico geral em "1º, você é o próximo" |

**Conferido** por teste (ordem, bilhete, linha, nomes) e por prints na prévia web. **Falta** no celular de verdade.

# App: a página da unidade (escolher o dia do atendimento)

> Desenho combinado na conversa de 2026-11-16 (primeira tela do app na revisão de UI). Protótipos em `.superpowers/brainstorm/` (fora do git): `app-unidade.html` (opção C), `app-unidade-calendario.html`, `app-unidade-botao-calendario.html` (C) e `app-unidade-ab.html` (B). Base: [design.md](design.md) (app no estilo Duolingo) e a regra "nada de Info · Info · Info".

## Por quê

A página da unidade é onde a pessoa escolhe o atendimento. Hoje:

1. "posto de saúde (UBS) · Centro", "Rua das Flores, 100 · Centro · CEP 01001-000" e "15h às 19h · Enf. Carla": as frases com bolinhas.
2. O quadrado da data verde cheio briga com o selo verde "inscrito".
3. "toque para inscrever outra pessoa." solto embaixo do selo; a ação é o cartão inteiro, sem botão.
4. "como chegar" largo, antes do que importa.
5. Todas as datas numa lista comprida; com datas longe, é rolar muito.
6. A lista de espera repete "você já está na lista. toque para outra pessoa." em cada serviço.

## Objetivo

Escolher **o dia** primeiro, numa faixa de dias, e ver só os atendimentos daquele dia, com a ação num botão do kit; achar datas longe sem rolar a página.

## Não objetivos

- Mudar a inscrição (as telas seguintes), a lista de unidades e a API.
- Mapa ou rotas dentro do app ("como chegar" continua abrindo o app de mapas).

## Abordagens consideradas

- **Organização:** (A) por dia, com títulos; (B) por serviço, com horários como botões; **(C) faixa de dias**. **C**, sua escolha.
- **Datas longe:** a faixa mostra **só os dias que têm atendimento** (pula os vazios) e um **calendário do mês** para quem quer ver o mês inteiro.
- **Onde fica o botão do calendário:** ao lado do título, fixo no começo da faixa ou **no fim da faixa**. **No fim**, sua escolha.
- **O ano:** rótulo do mês sobre cada grupo, o ano no botão do dia, ou **o mês e o ano junto do título**, mudando conforme a faixa rola. Este, na **linha logo abaixo do título** (teste A/B, opção B).

## O desenho

### Cabeçalho (cartão)

Ícone de prédio, o nome grande, o tipo como etiqueta ("posto de saúde (UBS)"); o endereço em duas linhas com o ícone de alfinete ("Rua das Flores, 100" e "Centro, CEP 01001-000"); **como chegar** (`secundario`, `medio`, ícone de seta de navegação) alinhado à esquerda.

### Escolha o dia

- Título "escolha o dia" e, **na linha de baixo, o mês e o ano em azul** ("novembro de 2026") do primeiro dia visível da faixa; troca quando a faixa rola ("janeiro de 2027").
- **Faixa** que rola para o lado: um botão por **dia com atendimento** (dia da semana ou "hoje"/"amanhã" em cima, o número grande), todos do mesmo tamanho; o escolhido em azul cheio. Começa no primeiro dia com atendimento.
- No **fim da faixa**, o botão **calendário** (ícone). Abre a gaveta com o mês ("novembro de 2026", setas para os outros meses): os dias com atendimento ficam azuis e tocáveis, os outros apagados, hoje com contorno tracejado; o botão `principal` "ver quarta, 25 de novembro" fecha a gaveta e escolhe o dia.

### Os atendimentos do dia

Um cartão por sessão do dia escolhido:

- o serviço em negrito e, à direita, a pílula: **"N vagas"** (verde), **"sem vagas: entra na reserva"** (amarela) ou **"você está inscrito"** (verde, com ✓); "fila andando" como pílula azul quando a sessão já abriu;
- horário (relógio) e profissional (estetoscópio), cada um com ícone;
- o botão: **quero ir** (`principal`, `medio`); inscrito com vaga para outra pessoa, **outra pessoa** (`secundario`); inscrito sem poder inscrever mais ninguém, **ver minha fila** (`secundario`).

### Lista de espera

Abaixo dos atendimentos, "lista de espera" e uma linha: "a unidade marca a data e avisa no app." Um cartão compacto por serviço com lista: o nome e um botão **entrar** (`secundario`); já na lista: a pílula "na lista" e o botão **outra pessoa**; requisição ou regulação: o texto curto de hoje, sem botão.

### Sem atendimento

Sem nenhum dia na faixa: a faixa some e fica "nenhum atendimento aberto para inscrição agora nesta unidade" e "novas datas aparecem aqui quando a unidade abre as inscrições."

## Decisões minhas, para revisar

- **Saem os filtros por serviço** ("todos", "curativos", …): com a faixa de dias, a lista de um dia já é curta.
- **O botão do calendário aparece sempre** que há mais de um dia na faixa (com um dia só, não faz sentido).
- **A lista de espera fica numa seção abaixo**, com um cartão por serviço, em vez do cartão "não achou o dia?" do protótipo (que levaria a outra tela).

## Restrições

- TDD: a lógica (dias com atendimento, mês e ano do dia, grade do mês) em `src/lib`, com testes; o app só testa funções puras.
- Botões do kit (`Botao`, `AreaTocavel`); nenhum `<Pressable` fora de `src/components/ui.tsx`; nada de "Info · Info · Info".
- Datas no fuso de Brasília, como o resto do app.

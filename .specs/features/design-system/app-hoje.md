# App: a aba "hoje"

> Desenho combinado na conversa de 2026-11-16. Protótipo em `.superpowers/brainstorm/` (fora do git): `app-hoje.html`, estrutura A ("o urgente em destaque, o resto em linha") e visual 1 ("bilhete"). Base: [design.md](design.md).

## Por quê

A aba "hoje" estava poluída: os atendimentos do dia com o mesmo peso (o "venha agora" podia vir depois de quem ainda pode esperar); "venha agora" três vezes no mesmo cartão; o bloco de data colorido repetindo "hoje 16 nov"; "16h às 20h · UBS Centro"; a trilha e até quatro ações (duas vermelhas) em cada cartão; o aviso dos avisos desligados como um bloco grande; "mais 1 atendimento" e "unidades perto de você" repetindo o que as abas já fazem. E o nome da pessoa saía em minúsculas ("bruno").

## Objetivo

Ao abrir o app, ver **o que fazer agora** e **a senha**, sem ler nada mais.

## Não objetivos

- Mudar a tela de um atendimento (`fila/[entradaId]`), a "sua vez!" em tela cheia, a aba "atendimentos" ou a API.

## O desenho

- **Fundo cinza bem claro** (`#f4f7f8`) e cartões brancos com sombra suave.
- **Topo:** a marca e **o sininho**, igual em todas as telas com conta (ponto amarelo quando os avisos estão desligados); tocar abre a tela dos avisos. Sai a faixa grande.
- **Cumprimento:** o Dr. Lino pequeno, direto no fundo cinza-claro (sem caixa branca em volta), "boa tarde, Bruno!" e uma linha ("você tem 2 atendimentos hoje."). Sem balão.
- **O bilhete** (o atendimento que mais pede ação agora): faixa azul em cima com o que fazer ("venha agora!", "mostre na recepção", "você está na unidade", "você está na fila") e o "⋯"; o serviço e a unidade; o **corte picotado**; "SUA SENHA" e a **senha enorme** no centro; o botão da situação:
  - em casa (na fila, "venha agora"): **cheguei: ler o QR** (`principal`);
  - alocada para confirmar: **vou, confirmar** (`principal`);
  - na unidade, na recepção ou sem senha ainda: sem botão (a frase da faixa basta; sem senha, o lugar dela diz "a senha sai quando a fila abrir").
- **"⋯"** abre a gaveta com o que hoje fica embaixo do cartão: ver o caminho do dia (abre o atendimento), vou sair um pouco, meus sintomas pioraram, não posso nesta data, não vou poder ir — só as que valem na situação.
- **"também hoje":** os outros atendimentos do dia, **uma linha cada**: o quadrado com a posição ("2º") ou um ícone, o serviço e uma frase curta ("cerca de 10 min", "a fila abre às 16h"); tocar abre o atendimento.
- **Ordem** (quem vira o bilhete): venha agora → mostre na recepção → na unidade → na fila em casa (a menor posição primeiro) → sem previsão → para confirmar → aguardando a fila abrir → o resto.
- **Sem atendimento hoje:** o cumprimento diz "hoje está livre."; o próximo atendimento, se houver, numa linha; senão, **ver as unidades** (`secundario`).
- **Abas:** "atendimentos" ganha um **número** com os atendimentos de outros dias e da lista de espera; sai o cartão "mais 1 atendimento" e a seção "unidades perto de você".
- **Nomes de pessoas sempre com a primeira letra maiúscula** no app inteiro ("Bruno", "Ana Souza"), mesmo com o resto em minúsculas.

## Decisões minhas, para revisar

- **A ordem do bilhete** acima.
- **"vou, confirmar"** como botão do bilhete quando a única ação do dia é confirmar.
- **O número na aba** no lugar do cartão "mais 1 atendimento".

## Restrições

- TDD na lógica (ordem do dia, nome próprio, o que vai no bilhete e na linha) em `src/lib`.
- Botões do kit; nenhum `<Pressable` fora de `src/components/ui.tsx`; o Dr. Lino sobre fundo branco.

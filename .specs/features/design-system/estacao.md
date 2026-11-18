# Estação: chamado, compareceu e a fila à vista

> Desenho combinado na conversa de 2026-11-16 (quarta tela da revisão de UI). Protótipos em `.superpowers/brainstorm/` (fora do git): `estacao-fases.html` é o final. Base: [design.md](design.md) e a regra "nada de Info · Info · Info" de [fila-do-dia.md](fila-do-dia.md).

## Por quê

A Estação é a tela de quem chama (enfermeira na triagem, médico no consultório). Hoje:

1. A estação se escolhe num menu "Triagem 1 · Triagem", com bolinhas e sem ícone.
2. "Clínico geral · 1 aguardando na unidade · 1 a caminho": a frase com bolinhas que vetamos.
3. Quatro botões do mesmo peso; "Chamar próximo" e "Finalizar" ficam apagados e a explicação está lá embaixo, em letra pequena.
4. A sugestão do app aparece duas vezes.
5. As cores de risco são blocos saturados; não se vê qual está marcada.
6. O tempo desde a chamada é texto cinza.
7. Não mostra quem vem depois.

E falta um passo no fluxo: **não se registra que a pessoa entrou na sala**. Dá para classificar e finalizar quem nem apareceu, e a tolerância continua correndo (e avisando "passou a tolerância") com a pessoa já sentada.

## Objetivos

1. A tela em **duas fases**: *chamado, esperando entrar* → **Compareceu** → *na sua sala*. A classificação de risco só abre na segunda.
2. A fila da estação à vista: **quem aguarda, por senha e primeiro nome, na ordem em que será chamado**, e quem está a caminho, com **"o mais antigo há X"**.
3. Tudo no padrão do design system: botões do kit, nada de "Info · Info · Info".

## Não objetivos

- Mudar a ordem da fila, as regras de chamada, de pulo ou de prioridade.
- Mudar a TV. Ela já mostra cada chamada só por alguns segundos.
- A mini-janela flutuante (Picture-in-Picture) da spec de chamada.
- Métricas de tempo de sala (o dado passa a existir; o relatório fica para depois).

## Antiobjetivos

- Classificar ou finalizar na triagem quem não entrou na sala.
- Nome completo de quem aguarda na tela (o monitor do consultório pode estar à vista do paciente): só senha e primeiro nome.
- Botão fora do design system.

## Abordagens consideradas

- **Layout:** (A) uma coluna em passos; (B) paciente à esquerda, fila à direita; **(C) faixa do paciente no topo**. Você escolheu **C**.
- **Faixa do paciente:** azul cheio (chamativo), tarja azul, fundo azul-clarinho ou **cartão branco com relevo**. **Cartão branco com relevo**, a senha grande em azul.
- **Aguardando e a caminho:** (A) três contadores grandes; (B) quem está na fila, por nome; (C) barra do dia. **Mistura de A e B**: a lista por nome com "o mais antigo há X" no título.
- **"Compareceu"** (ideia sua): como **marcação na chamada** (hora de entrada), não como estado novo da fila. Um estado novo mexeria na máquina de estados, na estimativa e no encerramento sem ganho para esta tela.

## O desenho

### Topo

"Estação", a pílula do serviço da sessão (ícone de estetoscópio) e, à direita, o **cartão de uma linha da estação** (ícone, nome, seta só com mais de uma estação), igual ao da unidade no menu. Trocar abre a lista das estações que a pessoa opera, em cartões (nome, etapa com ícone). Sai o menu suspenso.

### A fila (cartão abaixo do topo)

Duas colunas:

- **aguardando na unidade** (ícone verde, título preto) e o número; ao lado, a pílula **"o mais antigo há 12 min"**: amarela; **vermelha** quando passa do tempo-alvo. Abaixo, até 3 chips `C-002 Ana há 12 min`, **na ordem em que a estação vai chamar** (prioridade e risco antes da chegada), e "+N".
- **a caminho** (ícone azul) e o número; até 3 chips tracejados `C-003 Carla`, na ordem da fila, e "+N"; "ninguém" quando vazio.
- Sem ninguém aguardando: "ninguém ainda".

Tempo-alvo da pílula: o da cor de risco de quem espera há mais tempo (vermelho imediato, laranja 10, amarelo 60, verde 120, azul 240 min); sem cor, 30 min.

### Faixa do paciente (cartão branco com relevo)

Senha grande azul, rótulo da fase, nome completo, pílulas com ícone (tempo e, se houver, a prioridade declarada: "60 anos ou mais").

- **Fase 1, chamado:** rótulo "chamado, esperando entrar"; pílula "00:48 desde a chamada" (vermelha com "passou a tolerância"). Botões, nesta ordem: **Rechamar** (`secundario`), **Não compareceu** (`perigoContorno`, com a confirmação de hoje), **Compareceu** (`principal`). Abaixo, no lugar da classificação (triagem): quadro tracejado "A classificação de risco abre quando a pessoa entrar na sala (Compareceu)."
- **Fase 2, na sala:** rótulo "na sua sala"; pílula verde "na sua sala há 01:25". Rechamar e Não compareceu somem; fica **desfazer** (`texto`), que volta à fase 1.

### Classificação (triagem, fase 2)

"Classifique o risco" e 5 cartões claros (borda da cor, bolinha, nome, gravidade, ícone de relógio e o tempo-alvo); o marcado se pinta inteiro, com a bolinha branca. A sugestão do app é um selo "app sugeriu" no cartão e uma linha "o app sugeriu amarelo porque: problema novo forte". O alerta de apoio (CVV 188, SAMU 192) fica entre a faixa e a classificação, como hoje. Com vermelho, o aviso do 1º lugar e **Encaminhar à emergência** (`perigo`) à esquerda, longe do principal.

### Ações (fase 2)

**Finalizar e chamar o próximo** (`principal`) e **só finalizar** (`texto`) ao lado. Na triagem, os dois pedem a cor. Saem os botões soltos "Chamar próximo" e "Finalizar".

### Outros estados

- **Estação livre** (ninguém chamado): quadro tracejado "Estação livre", "N pessoas aguardando na unidade." e **Chamar o próximo** (`principal`). Sem ninguém aguardando, o botão fica desligado e o texto diz "Ninguém aguardando agora. N a caminho. Quando chegar, o botão acende."
- **Sem sessão aberta:** "Nenhuma sessão aberta nesta estação. Quando a recepção abrir a sessão, a fila aparece aqui."
- **Nenhuma estação:** como hoje.

## Regras novas (domínio e API)

- **Compareceu**: só com alguém chamado na estação; grava a hora de entrada na chamada (`compareceuEm`). Repetir não muda nada.
- **Desfazer**: apaga essa hora (volta à fase 1).
- Depois do Compareceu: **Rechamar e Não compareceu recusam** (`transicao_proibida`) e **a tolerância não vale mais** (não avisa "passou a tolerância").
- **Finalizar ou chamar o próximo sem Compareceu:**
  - **triagem: recusa** com um erro novo, `sem_comparecimento` ("Marque Compareceu antes de classificar.");
  - **consultório: marca o comparecimento sozinho** na mesma hora e segue.
- Spec de chamada: duas linhas novas na tabela de transições do item (Chamado + Compareceu → (mesmo); Chamado + Desfazer compareceu → (mesmo)) e o texto da estação.
- A operação da estação passa a devolver: `chamado.compareceuEm`, `chamado.prioridade` (já existe na ficha da triagem; passa a valer em qualquer etapa), `proximos` (até 3: senha, primeiro nome, presente desde), `aCaminho` (até 3: senha, primeiro nome), `maisAntigo` (presente desde e tempo-alvo em minutos) ou `null`.
- Comandos novos: `POST /v1/panel/stations/:id/showed-up` e `.../undo-showed-up`.

## Restrições

- TDD em toda task; modo rápido da v0.1.
- Design system: botões do kit (`principal`, `secundario`, `perigoContorno`, `perigo`, `texto`), nenhum `<button>` fora de `components/ui/`, nada de "Info · Info · Info".
- Next 16: ler `node_modules/next/dist/docs/` antes de criar rota ou layout novo.
- Testes da API pedem o Docker Desktop no ar.

## Decisões minhas, para revisar

- **Compareceu como marcação na chamada**, não estado novo da fila.
- **Triagem bloqueia, consultório marca sozinho** (aprovado na conversa).
- **Tempo-alvo da pílula "o mais antigo"**: o da cor de quem espera há mais tempo; sem cor, 30 min.
- **Só senha e primeiro nome** nos chips da fila.
- **A troca de estação** em cartões no lugar do menu suspenso, como a unidade.

## Fica para quem constrói

- Os ícones exatos (lucide).
- Como se escolhe a estação quando há mais de uma (painel lateral ou lista que abre sob o cartão).
- O texto exato dos erros novos.

# App: a inscrição como conversa com o Dr. Lino

> Desenho combinado na conversa de 2026-11-16. Protótipo em `.superpowers/brainstorm/` (fora do git): `inscricao.html`, celular A (caixinha) com o "pronto!" 1 (Dr. Lino comemora). Base: [design.md](design.md), [app-cadastro.md](app-cadastro.md) (uma pergunta por tela) e [lista-espera](../../specs/lista-espera/spec.md) (RN de "para quem é", AD-018).

## Por quê

O cadastro virou uma conversa leve com o Dr. Lino, uma pergunta por tela; a inscrição, não: as perguntas não têm o Dr. Lino, "outra pessoa" pede três campos de uma vez, a resposta mais comum ("nenhum destes") fica no fim de listas longas, há "inscrito(a)" e "dele(a)". E quando é para outra pessoa: não fica claro que os dados são **dela**, e o app não pergunta **quem você é para ela** (responsável legal, cuidador…), o que a recepção precisa saber e a LGPD pede para dados de saúde de terceiros, sobretudo de criança.

## Objetivo

Uma inscrição que parece uma conversa leve e curta, para quem tem pouca prática com celular; e, para outra pessoa, dados claramente dela e a relação de quem inscreve, visível para a recepção.

## Não objetivos

- Mudar as perguntas do questionário, a classificação de risco ou as regras de quem pode se inscrever.
- Tirar a cara de "dispositivo médico" do questionário (preocupação anotada; remodelar depois, junto do D10 e do D8).
- Cadastro de dependentes (continua fora, AD-018).

## Abordagens consideradas

- **Tom:** conversa leve com o Dr. Lino (sua escolha) × direto e rápido.
- **Respostas:** **(A) caixinha**, concisa (sua escolha) × (B) cartões com ícone.
- **O "pronto!":** **(1) Dr. Lino comemora** (sua escolha) × (2) bilhete.
- **Relação com a outra pessoa:** (a) só uma declaração × **(b) a relação e a declaração** (sua escolha): a recepção vê quem inscreveu e em que condição; custa uma tela, uma regra nova e uma mudança na API e no painel.

## O desenho

### App

- **Toda tela de pergunta:** o Dr. Lino compacto com a fala no balão (`BalaoDoLino`, o mesmo do cadastro), barra de progresso com o X, `continuar` (`principal`) no rodapé.
- **"para quem é?"**: "oi! esse atendimento é para quem?", o atendimento em pílulas (serviço, unidade, dia) e as duas `Opcao` de hoje ("para mim", "para outra pessoa"). Já inscrito: "para mim" apagado com o selo "inscrito", como hoje.
- **Outra pessoa, uma tela por dado**, cada uma com o selo **"dados de quem vai ser atendido"** (ícone de pessoa) no alto:
  1. "qual é o nome da pessoa que vai ser atendida?" — campo "nome da pessoa".
  2. "e quando {Ana} nasceu?" — dd/mm/aaaa.
  3. "{Ana} tem CPF? se não tiver, tudo bem." — com o botão `texto` "{Ana} não tem CPF".
  4. **"e qual a sua relação com {Ana}?"** — `Opcao` única: "sou mãe, pai ou responsável legal de {Ana}", "cuido de {Ana} no dia a dia", "sou da família ou amigo de {Ana} e estou ajudando"; depois de escolher, a **declaração** como `Opcao` de marcar, conforme a relação: responsável legal → "declaro que sou responsável legal por {Ana}"; quem cuida ou ajuda → "{Ana} sabe e concorda com esta inscrição" (trocar a relação desmarca). Só segue com as duas. Revisado em 2026-11-16 para incluir quem faz um favor aos pais ou avós e seguir a lei: só o responsável legal responde pela pessoa; para um adulto, vale que ele saiba e concorde (mandato, Código Civil art. 656).
  - A conferência da API (`/verificar`) roda depois da tela 4; erro de um campo volta para a tela dele com a mensagem.
- **Antes do questionário:** "agora umas perguntinhas rápidas, para a unidade te atender melhor." (ou "…sobre {Ana}…") e pílulas "1 minuto" e "só a equipe da unidade vê"; botão "vamos lá". No modo "refazer" não aparece.
- **Perguntas:** o texto de hoje como fala do Dr. Lino ("antes de tudo: você está com algum destes agora?", "e por que você quer o atendimento?", "entendi. e como está esse problema?", "você tem alguma destas condições?", "por último: alguma destas se aplica a você?"; para outra pessoa, com o primeiro nome). Nas de marcar, **"nenhum destes"/"nenhuma" vem primeiro**, em verde, e depois "ou marque o que tiver".
- **Emergência e CVV:** como hoje, sérias, sem o Dr. Lino.
- **O "pronto!"** (inscrito, lista de espera, reserva, falta o pedido, respostas atualizadas): o Dr. Lino grande, um título curto ("prontinho!", "você está na lista de espera!", …), a frase sem "(a)" ("a vaga é sua." / "a vaga de Ana está garantida.") e o atendimento em pílulas (dia, horário, unidade e, para outra pessoa, o nome); `ver minha fila`.

### Regra (spec `lista-espera`)

- Ao inscrever outra pessoa, o responsável DEVE informar a relação com ela (`responsavel_legal`, `cuidador`, `familiar_autorizado`) e fazer a declaração da relação (acima). Sem as duas, a inscrição é recusada. Textos **provisórios até o D5**.

### API e painel

- `inscricaoEntradaSchema.paraQuem` (tipo `outra`) ganha `relacao` e `declarou: true`; a entrada guarda a relação.
- Na **Fila do dia**, a linha de quem foi inscrito por outra conta mostra a pílula "por {Carla} (família ou amigo)" ("responsável legal", "cuida no dia a dia"), com ícone e sem gênero.

## O que fica para quem constrói

- Nome da coluna e migração; o texto exato das relações no painel.
- Como o `/verificar` recebe a relação (ou se só a inscrição final a exige).

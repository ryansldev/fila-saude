# QR de entrada (equipe e paciente) e a unidade no menu

> Desenho combinado na conversa de 2026-11-16 (terceira tela da revisão de UI). Protótipos em `.superpowers/brainstorm/` (fora do git). Base: [design.md](design.md) e a regra "nada de Info · Info · Info" de [fila-do-dia.md](fila-do-dia.md).

## Por quê

**QR de entrada.** A tela do painel é da **equipe**, mas hoje fala com ninguém: um QR preto e grande, "UBS Centro · Curativos, Clínico geral" e "o código muda a cada 30 s". Ela não explica para quem atende como o QR funciona nem o que fazer quando não dá certo. E unidade sem TV pareada também precisa mostrar o código **para o paciente**, num monitor virado para o balcão, o que hoje só acontece abrindo a tela do painel com o menu e tudo. O visual do QR (preto puro, quadrado, borda grossa) é agressivo.

**Unidade.** O seletor é um menu suspenso só com o nome, repetido em 8 telas. Não dá para confirmar se é a unidade certa (endereço, CNES), e a unidade é o contexto do painel inteiro, não de cada página.

## Objetivos

1. **Tela da equipe** no QR de entrada: o QR (pequeno, para conferir), as sessões abertas e o **Dr. Lino explicando, no tom de quem atende**, como o QR funciona e o que fazer quando não dá certo.
2. **Tela do paciente** em tela cheia ("Abrir para o paciente"), sem o menu: QR grande à esquerda, o **Dr. Lino falando com o paciente** à direita e os 3 passos (layout A do protótipo).
3. **QR mais suave** em todo lugar que mostra o código de entrada (equipe, paciente, TV): **pontos redondos pretos, cantos arredondados e só o coração da marca, no centro, em azul**, em moldura branca com sombra leve e uma barrinha fina de troca.
4. **Unidade no topo do menu**, para o painel inteiro: cartão de **uma linha** (ícone, nome cortado com "…", bolinha verde se há sessão aberta, seta). Ao tocar, abre um painel lateral "Em qual unidade você está?" com cartões que mostram **todas as informações relevantes**: nome inteiro, endereço completo com CEP, bairro, tipo, CNES e o que acontece hoje.

## Não objetivos

- Reescrever a TV (só troca o desenho do QR dela pelo novo).
- Personalizar o Dr. Lino por município.
- Rever outras telas além do QR (a varredura segue depois).

## Antiobjetivos

- QR bonito que a câmera não lê: todo QR estilizado passa num leitor automático em teste.
- O Dr. Lino sobre fundo colorido (o jaleco é transparente: sempre fundo branco).
- Texto técnico para o paciente; texto infantil para a equipe.

## Abordagens consideradas

- **Tela do QR:** primeiro tratei a tela do painel como tela do paciente (três layouts de monitor). Você corrigiu: o painel é da equipe. Ficam **as duas**: a da equipe e a do paciente, com o Dr. Lino em cada uma, no tom de quem vê.
- **Layout do paciente:** (A) QR à esquerda e o Dr. Lino à direita; (B) o Dr. Lino grande à esquerda; (C) tudo no centro. **A.**
- **Estilo do QR:** (A) azul-escuro com cantos arredondados e coração; **(B) pontos redondos com coração**; (C) como A sem coração. **B**, escolha sua, com o ajuste: os pontos são **pretos** e só o coração é azul. Todos foram lidos por um leitor automático a 600 e 160 px.
- **Cartão da unidade:** (A) uma linha; (B) duas linhas com o bairro; (C) rótulo e o nome em até 2 linhas. **A**, com todas as informações no painel de troca.
- **Unidade global** (um caminho só): um contexto no layout do painel, que o cartão do menu troca e as páginas leem. Manter o seletor em cada página foi descartado (é o problema de hoje).

## O desenho

### Tela da equipe (`/qr`, dentro do painel)

- Cabeçalho "QR de entrada" e a frase "Quem já se inscreveu entra na fila de hoje lendo este código ao chegar."; à direita, o botão `principal` **"Abrir para o paciente (tela cheia)"** com ícone de monitor.
- As sessões abertas como pílulas (bolinha verde e o nome do serviço).
- À esquerda, o QR (~220 px) com a barrinha de troca e "troca sozinho a cada 30 s".
- À direita, o Dr. Lino (fundo branco) com o balão "Oi! Eu explico como o QR funciona na sua unidade." e quatro passos. **Balão suave, de mensagem**: fundo azul bem claro (`#eef5fa`), sem borda nem relevo, cantos bem arredondados e uma pontinha virada para o Dr. Lino (vale para as duas telas):
  1. **Deixe o código à vista de quem chega**: na TV da sala de espera ou num monitor virado para o balcão ("Abrir para o paciente").
  2. **A pessoa lê com o celular** e passa de "a caminho" para "na unidade" na Fila do dia. Não precisa fazer nada.
  3. **O código troca a cada 30 s**: assim ninguém entra na fila de casa com uma foto dele.
  4. **Não deu certo?** Sem celular, câmera que não lê ou "passe na recepção": confira o documento e marque a presença na Fila do dia.
- Sem sessão aberta: no lugar do QR, "O código aparece quando uma sessão abrir." (os passos continuam).

### Tela do paciente (`/qr/paciente`, fora do layout do painel, como `/tv`)

- Fundo branco, tela cheia, sem menu; exige a sessão da equipe (é aberta por ela).
- No topo, a marca "fila saúde" e a unidade (nome e endereço curto).
- **Três colunas**, com respiro largo nas margens: o QR (~30% da largura) na moldura, com a barrinha de troca; o **Dr. Lino grande, mais ou menos da altura do QR**, acenando; e o texto.
- O texto, numa coluna alinhada ao balão: o balão "chegou? que bom! leia o código com a câmera do celular.", os 3 passos curtos ("abra a câmera do celular", "aponte para o código ao lado", "pronto! fique de olho na TV"), os serviços abertos como etiquetas e "sem celular ou não deu certo? fale com a recepção.".
- **Texto grande para ser lido de longe** (fala ~2,15% da largura da tela, passos ~1,75%, aviso ~1,45%), com a mesma distância entre os blocos.
- Sem sessão aberta: o Dr. Lino diz "a fila abre às HH:MM." no lugar do código (ou "hoje não tem atendimento por aqui.").
- Textos em minúsculas, como no app.

### O QR (componente do kit)

- Desenhado a partir da matriz do `qrcode` (`QRCode.create`, correção **H**, por causa do coração): módulos como pontos redondos pretos (`#111313`), os três quadrados de canto arredondados e pretos, o coração da marca (azul `#1a73c8`) num quadrado branco no centro.
- Usado nas três telas (equipe, paciente, TV).
- **Teste**: o SVG gerado é rasterizado e lido por um leitor de QR (`zxing-wasm`) a 600 e 160 px, e o texto lido é o conteúdo original.

### A unidade no menu

- No topo do menu, abaixo da marca: cartão de uma linha com o ícone de prédio, o nome (cortado com "…", nome inteiro e endereço na dica do mouse), a bolinha verde se há sessão aberta e uma seta.
- Uma unidade só: o cartão aparece, sem a seta e sem abrir nada (confirma onde está).
- Mais de uma: tocar abre o painel lateral **"Em qual unidade você está?"** com um cartão por unidade: nome inteiro, endereço completo (logradouro, número, bairro, CEP), tipo (UBS, Policlínica, UPA), CNES (ou "sem CNES") e o que acontece hoje ("2 sessões abertas", "abre às 13:00", "nada hoje"). A atual fica marcada.
- A escolha vale para o painel inteiro (guardada no navegador como hoje). O menu passa a mostrar só os itens que a pessoa pode usar **na unidade escolhida**; quem é do município (gestão SMS) vê todas as unidades.
- Sai o `SeletorDeUnidade` das 8 páginas.

## Mudanças por camada

- **design:** o SVG do Dr. Lino passa para `packages/design` (o app e o painel usam o mesmo); o app passa a importar de lá.
- **API:** `GET /v1/painel/unidades/hoje` → para cada unidade que a pessoa vê: `{ unidadeId, abertas: number, proximaAbertura: iso | null }`.
- **painel:** contexto da unidade no layout (`ProvedorDaUnidade`; `useUnidadeAtual` passa a lê-lo); componentes `CartaoDaUnidade` (menu) e `TrocaDeUnidade` (painel lateral); `QrDeEntrada` (o QR estilizado) no kit; `DrLino` (mascote em fundo branco com balão) no kit; telas `/qr` e `/qr/paciente`; a TV usa o QR novo.

## Restrições

- TDD em toda task; modo rápido da v0.1.
- Design system: botões do kit, nada de `<button>` fora de `components/ui/`, nada de "Info · Info · Info".
- O Dr. Lino sempre sobre fundo branco.
- Next 16 com mudanças incompatíveis: ler `node_modules/next/dist/docs/` antes de criar rota ou layout novo.

## Decisões minhas, para revisar

- **A TV também passa a usar o QR novo**, para o código ser igual em todo lugar.
- **A tela do paciente exige a sessão da equipe** (é aberta pela recepção no computador do balcão), em vez de um pareamento como o da TV.
- **O menu passa a depender da unidade escolhida**: quem é recepção numa unidade e agenda em outra vê itens diferentes ao trocar.
- **"O que acontece hoje" numa rota nova e leve**, para não pesar a lista de unidades que as telas de configuração usam.

## Fica para quem constrói

- O ícone exato do monitor e do prédio (lucide).
- O tamanho exato do QR em cada tela, desde que leia no teste.
- A largura do painel lateral de troca.

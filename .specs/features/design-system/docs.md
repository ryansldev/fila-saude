# Docs: a estrutura do AbacatePay com o jeito Fila Saúde

> Desenho combinado na conversa de 2026-11-18 (revisão de UI das docs). Protótipos em `.superpowers/brainstorm/` (fora do git): `docs.html` (A, B, C: escolhida a C), `docs-c.html` (C refinada e o início rápido) e `docs-lino.html` (o Dr. Lino: escolhida a C). Base: [design.md](design.md), AD-066.

## Por quê

As docs estavam com o tema padrão do Fumadocs pintado de azul. O topo não orientava ("guias / API v1" pequenos, sem versão nem ação principal), o título ficava solto, havia cinza e relevo em tudo, os botões de "copiar o Markdown" e "abrir" ficavam fora do kit e o fluxo só aparecia em texto. A referência pedida é a doc do AbacatePay, misturada com o DS do Fila Saúde.

## Objetivo

A organização do AbacatePay (versão ao lado da marca, abas no topo, seção acima do título, fluxo desenhado, o OpenAPI à vista) com a cara do Fila Saúde: branco e azul, Nunito, relevo, títulos em minúsculas e o Dr. Lino.

## Não objetivos

- Modo escuro (o DS não tem; o Dr. Lino não vai em fundo escuro).
- Mudar o conteúdo dos guias ou da referência.

## Abordagens consideradas

(A) AbacatePay claro, leve e em frase normal; (B) AbacatePay escuro com o nosso azul (foge do DS); (C) a estrutura do AbacatePay com o jeito Fila Saúde. **C**, sua escolha. Para o Dr. Lino: (A) conversando ao lado da coluna de ações, (C) grande no topo, como a landing. **C**.

## O desenho

- **Topo:** a marca e a versão atual em pílula clara; a busca no centro (borda do DS); à direita, `llms.txt`, o GitHub como botão-ícone do kit e **"baixar o OpenAPI"** (`.ds-btn-primary`, compacto).
- **Abas:** "guias" e a referência de cada versão, com ícone; a ativa em azul com sublinhado grosso.
- **Menu:** rótulos dos grupos discretos (cinza, pequenos); itens com ícone; o ativo vira um botão azul com relevo (como o principal do kit).
- **Cabeçalho da página:** a seção em pílula azul-clara acima do título; título em extrabold (40 px), subtítulo com largura máxima. **Sem "copiar o Markdown" nem "abrir no GitHub"** no corpo da página (o Markdown segue em `/docs/<página>.md` e no `llms.txt`).
- **Introdução:** o Dr. Lino grande à direita do título, acenando, sobre branco; a fala no balão suave do kit (`#eef5fa`, sem borda, pontinha para ele) logo abaixo do subtítulo, e dois botões: "começar pelo início rápido" (`principal`) e "ver os conceitos" (`secundario`). No celular, o Dr. Lino fica menor, ao lado do balão.
- **Fluxo:** etapas em blocos brancos com relevo, número em pílula azul-clara e setas azuis.
- **Cartões:** brancos, borda clara, relevo de 5 px, ícone num quadrado azul-claro.
- **Passos:** o número num círculo azul com relevo.
- **Código:** bloco com borda clara e relevo; as abas (cURL, JavaScript) em pílula.
- **Avisos:** nas cores de estado do DS, com ícone.
- **Anterior / próxima:** cartões com relevo.
- Textos em minúsculas nos títulos e no menu (siglas e nomes como são), como a landing (DA10).

## Restrições

- Botões das docs com as classes do kit (`.ds-btn-*`), como nos protótipos.
- Cores dos tokens do `packages/design`; o Dr. Lino do `@fila-saude/design` (sempre sobre branco).

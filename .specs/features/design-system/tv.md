# TV da sala de espera: branca e azul

> Desenho combinado na conversa de 2026-11-16 (quinta tela da revisão de UI). Protótipo em `.superpowers/brainstorm/` (fora do git): `tv.html`, opção A. Base: [design.md](design.md).

## Por quê

A TV é toda azul-escura, sem a marca, com o texto "1 aguardando +1 a caminho" e o QR pequeno num canto. Destoa do Fila Saúde, que é branco e azul. As telas de pareamento e "iniciar painel" também são azul-escuras.

## Objetivo

A mesma TV, com a **mesma grade de hoje** (você escolheu a A), na cara do Fila Saúde: fundo branco, azul só onde chama atenção.

## Não objetivos

- Mudar o que a TV mostra ou como anuncia (som, fila de anúncios, tempo de destaque, pareamento).
- Mudar a API.

## Abordagens consideradas

(A) a grade de hoje, clara; (B) coluna azul à direita; (C) A com o Dr. Lino no QR. **A**, sua escolha: a mudança mais segura, quem já usa a TV não estranha.

## O desenho

- **Topo:** a marca (coração azul e "fila saúde") à esquerda, o nome da unidade no meio e a hora à direita (relógio da TV, HH:MM).
- **Grade:** chamada grande (2/3) e últimas chamadas (1/3) em cima; serviços (2/3) e QR (1/3) embaixo. Cartões brancos com borda clara e o relevo leve do kit; fundo branco.
- **Chamando agora:**
  - sem chamada: rótulo "chamando agora", "aguarde a sua senha" (ou "atendimento ainda não começou") e "a senha aparece aqui quando chamarem";
  - chamando: o cartão fica **azul cheio** (`#1a73c8`) com a senha enorme em branco e "→ destino". É o único azul cheio da tela.
- **Últimas chamadas:** até 4 linhas, senha em negrito à esquerda, destino em cinza à direita, separadas por uma linha fina.
- **Serviços:** um cartão cinza-claro por serviço com o nome e dois números com ícone: pessoas (verde) "aguardando" e caminhando (azul) "a caminho". Nada de "+1 a caminho".
- **QR:** o QR novo (pontos pretos, coração azul) e "chegou? leia o QR"; sem sessão aberta, "o QR aparece quando o atendimento abrir".
- **Pareamento, "iniciar painel", "reconectando…" e o aviso "sem conexão":** fundo branco, a marca azul; o código de pareamento em azul-escuro; "iniciar painel" com o botão `principal`.

## Decisões minhas, para revisar

- **Sem o endereço da unidade no topo** (o protótipo tinha): a TV não recebe o endereço, e trazê-lo mudaria a API para uma informação que quem está na sala de espera já sabe.
- **A hora vem do relógio da TV**, não do servidor.

## Restrições

- TDD (testes de componente das partes novas); modo rápido.
- Botões do kit; nada de "Info · Info · Info".
- Os testes atuais da TV (anúncios, som, últimas chamadas) continuam passando.

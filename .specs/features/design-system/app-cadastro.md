# App: criar conta (uma pergunta por tela) e o Dr. Lino compacto no "entrar"

> Desenho combinado na conversa de 2026-11-16. Protótipo em `.superpowers/brainstorm/` (fora do git): `app-cadastro.html`, opção B. Base: [design.md](design.md) e [app-entrar.md](app-entrar.md).

## Por quê

O cadastro pede 4 campos de uma vez ("seus dados"), sem o Dr. Lino; "passo 1 de 2" repete a barra; "usamos o CPF para te identificar na unidade." fica solto entre os campos; o passo 1 não tem o X para sair; a senha só diz a regra depois do erro; e "o e-mail serve para recuperar a senha" não é verdade (quem troca a senha é a recepção). Quem mais usa o app tem pouca prática com celular.

## Objetivo

Criar a conta como uma conversa com o Dr. Lino, **uma pergunta por tela**, com um resumo para conferir antes de criar. E o "entrar" com o mesmo Dr. Lino compacto, para poupar espaço.

## Não objetivos

- Mudar a API (os campos e as regras são os de hoje; o e-mail continua obrigatório).
- Recuperar senha por e-mail.

## Abordagens consideradas

(A) os 2 passos de hoje, arrumados; **(B) uma pergunta por tela**, sua escolha (o mais fácil para quem tem pouca prática, "uma coisa por página"); (C) 3 passos com tema. Prós e contras discutidos na conversa: B tem mais toques e corrigir pede voltar, resolvido com a tela "confira".

## O desenho

### O Dr. Lino compacto (kit)

Um componente novo do kit: o Dr. Lino pequeno (fundo branco) à esquerda e o **balão suave** (azul bem claro, sem borda, pontinha para ele) com a fala. Usado em cada tela do cadastro e no "entrar".

### Criar conta

Barra de progresso no topo **com o X para sair em todas as telas**; o "voltar" do Android volta uma tela. Cada tela: o Dr. Lino compacto perguntando, um campo (com o teclado certo e o foco nele) e, no rodapé, **continuar** (`principal`).

1. **nome**: "oi! vamos criar a sua conta. qual é o seu nome completo?" — "já tenho conta" (`texto`) só nesta tela.
2. **CPF**: "e o seu CPF?" — dica embaixo do campo: "só para te identificar na unidade."
3. **nascimento**: "quando você nasceu?" (dd/mm/aaaa).
4. **celular**: "qual é o seu celular?" — dica: "com DDD. a unidade usa se precisar falar com você."
5. **senha**: "crie uma senha para entrar no app." — olho no campo; embaixo, a regra **"pelo menos 8 caracteres"**, cinza com um círculo e verde com ✓ quando cumprida, enquanto digita.
6. **e-mail**: "e o seu e-mail?" — dica: "para avisos da sua conta."
7. **confira**: "confira os seus dados." — uma linha por dado (nome, CPF, nascimento, celular, e-mail), cada uma com **corrigir** (`texto`), que leva àquela tela e, ao continuar, volta para cá. Rodapé: **criar conta** (`principal`).

- O erro de cada campo aparece embaixo dele ao tocar "continuar" (as mensagens de hoje).
- **CPF já com conta** (resposta do servidor ao criar): volta para a tela do CPF com o erro e o botão **entrar com este CPF** (`secundario`).
- **E-mail já com conta**: volta para a tela do e-mail com o erro.

### Entrar

Troca o Dr. Lino grande pelo **compacto**, com o balão "que bom te ver de novo! entre com o seu CPF e a senha."; o resto como está.

## Decisões minhas, para revisar

- **O e-mail continua obrigatório** (como a API pede hoje), só com o texto corrigido ("para avisos da sua conta"). Torná-lo opcional ou tirar fica para quando você decidir.
- **"entrar com este CPF"** quando o CPF já tem conta, em vez de só o erro.
- A tela **"confira"** antes de criar a conta.

## Restrições

- TDD na lógica (ordem das telas, erro de cada tela, regra da senha, para onde vai o "continuar" depois de "corrigir") em `src/lib`.
- Botões do kit; nenhum `<Pressable` fora de `src/components/ui.tsx`; o Dr. Lino sobre fundo branco.

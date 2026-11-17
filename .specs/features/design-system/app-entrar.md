# App: entrar

> Desenho combinado na conversa de 2026-11-16. Protótipo em `.superpowers/brainstorm/` (fora do git): `app-entrar.html`, opção B. Base: [design.md](design.md).

## Por quê

A tela "entrar" é só um formulário: "mostrar senha" é um link solto longe do campo; "esqueceu a senha? a recepção da sua unidade ajuda." é texto sem ação; o botão "entrar" fica apagado até tudo estar preenchido, sem dizer o que falta; não tem o Dr. Lino nem acolhimento; e "criar uma conta" passa despercebido.

## Objetivo

A tela que recebe quem volta, no mesmo tom das boas-vindas, com cada dúvida resolvida por uma ação.

## Não objetivos

- Recuperar a senha pelo app (SMS ou e-mail): continua na recepção.
- Mudar o cadastro além do campo de senha.

## Abordagens consideradas

(A) Dr. Lino pequeno com balão; **(B) Dr. Lino grande, como nas boas-vindas**, sua escolha: mais acolhedor; com o teclado aberto, a pessoa rola.

## O desenho

- **Topo:** o Dr. Lino grande (fundo branco), centralizado; "que bom te ver de novo!" como título e "entre com o seu CPF e a senha." embaixo.
- **CPF** (como hoje, com a máscara) e **senha** com o **ícone de olho dentro do campo** (mostrar e esconder; leitor de tela: "mostrar a senha"/"esconder a senha"). O `CampoSenha` do kit muda, então o cadastro ganha o olho também.
- **"esqueci a senha"** (`texto`, ícone de chave) alinhado à direita, abaixo da senha. Abre a gaveta: o Dr. Lino com o balão "sem problema! a recepção da sua unidade troca a senha para você.", a linha "leve um documento com foto" (RG, CNH ou outro com o seu CPF), **ver as unidades perto de mim** (`principal`, vai para a lista de unidades) e **voltar para entrar** (`texto`).
- **Rodapé fixo:** **entrar** (`principal`) **sempre aceso**; **ainda não tenho conta** (`texto`, vai para o cadastro).
- **Ao tocar "entrar"** com algo faltando, o campo fica vermelho e diz o que falta: "digite o CPF.", "CPF inválido. confira os números." ou "digite a senha.". O erro do servidor (senha errada, muitas tentativas) continua na faixa de hoje.

## Decisões minhas, para revisar

- **O olho entra no `CampoSenha` do kit**, para o app inteiro (cadastro também).
- **"ver as unidades perto de mim"** abre a lista de unidades do município escolhido (ela não pede login).

## Restrições

- TDD na validação (`src/lib/validation.ts`): o que falta em cada campo.
- Botões do kit; nenhum `<Pressable` fora de `src/components/ui.tsx`; o Dr. Lino sempre sobre fundo branco.

# Design System e nova tela de Agendamento

> Desenho combinado na conversa de 2026-11-16. Protótipos em `.superpowers/brainstorm/` (fora do git).

## Por quê

A UI/UX do app e do painel ainda não está no nível das referências: **Duolingo** para o app do paciente e **portal do parceiro do iFood** para o painel. São referências de UI/UX bem feita, não estilos para copiar. O problema mais visível são os botões: cada tela resolve do seu jeito (`Pressable` soltos no app, `<button>` crus no painel, tamanhos sem regra, dois azuis diferentes). O pedido é que tudo siga **um design system**: um componente de botão em cada plataforma, com o mesmo padrão.

A primeira tela a revisar é a nova **Agendamento** (fatia 4), apontada como a que mais incomoda.

## Objetivos

1. **Mesma cara em tudo.** O app e o painel são o mesmo produto: mesmas cores, mesma fonte (Nunito), mesmos cantos e mesmos nomes de variação. O painel tem **menos relevo**, para não competir com o conteúdo de uma ferramenta de trabalho.
2. **Um botão por plataforma.** `Botao` no app e `Button` no painel. Nenhum botão nem área tocável fora dos componentes do design system, com um teste que falha se aparecer.
3. **Agendamento no caminho A** (abaixo): bater o olho e saber o que fazer agora.

## Não objetivos

- Revisar as outras telas. Isso vem numa conversa à parte, tela a tela, pelo mesmo método (print de hoje, problemas, caminhos).
- Modo escuro, temas por município, nova identidade visual (logo, mascote).
- Trocar a base técnica do app (React Native/Expo) ou do painel (Next + Tailwind + shadcn).

## Antiobjetivos (seria um fracasso mesmo funcionando)

- O painel ficar "brincalhão": relevo grande e cores fortes disputando com a fila e os nomes.
- Dois componentes que começam iguais e se afastam com o tempo, como hoje.
- Perder acessibilidade: contraste abaixo de AA, alvo de toque menor que 44 px no app, foco invisível no painel.

## Abordagens consideradas (escolhida: A)

| | Abordagem | Troca | Decisão |
| --- | --- | --- | --- |
| **A** | **Pacote de tokens compartilhado** (`packages/design`). Cores, cantos, alturas, relevo e variações num lugar só; cada plataforma tem o seu componente nativo, que lê os tokens | Um pacote a mais; o CSS do painel é gerado a partir dos tokens | **Escolhida**: resolve a "mesma cara" na raiz sem refazer o que funciona |
| B | Dois componentes com os valores copiados | Mais rápido; os dois se afastam com o tempo (o problema de hoje) | Descartada |
| C | Biblioteca única nas duas plataformas (Tamagui ou similar) | Uma peça só; reforma das duas bases | Descartada: custo grande demais para o ganho |

Relevo do painel: considerados plano, 3 px e 4 px; **escolhido 3 px** ("relevo leve"). Mesma cara nos dois foi escolha explícita (descartado "mesmas regras, cara própria").

Agendamento: considerados (A) sessões à esquerda e a sessão à direita, (B) quadro por etapa e (C) a tela de hoje arrumada. **Escolhido A.**

## O design system

### Tokens (`packages/design`)

Fonte única, em TypeScript (`tokens.ts`), consumida:
- **pelo app** direto (como `@fila-saude/domain` e `@fila-saude/schemas` já são);
- **pelo painel** por um CSS gerado (`tokens.css`, variáveis CSS para o `@theme` do Tailwind), produzido por um script, com um teste que falha se o CSS gerado estiver desatualizado (como o `specs:gen`/`specs:check`).

Conteúdo mínimo:
- **Cores de marca e de estado:** ação `#1a73c8` (pressionado `#185b9a`, sombra `#145a9b`), tinta, tinta suave, linha, superfícies, sucesso, perigo, aviso. Valores de hoje do app (`COR` em `apps/mobile/src/components/ui.tsx`).
- **Fonte:** Nunito (600, 700, 800).
- **Botão:** variações, densidades, tamanhos, estados (abaixo).
- **Cantos e espaçamentos** usados pelos botões e cartões.

**Decisão minha (a revisar):** o painel passa a usar o azul do app (`#1a73c8`). O azul principal do painel hoje (`primary-500`, cerca de `#2f86de`) tem contraste 3,76 com texto branco, abaixo do AA (4,5); o do app tem 4,85. O painel fica um pouco mais escuro.

### Botão

| | App (Duolingo) | Painel (iFood) |
| --- | --- | --- |
| Relevo (borda de baixo) | 5 px; ao tocar, 2 px e desce 3 px | 3 px; ao tocar, 2 px e desce 1 px |
| Tamanho padrão | 56 px, largura total nas ações da tela, texto 18 px peso 800 | 40 px, texto 15 px peso 800 |
| Tamanho menor | **médio** 44 px, dentro de cartões | **compacto** 32 px, dentro de tabelas e listas |
| Cantos | 16 px (médio 14 px) | 10 px (compacto 8 px) |

**Variações (as mesmas nos dois, com os mesmos nomes):**
- `principal`: a ação que avança. **No máximo uma por área** (tela, cartão, linha de destaque).
- `secundario`: alternativa ao lado da principal (fundo branco, borda clara, texto azul).
- `sucesso`: "deu certo / confirmou" (verde).
- `perigo`: **cheio** só para emergência (192, encaminhar à emergência); **contorno** (`perigoContorno`) para recusar, remover, sair.
- `texto`: ação de baixo peso (sublinhado), sem relevo.
- `branco`: sobre fundos coloridos (ex.: a tela verde "é a sua vez!").

**Estados:** normal, tocado (afunda), carregando (indicador + "aguarde…", sem novo toque), desativado (45% de opacidade, sem relevo no painel). Foco visível no painel (anel). No app, alvo de toque de 44 px no mínimo, inclusive na variação `texto`.

Ícone opcional à esquerda, nos dois.

### Regra dura e a trava

Nenhum botão nem área tocável fora dos componentes do design system:
- **App:** `Pressable` só dentro dos componentes do design system (o `Botao` e os tocáveis já existentes: `LinhaTocavel`, `CartaoTocavel`, `Opcao`, `Chips`, `Abas` e afins). Viram `Botao`: `LinkBotao`, `BotaoLigar` (vira um atalho que renderiza `Botao`), o botão das `Faixa`, os `Pressable` soltos de `conta`, `municipio`, `atendimentos`. Os marcadores do mapa (`components/mapa*.tsx`) ficam na lista de exceções, com o motivo: não são botões.
- **Painel:** `<button>` só em `components/ui/`. Viram componentes do design system: as cores da triagem (estação), o botão da TV, o "mostrar senha" e o "adicionar linha" do formulário. O `Button` do shadcn é reescrito com as variações e tamanhos acima (fora `lg`, que hoje é **menor** que o padrão; `sm` vira `compacto`) e todas as telas migram.
- **Trava:** um teste em cada app procura `Pressable`/`<button` fora das pastas permitidas e falha, com a lista de exceções explícita no próprio teste.

## A nova tela de Agendamento (caminho A)

Layout de duas colunas, como o gestor de pedidos do iFood:

```
Agendamento                                    [Odontologia · 3] [Clínico geral · 0]
UBS Centro · Odontologia
┌ 2 pessoas para ligar · Bruno Lima sem resposta há 30 h      [Ver lista de ligação] ┐
┌ SESSÕES PRIVADAS ──────┐  ┌ Vagas · 1 de 4      alocação até seg., 16/11   ▮▯▯▯ ┐
│▌ter., 17/11 · 13:00    │  │ Ana Souza · 68 anos                     [Confirmou]  │
│ Dr. Paulo   ▮▯▯▯ 3 livres│  └──────────────────────────────────────────────────┘
│ qui., 19/11 · 13:00    │  ┌ Sugestão para as 3 vagas livres ────────────────────┐
│ Dr. Paulo   ▯▯▯▯ 4 livres│ │ Carla Dias · 30 [Urgente (app)]          [Alocar]   │ ← principal
└────────────────────────┘  │ gestante · problema novo forte · na lista há 2 dias │
                            │ José Pereira · 51 · sem app              [Alocar]   │ ← secundário
                            └─────────────────────────────────────────────────────┘
```

- **Topo:** título, unidade e serviço; troca de serviço por um controle segmentado com a contagem na lista e o alerta; com mais de 4 serviços, vira seletor.
- **Faixa de pendências:** quantas pessoas para ligar e o caso mais atrasado; "Ver lista de ligação" abre um **painel lateral** (o `PainelLateral` que o painel já usa) com a lista de ligação (telefone, prazo, última tentativa e "Confirmou", "Sem contato", "Recusou"). Some quando não há pendência.
- **Coluna da esquerda:** as sessões privadas planejadas do serviço, com data, profissional, **barrinhas de vagas** (verde = confirmada, amarelo = aguardando resposta, cinza = livre) e quantas livres. A escolhida fica destacada.
- **Coluna da direita, em cima:** as vagas da sessão (barrinhas e "1 de 4"), até quando dá para alocar (ou por que não dá), e os alocados com a situação em selo e, para quem aguarda resposta, as ações de resposta.
- **Coluna da direita, embaixo:** a sugestão. Cada linha: nome, idade, "sem app" quando for o caso, **um selo de risco** ("Urgente (app)" = sugerido; "Urgente" = confirmado na triagem), uma linha de motivos sem repetir o risco, e "Alocar". **Só a primeira linha** leva `principal`; as outras, `secundario`. Selos de autolesão e de faltas continuam.
- **Menu:** o item "Agendamento" ganha ícone e um contador com as pessoas para ligar da unidade escolhida.

Muda na API (pequeno): a sugestão passa a dizer `semApp` e a mandar o motivo de risco separado dos demais; um contador leve de pendências da unidade para o menu (ou o próprio `/ligacao`, se ficar barato).

## Restrições

- TDD em toda task (memória: TDD sempre); modo rápido da v0.1, sem revisão por task.
- Painel em Next com mudanças incompatíveis com a versão conhecida: ler `node_modules/next/dist/docs/` antes de mexer em padrões do Next.
- Os testes atuais do painel (106) e do app (98) continuam passando; telas migradas não mudam de comportamento.
- Uma plataforma só (AD de app único); nada por município.

## Decisões minhas, para revisar

- **Azul do painel = azul do app** (`#1a73c8`), pelo contraste (acima). Vale para tudo que hoje usa `--primary` no painel (botões, item ativo do menu, links), não só para os botões; a escala `primary-50..900` é refeita em volta dele.
- **Desativado igual nos dois:** 45% de opacidade, sem o fundo cinza que o painel usa hoje.
- **Contador do menu** atualiza a cada 60 s (como as outras consultas do painel) e conta as alocações pendentes da unidade escolhida.
- **Botão das `Faixa` no app** usa o tamanho médio.

## Fica para quem constrói

- Nome exato dos arquivos e a forma do script que gera o `tokens.css`.
- Como o `Button` do painel aplica o relevo (CSS de borda, como hoje, ou sombra).
- O texto exato das faixas e dos estados vazios, seguindo o tom atual (app em minúsculas; painel em frase normal).
- A ordem da migração das telas, desde que a trava entre só quando a migração terminar.

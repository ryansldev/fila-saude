# Design System e nova tela de Agendamento — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** um botão por plataforma (`Botao` no app, `Button` no painel) com a mesma cara, lido de um pacote de tokens compartilhado, nenhum botão fora do design system, e a tela de Agendamento refeita no caminho A.

**Architecture:** `packages/design` guarda os tokens e uma função pura `estiloDoBotao` que decide cores, altura, cantos e relevo de cada variação e densidade. O app lê os tokens direto; o painel importa um `tokens.css` gerado da mesma função (classes `.ds-btn-*`), conferido por teste. Uma trava por app falha se aparecer `Pressable`/`<button>` fora das pastas do design system. A tela de Agendamento troca para o mestre-detalhe com três acréscimos pequenos na API.

**Tech Stack:** TypeScript, React Native/Expo (app), Next + Tailwind v4 + shadcn/base-ui (painel), Fastify + Drizzle (API), Vitest.

**Spec:** [design.md](design.md)

## Global Constraints

- TDD em toda task: teste vermelho → código → verde → commit. Modo rápido da v0.1, sem revisão por task.
- Variações (mesmos nomes nos dois): `principal`, `secundario`, `sucesso`, `perigo` (cheio, só emergência), `perigoContorno`, `texto`, `textoPerigo`, `branco`. **`textoPerigo` é acréscimo deste plano ao design:** os links vermelhos de hoje ("não vou poder ir", "meus sintomas pioraram", "sair da lista") precisam de uma ação de baixo peso em vermelho; `perigoContorno` pesaria demais no cartão.
- Densidades: **app** `padrao` 56 px, canto 16, texto 18/800, relevo 5 → 2 ao tocar, desce 3; `medio` 44 px, canto 14, texto 16/800, relevo 4 → 2, desce 2. **Painel** `padrao` 40 px, canto 10, texto 15/800, relevo 3 → 2, desce 1; `compacto` 32 px, canto 8, texto 13/800, relevo 3 → 2, desce 1; `icone` 32×32, canto 8, sem relevo.
- `texto`, `textoPerigo` e `icone`: sem relevo. Desativado: opacidade 0,45 e sem relevo, nas duas plataformas.
- Cores (de `COR` em `apps/mobile/src/components/ui.tsx`): ação `#1a73c8`, ação pressionada `#185b9a`, sombra da ação `#145a9b`, linha `#e1e8ea`, superfície `#ffffff`, perigo `#993029` (sombra `#6e1f1a`), sucesso `#2f9e44` (sombra `#237a34`), tinta `#111313`, azul escuro `#0c2e4e`.
- Alvo de toque no app ≥ 44 px, inclusive `texto`. Foco visível no painel (anel).
- Textos: app em minúsculas; painel em frase normal.
- Next do painel tem mudanças incompatíveis: ler `apps/painel/node_modules/next/dist/docs/` antes de mexer em padrões do Next. Expo: conferir a doc da versão em `apps/mobile/package.json` antes de usar API nova.
- Testes da API precisam do Docker Desktop no ar (`systemctl --user start docker-desktop`).

## Review Focus

1. **Botão carregando recebe dois toques** (rede lenta, toque duplo em "Alocar" ou "vou, confirmar"): deve mandar um pedido só. → teste em Task 3 (`Button` com `carregando` fica `disabled`) e regra em Task 2 (o `Botao` do app já desativa com `carregando`; mantido).
2. **Texto longo no botão** (nome de serviço ou "não posso nesta data" em tela estreita): não pode cortar no meio sem reticências nem estourar a linha. → Task 2: `numberOfLines={1}` com reticências no `Botao`; Task 3: `truncate` no rótulo do `Button` compacto.
3. **Unidade sem sessão privada ou sem ninguém para ligar** no Agendamento: coluna da esquerda vazia com a orientação "crie uma sessão privada em Sessões", e a faixa de pendências some. → teste em Task 5 (`resumoDasPendencias([])` devolve `null`).
4. **Sessão sem limite de vagas** (`vagas: null`) nas barrinhas: não desenhar barrinhas infinitas; mostrar "N alocados · sem limite". → teste em Task 5 (`barrasDeVagas`).
5. **Variação que não existe numa densidade** (ex.: `icone` no app): erro de tipo, não estilo quebrado. → Task 1: tipos separados `TamanhoApp` e `TamanhoPainel`.

---

### Task 1: Pacote de tokens `@fila-saude/design`

**Files:**
- Create: `packages/design/package.json` (`"name": "@fila-saude/design"`, `"type": "module"`, scripts `test`, `gen`), `packages/design/vitest.config.ts` (igual ao de `packages/schemas`)
- Create: `packages/design/tokens.ts`, `packages/design/botao.ts`, `packages/design/css.ts`, `packages/design/index.ts`
- Create: `packages/design/scripts/gerar-css.ts` → escreve `packages/design/tokens.css`
- Create: `packages/design/tokens.css` (gerado, versionado)
- Test: `packages/design/test/botao.test.ts`, `packages/design/test/css.test.ts`
- Modify: `package.json` raiz (script `"design:gen": "npm -w @fila-saude/design run gen"`, `"test:design"`)

**Interfaces:**
- Produces:
  - `COR` (mesmas chaves de hoje em `apps/mobile/src/components/ui.tsx`) e `FONTE` (Nunito 400/600/700/800, mesmos nomes de família do app).
  - `type Variante = "principal" | "secundario" | "sucesso" | "perigo" | "perigoContorno" | "texto" | "textoPerigo" | "branco"`; `VARIANTES: readonly Variante[]`.
  - `type TamanhoApp = "padrao" | "medio"`; `type TamanhoPainel = "padrao" | "compacto" | "icone"`.
  - `type EstiloDoBotao = { fundo: string; borda: string; sombra: string; texto: string; altura: number; raio: number; fonteTamanho: number; fontePeso: 700 | 800; relevo: number; relevoTocado: number; desce: number; paddingX: number }`.
  - `estiloDoBotao(plataforma: "app", variante: Variante, tamanho: TamanhoApp): EstiloDoBotao` e a sobrecarga `(plataforma: "painel", variante, tamanho: TamanhoPainel)`.
  - `OPACIDADE_DESATIVADO = 0.45`.
  - `gerarCss(): string`: `:root` com `--ds-acao`, `--ds-acao-pressionado`, `--ds-acao-sombra`, `--ds-linha`, `--ds-perigo`, `--ds-sucesso`; e as classes `.ds-btn` (base: flex, gap, Nunito, borda 2 px sólida, borda de baixo = relevo, transição, foco com anel), `.ds-btn-<variante>`, `.ds-btn-<tamanho>`, o `:active:not(:disabled)` de cada tamanho (borda de baixo = `relevoTocado`, `translateY(desce)`), e `:disabled` (opacidade 0,45, borda de baixo 2 px, sem `translate`). Tudo derivado de `estiloDoBotao("painel", …)`.

- [ ] **Step 1: Testes vermelhos de `estiloDoBotao`** em `test/botao.test.ts`:
  - `estiloDoBotao("app", "principal", "padrao")` → `{ fundo: "#1a73c8", sombra: "#145a9b", texto: "#ffffff", altura: 56, raio: 16, relevo: 5, relevoTocado: 2, desce: 3 }` (`toMatchObject`).
  - `estiloDoBotao("app", "secundario", "medio")` → `{ fundo: "#ffffff", borda: "#e1e8ea", texto: "#1a73c8", altura: 44, raio: 14, relevo: 4 }`.
  - `estiloDoBotao("painel", "principal", "padrao")` → `{ altura: 40, raio: 10, relevo: 3, relevoTocado: 2, desce: 1, fonteTamanho: 15 }`; `compacto` → `{ altura: 32, raio: 8, fonteTamanho: 13 }`; `icone` → `{ altura: 32, relevo: 0 }`.
  - Para toda `v` de `["texto", "textoPerigo"]` nas duas plataformas: `relevo === 0`, `fundo === "transparent"`; `textoPerigo.texto === "#993029"`.
  - `perigo` cheio: `{ fundo: "#993029", sombra: "#6e1f1a", texto: "#ffffff" }`; `perigoContorno`: `{ fundo: "#ffffff", texto: "#993029" }`.
  - Para toda variação e todo tamanho: altura do app ≥ 44.
- [ ] **Step 2:** `npm -w @fila-saude/design run test` → FAIL (módulo inexistente).
- [ ] **Step 3:** criar o pacote e implementar `tokens.ts` e `botao.ts` com os valores das Global Constraints. Tabela de variações (cores) e tabela de densidades separadas; `estiloDoBotao` junta as duas e zera o relevo de `texto`, `textoPerigo` e `icone`.
- [ ] **Step 4:** teste vermelho de `css.test.ts`:
  - `gerarCss()` contém `.ds-btn-principal{` com `background:#1a73c8`, `.ds-btn-compacto{` com `min-height:32px`, e `.ds-btn-padrao:active:not(:disabled)` com `translateY(1px)`.
  - `readFileSync("tokens.css")` é igual a `gerarCss()` (mensagem: "rode npm run design:gen").
- [ ] **Step 5:** implementar `css.ts` e `scripts/gerar-css.ts` (roda com `tsx`, como os scripts da API); `npm run design:gen` gera `tokens.css`.
- [ ] **Step 6:** `npm -w @fila-saude/design run test` → PASS. `npm install` na raiz para ligar o workspace.
- [ ] **Step 7: Commit** `feat(design): shared tokens package with the button style and generated css`.

### Task 2: App — `Botao` do design system, migração e trava

**Files:**
- Modify: `apps/mobile/package.json` (dependência `"@fila-saude/design": "*"`)
- Modify: `apps/mobile/src/components/ui.tsx` (`COR`/`FONTE` reexportados do pacote; `Botao`; novos `AreaTocavel`, `ItemDeLista`, `Segmentado`; `Faixa` usa `Botao`; remove `LinkBotao`; `BotaoLigar` vira atalho de `Botao`)
- Modify (migração): `apps/mobile/src/app/*.tsx`, `apps/mobile/src/app/**/[*].tsx`, `apps/mobile/src/components/atendimento.tsx` — todo `tipo=` de `Botao` e todo `LinkBotao`; os `Pressable` de `app/conta.tsx` (linha do menu → `ItemDeLista`), `app/municipio.tsx` (município → `ItemDeLista`), `app/atendimentos.tsx` (`Seletor` → `Segmentado`), `components/atendimento.tsx` (`Tocavel` → `AreaTocavel`)
- Test: `apps/mobile/test/design-system.test.ts`

**Interfaces:**
- Consumes: `COR`, `FONTE`, `estiloDoBotao("app", …)`, `Variante`, `TamanhoApp`, `OPACIDADE_DESATIVADO` (Task 1).
- Produces (em `ui.tsx`):
  - `Botao({ texto, onPress, variante = "principal", tamanho = "padrao", icone?: LucideIcon, carregando = false, desativado = false })` — some `tipo` e `corTexto`. Mapa da migração: `primario`→`principal`, `secundario`→`secundario`, `perigo`→`perigoContorno`, `perigoCheio`→`perigo`, `branco`→`branco` (a tela "é a sua vez!" perde o `corTexto` verde: `branco` tem texto azul escuro `#0c2e4e`, conferido no print do Step 6). `LinkBotao` → `Botao variante="texto"`; `LinkBotao cor={COR.dangerInk}` → `variante="textoPerigo"`.
  - `BotaoLigar({ texto, numero, variante = "principal" })`.
  - `AreaTocavel({ rotulo: string; onPress: () => void; children; style? })` — área tocável sem cara de botão (cartão que abre a fila).
  - `ItemDeLista({ titulo, descricao?, esquerda?, selecionado?, carregando?, onPress })` — linha de menu ou de escolha, 76 px de altura mínima.
  - `Segmentado<T extends string>({ opcoes: { id: T; rotulo: string }[]; atual: T; mudar: (id: T) => void })` — o seletor de abas de `atendimentos.tsx`, igual na aparência.

- [ ] **Step 1: Trava vermelha** em `test/design-system.test.ts`: percorre `src/**/*.tsx` e falha se alguma linha tiver `<Pressable`, `TouchableOpacity` ou `TouchableHighlight` fora de `src/components/ui.tsx`. Exceções explícitas no teste, com o motivo: `src/components/mapa.tsx` e `src/components/mapa.native.tsx` ("marcadores do mapa não são botões"). Segundo caso: nenhum arquivo importa `LinkBotao`. Mensagem do erro lista arquivo:linha.
- [ ] **Step 2:** `npm run test:mobile` → FAIL listando `conta.tsx`, `municipio.tsx`, `atendimentos.tsx`, `atendimento.tsx` e os usos de `LinkBotao`.
- [ ] **Step 3:** reescrever `Botao` em `ui.tsx` sobre `estiloDoBotao`: borda de baixo `relevo` (tocado: `relevoTocado`, `marginTop: desce`), `numberOfLines={1}` e `ellipsizeMode="tail"` no texto, `minHeight` = altura (≥ 44 em `texto`), ícone à esquerda com a cor do texto, carregando = indicador + "aguarde…" e `disabled`. `Faixa` passa a renderizar `<Botao tamanho="medio" variante="secundario" …>` no lugar do `Pressable`.
- [ ] **Step 4:** criar `AreaTocavel`, `ItemDeLista`, `Segmentado` em `ui.tsx` copiando a aparência atual dos `Pressable` que substituem; migrar as telas pelo mapa acima; apagar `LinkBotao`.
- [ ] **Step 5:** `npm run test:mobile` → PASS (98 + a trava); `cd apps/mobile && npx tsc --noEmit` sem erro; `npx biome check apps/mobile` sem erro.
- [ ] **Step 6:** prévia web do app (Expo web, como na revisão da tela da fila) com prints de `boas-vindas`, `inicio`, `unidade/[id]`, `inscricao` e o cartão alocado, para conferir que nada mudou de lugar.
- [ ] **Step 7: Commit** `feat(mobile): one design-system button; no pressable outside the kit`.

### Task 3: Painel — `Button` do design system, cor da marca, migração e trava

**Files:**
- Modify: `apps/painel/package.json` (`"@fila-saude/design": "^1.0.0"`), `apps/painel/next.config.ts` (`transpilePackages` + `"@fila-saude/design"`)
- Modify: `apps/painel/app/globals.css` (`@import "@fila-saude/design/tokens.css";` depois do Tailwind; `--primary: var(--ds-acao)`; `--primary-500: var(--ds-acao)`, `--primary-600: var(--ds-acao-pressionado)`, `--primary-700: var(--ds-acao-sombra)`; `--ring: var(--ds-acao)`)
- Modify: `apps/painel/components/ui/button.tsx` (reescrito)
- Create: `apps/painel/components/ui/botao-de-escolha.tsx`
- Modify (migração): os 14 arquivos que importam `@/components/ui/button` (lista: `app/(painel)/{agendamento,equipe,estacao,estacoes,fila,servicos,sessoes,tvs,unidades}/page.tsx`, `app/(painel)/layout.tsx`, `components/{editor-de-horario,formulario-login,formulario,pagina}.tsx`), mais `components/ui/{alert-dialog,dialog,sheet}.tsx`, `app/tv/page.tsx`
- Test: `apps/painel/test/botao.test.tsx`, `apps/painel/test/design-system.test.ts`

**Interfaces:**
- Consumes: classes `.ds-btn-*` de `tokens.css` (Task 1).
- Produces:
  - `Button({ variante = "principal", tamanho = "padrao", carregando = false, icone?: LucideIcon, className?, ...props })` com `variante: Variante`, `tamanho: TamanhoPainel`. Classes: `cn("ds-btn", \`ds-btn-${variante}\`, \`ds-btn-${tamanho}\`, className)`. `carregando` → `disabled`, `aria-busy`, indicador e "Aguarde…". Rótulo com `truncate`. `className` só para layout (largura, margem, posição).
  - `BotaoDeEscolha({ selecionado: boolean; onClick; className?; children })` em `components/ui/` — cartão com `aria-pressed`, para as cores da triagem.
  - Mapa da migração: `variant="default"`→`variante="principal"`; `outline`/`secondary`→`secundario`; `ghost` (ações com ícone)→`variante="texto" tamanho="icone"`; `destructive` em "Não compareceu"/"Recusou"/"Excluir"→`perigoContorno`; `destructive` em "Encaminhar à emergência"→`perigo`; `success`→`sucesso`; `size="sm"`→`compacto`; `size="lg"`/sem tamanho→`padrao`; `icon`/`icon-sm`→`icone`.
  - Os `<button>` crus: `BotaoAdicionarLinha` → `Button variante="secundario" className="w-full"` com ícone `PlusIcon`; olho da `Senha` → `Button variante="texto" tamanho="icone"`; botão da TV → `Button variante="branco" className="h-24 px-12 text-4xl"`; cores da triagem → `BotaoDeEscolha`.

- [ ] **Step 1: Testes vermelhos** em `test/botao.test.tsx` (Testing Library, como `kit.test.tsx`):
  - `render(<Button>Alocar</Button>)` → o botão tem as classes `ds-btn`, `ds-btn-principal`, `ds-btn-padrao`.
  - `render(<Button variante="perigoContorno" tamanho="compacto">Recusou</Button>)` → `ds-btn-perigoContorno`, `ds-btn-compacto`.
  - `render(<Button carregando onClick={fn}>Alocar</Button>)`; clicar duas vezes → `fn` não é chamada; botão `disabled` e `aria-busy="true"`; texto "Aguarde…".
- [ ] **Step 2: Trava vermelha** em `test/design-system.test.ts`: percorre `app/**/*.tsx` e `components/**/*.tsx`; falha se houver `<button` fora de `components/ui/`, ou `variant=`/`size=` passados a `Button` (nomes antigos), listando arquivo:linha.
- [ ] **Step 3:** `npm run test:painel` → FAIL (os dois arquivos novos).
- [ ] **Step 4:** ligar o pacote (dependência, `transpilePackages`, `@import` no `globals.css`, `--primary` e a escala), reescrever `button.tsx`, criar `botao-de-escolha.tsx`.
- [ ] **Step 5:** migrar os arquivos pela tabela; nas telas da fatia 4, só o primeiro "Alocar" da sugestão fica `principal` (regra "uma principal por área").
- [ ] **Step 6:** `npm run test:painel` → PASS; `cd apps/painel && npx tsc --noEmit`; `npx biome check apps/painel` sem erros novos (os 8 de antes continuam).
- [ ] **Step 7:** prints (script `print-painel.mjs`, como na conversa) de `/fila`, `/estacao`, `/sessoes` e `/login` antes e depois, conferindo o azul novo e o relevo leve.
- [ ] **Step 8: Commit** `feat(painel): one design-system button, the app's brand blue, no raw buttons`.

### Task 4: API — o que a nova tela de Agendamento precisa

**Files:**
- Modify: `packages/schemas/fila.ts` (`alocacaoDaSessaoSchema`, `itemDeLigacaoSchema`, `listaDeEsperaDoServicoSchema`)
- Modify: `apps/api/infra/fila/agendamento.ts`
- Test: `apps/api/tests/integration/v1/painel/agendamento/agendamento.test.ts`

**Interfaces:**
- Produces (campos novos):
  - sugestão: `semApp: boolean` (entrada sem `responsavelId`); `motivos` **sem** o primeiro item (o risco), que já vem em `risco`.
  - lista de espera, cada sessão: `confirmadas: number`, `pendentes: number` (alocadas aguardando resposta); `ocupadas` continua.
  - lista de ligação, cada item: `alocadaEm: string` (ISO).

- [ ] **Step 1: Testes vermelhos** (no arquivo existente):
  - na sugestão, José ("sem app", criado sem conta) tem `semApp: true`; Ana (pelo app) `semApp: false`; o `motivos[0]` de Ulisses **não** é "urgente sugerido" e `motivos.at(-1)` continua `espera há N dias`.
  - em `/lista-espera`, a sessão `privadaId` mostra `{ ocupadas: 2, confirmadas: 1, pendentes: 1 }` no ponto em que o teste atual confere `ocupadas: 2` (Ulisses confirmou, Rosa ou Ana pendente).
  - em `/ligacao`, o item tem `alocadaEm` como ISO e anterior a `prazo`.
- [ ] **Step 2:** `VITEST_ARGS="tests/integration/v1/painel/agendamento" npm test` (em `apps/api`) → FAIL.
- [ ] **Step 3:** schemas e `agendamento.ts`: `motivos.slice(1)`; `semApp: e.responsavelId === null`; contagens por sessão com um `select estado, count(*) … group by sessao_id, estado` sobre as entradas das sessões listadas; `alocadaEm` do item.
- [ ] **Step 4:** o mesmo comando → PASS; `npm test` inteiro em `apps/api` → PASS (258 + os novos).
- [ ] **Step 5: Commit** `feat(api): scheduling view carries no-app flag, per-session answer counts and allocation time`.

### Task 5: Painel — Agendamento no caminho A e o contador no menu

**Files:**
- Modify: `apps/painel/lib/agendamento.ts`, `apps/painel/test/agendamento.test.ts`
- Rewrite: `apps/painel/app/(painel)/agendamento/page.tsx` (quebrar em `components/agendamento/{lista-de-sessoes,vagas-da-sessao,sugestao,pendencias}.tsx` se passar de ~250 linhas)
- Modify: `apps/painel/app/(painel)/layout.tsx` (ícone `CalendarCheckIcon` para `/agendamento`; contador), `apps/painel/lib/navegacao.ts` (ícone e o campo opcional `contador` no item)
- Create: `apps/painel/components/ui/segmentado.tsx` (controle segmentado do design system; os botões dele ficam em `components/ui/`, que a trava permite)

**Interfaces:**
- Consumes: campos novos da Task 4; `Button`/`BotaoDeEscolha` (Task 3); `quandoNoFuso`, `situacaoDoAlocado`, `textoDasVagas` (já em `lib/agendamento.ts`); `vespera` de `@fila-saude/domain`.
- Produces (em `lib/agendamento.ts`):
  - `barrasDeVagas(s: { vagas: number | null; confirmadas: number; pendentes: number }): ("confirmada" | "pendente" | "livre")[] | null` — `null` quando `vagas` é `null`.
  - `seloDoRisco(r: { nivel: string; confirmado: boolean }): { rotulo: string; tom: "alerta" | "neutro" | "perigo" }` — sugerido: "Urgente (app)"; confirmado: "Urgente". `urgente`/`muito_urgente`/`emergencia` → `alerta` (emergência `perigo`); o resto `neutro`.
  - `resumoDasPendencias(itens: ItemDeLigacao[], agora: number): { total: number; texto: string } | null` — `null` sem itens; texto "N pessoas para ligar · <nome> sem resposta há X h" com o mais antigo (`alocadaEm`); singular "1 pessoa para ligar".
  - `alocarAte(inicio: string, fuso: string): string` — "seg., 16/11" (véspera no fuso).
  - `Segmentado<T extends string>({ opcoes: { id: T; rotulo: string }[]; atual: T; mudar: (id: T) => void })` em `components/ui/segmentado.tsx` — mesmo nome e forma do `Segmentado` do app (Task 2).

- [ ] **Step 1: Testes vermelhos** em `test/agendamento.test.ts`:
  - `barrasDeVagas({ vagas: 4, confirmadas: 1, pendentes: 1 })` → `["confirmada", "pendente", "livre", "livre"]`; `vagas: null` → `null`.
  - `seloDoRisco({ nivel: "urgente", confirmado: false })` → `{ rotulo: "Urgente (app)", tom: "alerta" }`; `{ nivel: "rotina", confirmado: true }` → `{ rotulo: "Rotina", tom: "neutro" }`.
  - `resumoDasPendencias([], 0)` → `null`; com Bruno alocado há 30 h e Ana há 2 h → `{ total: 2, texto: "2 pessoas para ligar · Bruno Lima sem resposta há 30 h" }`.
  - `alocarAte("2026-11-17T16:00:00.000Z", "America/Sao_Paulo")` → `"seg., 16/11"`.
  - menu: `menuDoPainel` mantém "Agendamento" para `agendar` (teste existente) e o item tem ícone.
- [ ] **Step 2:** `npm run test:painel` → FAIL.
- [ ] **Step 3:** implementar as quatro funções.
- [ ] **Step 4:** reescrever a página no desenho A (design.md, "A nova tela de Agendamento"): cabeçalho com unidade e o `Segmentado` de serviços (`nome · aguardando`; vira `Selecao` quando houver mais de 4); faixa de pendências (`resumoDasPendencias`) com "Ver lista de ligação" abrindo `PainelLateral` com a lista de ligação; coluna da esquerda com as sessões (`barrasDeVagas`, livres, profissional, destacada a escolhida; vazia → "Nenhuma sessão privada planejada. Crie uma em Sessões."); à direita, as vagas (barras, "1 de 4", `alocarAte` ou o `motivo`) e os alocados com selo e as ações de resposta (`compacto`); embaixo a sugestão (`seloDoRisco`, "sem app", motivos, autolesão e faltas; só a primeira linha `principal`, as outras `secundario`). 409 do alocar continua trocando a vista pela atualizada.
- [ ] **Step 5:** contador no menu: o layout consulta `/v1/painel/unidades/<atual>/ligacao` a cada 60 s **só** para quem pode `alocar_confirmar_recusar_pelo_paciente` na unidade, e mostra o total no item (some com zero).
- [ ] **Step 6:** `npm run test:painel` → PASS; `npx tsc --noEmit`; biome sem erros novos.
- [ ] **Step 7:** `npm run dev:seed` e prints de `/agendamento` (1440 px e 1024 px) com o script; comparar com o protótipo A e corrigir diferenças.
- [ ] **Step 8: Commit** `feat(painel): scheduling as sessions list and session detail, with pending calls and menu counter`.

### Task 6: Fechamento

**Files:**
- Modify: `.specs/features/mvp-filas/roteiro-v01.md` (passos 2–8 da fatia 4 com a tela nova), `.specs/STATE.md`, `.specs/features/mvp-filas/decisoes-para-revisar.md` (seção "Design system (2026-11-16)": as quatro decisões do design.md e `textoPerigo`)

- [ ] **Step 1:** todas as suítes: `npm run test:design`, `test:domain`, `-w @fila-saude/schemas run test`, `test:painel`, `test:mobile`, `cd apps/api && npm test`; `npm run specs:check`.
- [ ] **Step 2:** roteiro da fatia 4 por HTTP (script da conversa) depois de `npm run dev:seed`.
- [ ] **Step 3:** atualizar os três documentos.
- [ ] **Step 4: Commit** `docs(specs): design system done; scheduling walkthrough updated`.

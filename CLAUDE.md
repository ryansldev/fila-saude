# Fila Saúde — guia para a IA

Central de filas para o atendimento público (UBS, policlínicas): o paciente espera em casa e a unidade chama na hora certa. Leia este arquivo primeiro; depois `.specs/STATE.md` (onde estamos) e `.specs/constitution.md` (princípios).

## Mapa

- `apps/api` — Fastify + Drizzle, Postgres multi-tenant (um banco por município). Rotas em `routes/v1/...`, regras de infra em `infra/`.
- `apps/painel` — Next 16 (equipe, estação, TV em `/tv`, QR do paciente em `/qr-paciente`). **Leia `node_modules/next/dist/docs/` antes de criar rota ou layout** (ver `apps/painel/AGENTS.md`).
- `apps/mobile` — app do paciente, Expo + Expo Router. **Não confie na memória sobre o Expo** (ver `apps/mobile/AGENTS.md`).
- `packages/domain` — regras puras (fila, chamada, triagem, contratos de estado).
- `packages/schemas` — zod compartilhado entre API, painel e app.
- `packages/design` — tokens, botões e o Dr. Lino (mascote) para painel e app.

## Comandos

- `npm run dev` (API :3333 e painel em `http://exemplo.localhost:3000`, senha `exemplo123`); `npm run dev:seed` recria os dados de exemplo; `npm run dev:mobile` (Metro para o build de desenvolvimento, `eas build --profile development --platform android`; `dev:mobile:go` para o Expo Go, que no Android não recebe push remoto). O `apps/mobile/google-services.json` fica fora do git: cada um usa o do seu Firebase; sem ele o app roda sem push.
- Testes: `npm test` (API; **pede o Docker Desktop**: `systemctl --user start docker-desktop`), `npm run test:domain`, `test:painel`, `test:mobile`, `test:design`, `test:web`, e `npm -w @fila-saude/schemas run test`.
- `npm run lint`; `npm run specs:check` (IDs, decisões, tabelas geradas); `npm run specs:gen` (tabelas das specs a partir de `packages/domain`); `npm run design:gen` (o `tokens.css` do painel); `npm run docs:openapi` (um `apps/api/openapi/v{n}.json` por versão da API, a referência; rode ao mudar uma rota).

## Regras

- **TDD sempre**: o teste falha antes do código. No app, só funções puras têm teste (`src/lib`).
- **Code review antes de cada commit** (v0.1 em diante): rode `/code-review` no diff, corrija os bugs confirmados (com teste, pelo TDD) e conte no fim o que ficou de fora e por quê.
- **Design system**: todo botão vem do kit. Painel: `components/ui/` (nenhum `<button>` fora dele, sem `variant=`/`size=`). App: `src/components/ui.tsx` (nenhum `<Pressable` fora dele). Os testes `design-system.test.ts` travam isso. Protótipos também usam as classes reais (`.ds-btn-*`).
- **Evite "Info · Info · Info"**: em geral, várias informações viram pílulas, ícones ou cartões. Há exceções, quando o "·" é o melhor (ex.: Agendamento, "Odontologia · 3", "Ana Souza · 68 anos"); o que o design aprovado da tela decidiu vale, e o review não aponta isso como erro.
- O painel é estilo iFood (relevo leve); o app, estilo Duolingo (minúsculas, relevo). O **Dr. Lino** fica sobre fundo branco ou o cinza-claro da aba "hoje" (o jaleco é transparente), sem caixa branca visível em volta; nunca em fundo colorido ou escuro. **Nomes de pessoas** sempre com a primeira letra maiúscula (`properName`/`firstName` em `packages/domain/src/names.ts`, usados no app, no painel e na API), mesmo no app em minúsculas.
- Textos para o usuário em português do Brasil; código (nomes, campos da API e do banco) em inglês pela tabela de [nomes no código](.specs/specs/nomes-no-codigo.md); commits em inglês (Conventional Commits, título até 100 caracteres, minúsculas) e **sempre com um corpo detalhado**: o que mudou, por quê e o que fica de fora, em itens curtos.
- Decisões que a IA toma sozinha vão para `.specs/features/mvp-filas/decisoes-para-revisar.md` (contexto, o que fez, alternativa, custo se errado).

## Onde fica cada coisa nas specs

- `.specs/specs/<capacidade>/spec.md` — as regras de hoje (RN-…), uma fonte por fato.
- `.specs/decisions.md` — decisões aprovadas (AD-…) e o porquê.
- `.specs/features/<feature>/` — o que está vivo: spec, design de cada tela, `roteiro-v01.md` (o que clicar), `decisoes-para-revisar.md`.
- `.specs/arquivo/` — planos já executados. Só para consulta; não é guia.

## Limpeza: sempre deixar o repositório sem lixo

Faz parte de terminar qualquer tarefa, no mesmo commit:

1. **Plano executado vai para `.specs/arquivo/planos/<feature>/`**, com os links acertados e o `npm run specs:check` limpo.
2. **`.specs/STATE.md` é curto** (até ~30 linhas): onde estamos, o que espera o usuário e o próximo passo. Nada de diário; o histórico está no `git log`. Ao terminar algo, **troque** a linha, não acrescente um parágrafo.
3. **Código sem uso sai**: componente, função, import ou arquivo que ficou órfão é apagado junto com a mudança.
4. **Temporários nunca no repositório**: prints, scripts de teste e rascunhos ficam no scratchpad da sessão.
5. **`.superpowers/`** (fora do git): ao terminar um plano, apague `.superpowers/sdd/<plano>/`; protótipos de `brainstorm/` de telas já construídas são apagados.
6. **Decisão provisória aprovada** pelo usuário sai de `decisoes-para-revisar.md` e entra em `decisions.md`.
7. Antes de dizer que terminou: code review feito e `git status` sem arquivo solto.

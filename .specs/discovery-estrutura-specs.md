# Discovery: estrutura das specs (SDD)

2026-11-10 · status: **decidido e aplicado** (AD-051): estrutura recomendada adotada, decisões num só `decisions.md`, constituição criada, migração feita de uma vez. Vale para o projeto inteiro, não só para `mvp-filas`.

## Problema

A sessão de 2026-11-10 fechou 31 decisões (PD-13, AD-020..AD-050) e passou por três revisões independentes (21, 14 e 12 achados). O custo veio da estrutura, não do raciocínio:

- **Uma decisão, 4 a 6 edições.** A regra mora no `STATE.md` (texto da AD), na `source.md` (RN, glossário, tabela 9.3, matriz, pseudocódigo, história), na tabela de suposições do `spec.md`, no `plan.md` e no `tasks.md`.
- **A maioria dos achados foi de propagação:** a decisão chegou à RN mas não à tabela 9.3, à matriz ou à task. Cópia desatualizada, não erro de regra.
- **A mesma regra em várias formas** dentro da `source.md` (texto, transição, permissão, pseudocódigo), sem nada que garanta que concordam.
- **Decisões como emendas.** "AD-050 substitui a AD-030 e a AD-034 e muda o efeito da AD-017": para saber a regra atual é preciso reconstruir o histórico.
- **Arquivo grande demais.** `source.md` tem ~800 linhas; a orientação comum de SDD é 1 a 3 páginas por spec, organizadas por área.
- **Contradição só aparece lendo.** As tabelas de estado e de permissões são markdown; nada as executa.

## O que o projeto precisa (critérios)

1. **Uma fonte por fato:** cada regra escrita uma vez; o resto só referencia o ID.
2. **Mudança barata:** decidir algo = editar a regra + registrar a decisão. Nada de propagação manual.
3. **Regra atual legível sem histórico:** a spec diz o que vale hoje; o porquê fica no log de decisões.
4. **Testável (TDD sempre):** cada regra vira teste com pouco esforço; as tabelas de estado e de permissões viram dados que o código e os testes usam.
5. **Legível por humano em português:** o usuário decide lendo; precisa de exemplos concretos.
6. **Bom para agentes:** arquivos pequenos e por área, para carregar só o necessário.
7. **Compatível com o que já existe:** `STATE.md` (handoff), `lessons.py`, `discovery-*.md`, `plan.md`/`tasks.md`.

## Opções avaliadas

| Opção | Ideia central | Atende bem | Fica devendo |
| --- | --- | --- | --- |
| **Atual** | `spec.md` + `source.md` grande + ADs no `STATE.md` | 5, 7 | 1, 2, 3, 4, 6 |
| **GitHub Spec Kit** | Constituição (princípios) + por feature `spec.md`, `plan.md`, `tasks.md` (+ `data-model.md`, `contracts/`); fluxo specify → clarify → plan → tasks → analyze | 5, 7; a **constituição** e o passo **analyze** (checagem de consistência) | 1, 3: a spec é por feature, não guarda o "estado atual" do sistema entre features |
| **Kiro** | `requirements.md` com histórias e critérios em **EARS** ("QUANDO … O SISTEMA DEVE …"), `design.md`, `tasks.md` | 4, 5: EARS deixa cada critério testável | 1, 3: mesmo problema de spec por feature |
| **OpenSpec** | `specs/<capacidade>/spec.md` = **verdade atual**; cada mudança em `changes/<nome>/` com proposta, tarefas e **deltas** (ADICIONADO / MODIFICADO / REMOVIDO); ao concluir, os deltas entram na spec e a mudança é arquivada | 1, 3, 6: separa "o que vale" de "o que mudou" | 2 se usado para toda microdecisão (uma pasta por decisão pesa) |
| **BDD (Dado/Quando/Então)** | Cenários concretos por regra | 4, 5 | Sozinho não organiza nada |
| **Spec executável** | Máquinas de estado, permissões e invariantes como **dados** no código; testes e documentação gerados a partir deles (como o model-based testing do XState) | 1, 4: contradição vira teste quebrado | 5 se for só código; precisa gerar a tabela legível |
| **MADR (registro de decisões)** | Uma decisão por registro curto: contexto, decisão, consequências, **status** (aceita, substituída por X) e um índice | 3: o porquê e o histórico ficam fora da spec | Só cobre decisões |

Nenhuma resolve sozinha. As que mais se encaixam se complementam: **OpenSpec** para separar estado atual de mudança, **EARS + Dado/Quando/Então** para o texto das regras, **MADR enxuto** para as decisões, **spec executável** para o núcleo de estados e permissões, e a **constituição** e a checagem automática do Spec Kit.

## Recomendação

```
.specs/
  constitution.md            princípios que não mudam por feature (hoje em source §1, memórias e CLAUDE.md)
  decisions/                 MADR enxuto: um arquivo curto por decisão + index.md (ID, título, status, muda quais RNs)
  specs/                     VERDADE ATUAL, por capacidade (1 a 3 páginas cada)
    glossario.md
    identidade/spec.md
    lista-espera/spec.md
    marcacao/spec.md         requisição pelo app, regulado, sessão pública e reserva
    fila-do-dia/spec.md      abertura, presença, pendência, ordem, atraso, estimativa
    chamada/spec.md          estação, pulos, triagem, encerramento, faltas
    excecoes/spec.md         cancelamento, remanejamento, lista parada
    contingencia/spec.md
    tv-e-avisos/spec.md
    permissoes/spec.md
    nao-funcionais/spec.md
  changes/                   só para mudança grande (uma feature nova); microdecisão não precisa
    <data-nome>/proposal.md, delta.md, tasks.md   → arquivada ao concluir
  features/mvp-filas/        o que é do MVP: spec.md (escopo e metas), plan.md, tasks.md, discovery-*.md
  STATE.md                   só o handoff (curto)
  LESSONS.md, lessons.json   como hoje
```

**Formato de cada regra** (em `specs/<capacidade>/spec.md`):

> **RN-CHAM-03 · Não compareceu**
> QUANDO o profissional tocar "Não compareceu" num paciente chamado, O SISTEMA DEVE: no 1º pulo do dia, mantê-lo presente atrás dos próximos K; no 2º, devolvê-lo a remoto; no 3º (somando as etapas), tirá-lo da fila e registrar falta. A recepção PODE anular essa falta, com motivo e auditoria.
> *Decisões: AD-006, AD-021.*
> - *Dado* Ana chamada com 0 pulos, *quando* o profissional toca "Não compareceu", *então* Ana fica presente atrás dos próximos K.
> - *Dado* Ana com 2 pulos (1 na triagem), *quando* é pulada de novo, *então* sai da fila com uma falta.

**Formato de cada decisão** (`decisions/AD-021.md`, 5 a 10 linhas):

> **AD-021 · 3º pulo sempre gera falta** · 2026-11-10 · aceita
> **Contexto:** o sistema não distingue quem foi embora sem "Vou sair" de quem não ouviu a chamada.
> **Decisão:** falta sempre; a recepção anula com motivo.
> **Muda:** RN-CHAM-03, RN-FALTA-02. **Substitui:** —.

Uma decisão substituída ganha `status: substituída por AD-0xx` e sai das specs: a spec só mostra o que vale.

**Núcleo executável (nível 3, entra na fase 1):** as transições da 9.3, a matriz de permissões e as invariantes viram dados em `packages/domain` (TS). O domínio usa esses dados, os testes percorrem cada transição e cada linha da matriz, e as tabelas em markdown das specs passam a ser **geradas** (`pnpm specs:gen`). Os cenários Dado/Quando/Então viram os testes da fase 1.

**Checagem automática (`scripts/specs-check.mjs` (`npm run specs:check`))**, em hook e no CI:
- todo ID citado (RN, AD, INV, T, D) existe;
- nenhuma decisão substituída é citada como vigente;
- toda RN é coberta por alguma task e por algum cenário;
- toda transição e toda linha da matriz têm teste (depois do nível 3);
- as tabelas geradas estão atualizadas.

**Fluxo de uma decisão:** editar a regra na spec da capacidade + criar o registro em `decisions/` + rodar a checagem. A task só muda se o escopo mudar.

## Migração

1. Commit do estado atual (feito: `2351692`).
2. Criar `constitution.md`, `specs/glossario.md` e um módulo piloto (`chamada`) no formato novo. Revisão do usuário.
3. Migrar os demais módulos, um por vez, a partir da `source.md` e já com as ADs aplicadas (sem "substitui" no texto).
4. Converter AD-001..AD-050 e PD-01..PD-13 em registros curtos com status e índice.
5. `tasks.md` passa a citar só IDs e o critério de aceite; sai a tabela de suposições do `spec.md` (o índice de decisões a substitui).
6. Script de checagem, incluindo uma verificação de migração: todo RN, INV e US da `source.md` antiga existe em algum módulo novo.
7. `source.md` vira arquivo histórico (ou é removida; o git guarda).
8. Nível 3 dentro da fase 1 (T1.x).

**Riscos:** perder conteúdo na migração (mitigado pelo passo 6 e pelo commit), esforço de 1 a 2 sessões, e duplicação temporária enquanto `source.md` e módulos convivem (mitigado migrando módulo a módulo e apagando a seção migrada).

## Decisões em aberto

1. Adotar a estrutura recomendada (specs por capacidade + decisões MADR enxutas + changes só para mudança grande)?
2. Separar `constitution.md`?
3. Decisões: um arquivo por decisão (`decisions/AD-021.md`) ou um só `decisions.md` com registros curtos?
4. Ordem: piloto `chamada` primeiro?

## Fontes

- [OpenSpec explicado (codemyspec)](https://codemyspec.com/blog/openspec-explained) e [referência OpenSpec (SparkFabrik)](https://playbook.sparkfabrik.com/ai-development/openspec-reference)
- [Kiro: conceitos de specs, EARS](https://kiro.dev/docs/specs/concepts)
- [GitHub Spec Kit: guia prático (Augment)](https://www.augmentcode.com/guides/github-spec-kit-practical-guide-sdd-workflow) e [análise (Bitovi)](https://wiki.at.bitovi.com/wiki/spaces/AIEnabledDevelopment/pages/1799847940/Spec+Kit+-+Analysis)
- [Boas práticas de SDD (Allegro, 2026)](https://blog.allegro.tech/2026/06/spec-driven-development-best-practices) e [intent-driven.dev](https://intent-driven.dev/knowledge/best-practices/)
- [Stately: testes a partir da máquina de estados](https://stately.ai/docs/testing) e [state-docs](https://github.com/plures/state-docs)
- [MADR](https://github.com/criscola/madr) e [GDS: registros de decisão](https://gds-way.digital.cabinet-office.gov.uk/standards/architecture-decisions.html)

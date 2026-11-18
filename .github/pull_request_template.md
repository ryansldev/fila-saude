<!--
Modelo de PR do Fila Saúde, a partir das seções recomendadas em
https://eng-practices.circle.com/docs/pull-request/sections (Circle), sem as que o GitHub já mostra
(revisores, "pronto para merge") e com as regras do CLAUDE.md no checklist.
Título: vira o commit da `main` no squash, então segue a regra dos commits: inglês, Conventional Commits,
minúsculas, até 100 caracteres (ex.: `feat: patient pre-registration with photos`). O commitlint não confere
o título. Apague as seções que não se aplicam.
-->

## Resumo

<!-- Em duas ou três frases: o que este PR entrega e para quem. -->

## Specs e tarefas relacionadas

<!-- Regras (RN-…), decisões (AD-…), tarefas (T…) e issues (`Closes #123`). -->

## O que muda e por quê

<!-- O que mudou, por que dessa forma e o que isso afeta. Em PR grande, diga por onde revisar. -->

## Tipo de mudança

- [ ] Funcionalidade nova
- [ ] Correção de bug
- [ ] Refatoração (sem mudar comportamento)
- [ ] Documentação ou specs
- [ ] Testes
- [ ] Outro:

## Como foi testado

- [ ] Testes de unidade
- [ ] Testes de integração (API, com o Docker)
- [ ] À mão, pelo roteiro (na v0.1: `.specs/features/mvp-filas/roteiro-v01.md`) ou pelos passos abaixo

<!-- Comandos e passos para quem revisa conferir. -->

## Capturas de tela

<!-- Se mexe em tela: antes e depois, no painel e no app. -->

## Dependências

<!-- Pacotes adicionados ou atualizados, e por quê. -->

## Deploy

- [ ] Tem migração de banco
- [ ] Pede variável de ambiente nova ou alterada
- [ ] Pede passo manual antes ou depois do deploy

<!-- Detalhe o que estiver marcado. -->

## Riscos e como reverter

<!-- O que pode dar errado e como desfazer com segurança. -->

## Fora do code review

<!-- Achados do `/code-review` que não foram corrigidos, e por quê. -->

## Decisões em aberto

<!-- Decisões tomadas sem o dono do produto, registradas em `decisoes-para-revisar.md`. -->

## Checklist

- [ ] TDD: o teste falhou antes do código
- [ ] `/code-review` no diff antes de cada commit; o que ficou de fora está em "Fora do code review"
- [ ] Botões do kit do design system (painel: `components/ui/`; app: `src/components/ui.tsx`)
- [ ] Textos para o usuário em português do Brasil; código em inglês pela tabela de nomes
- [ ] CI verde: lint, `specs:check`, commitlint e todas as suítes de teste (API, domínio, painel, app, design e
      schemas)
- [ ] Limpeza: plano executado em `.specs/arquivo/planos/<feature>/`; código sem uso apagado; decisão aprovada
      movida de `decisoes-para-revisar.md` para `decisions.md`; `.specs/STATE.md` atualizado; nada solto no
      repositório

## Próximos passos

<!-- O que vem depois deste PR. -->

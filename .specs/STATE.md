# STATE

Só onde estamos e o próximo passo; o histórico está no `git log`. Mantenha curto (ver "Limpeza" no `CLAUDE.md` da raiz).

## Onde estamos (2026-11-18)

- **Branch `feat/v0.1`, no [PR #33](https://github.com/ryansldev/fila-saude/pull/33):** fatias 0 a 4 prontas (pública, na unidade, triagem, privada), [roteiro](features/mvp-filas/roteiro-v01.md) clicado e CI verde em 2026-11-18 (reinicie `npm run dev:mobile` antes de clicar). Falta a fatia 5 (pré-cadastro).
- **Revisão de UI com o design system em andamento.** Feitas no painel: Agendamento, Fila do dia, QR de entrada e unidade no menu, Estação (com "Compareceu"), TV. No app: página da unidade, entrar, criar conta, aba "hoje" (bilhete), mapa das unidades, inscrição (com a relação para outra pessoa). Designs em [features/design-system/](features/design-system/).
- **Código em inglês** pela tabela de [nomes no código](specs/nomes-no-codigo.md); telas e specs em português. Migrações recriadas do zero (NC2); o banco de dev já está no conjunto novo (2026-11-18).
- **Code review das fatias 0 a 4 feito em duas rodadas (2026-11-17)**, com os achados corrigidos; daqui em diante, review antes de cada commit.
- **Testes (2026-11-18):** API 363, domínio 369, painel 171, app 150, schemas 76, design 9; lint limpo.

## Esperando você

- **Merge do [PR #33](https://github.com/ryansldev/fila-saude/pull/33)** (só você faz).
- Revisar as decisões provisórias em [decisoes-para-revisar](features/mvp-filas/decisoes-para-revisar.md) (I1–I8, I10, DS, QU, ES, TV, AU, EN, CA, HO, IN, NC, CP). Tentativas de login e captcha prontos (AD-062 a AD-065; valores de partida, a reajustar com o piloto). **RV7** (80+ e os outros grupos legais) pede sua decisão.
- **CA1:** e-mail obrigatório no cadastro, opcional ou fora? (muda a API).
- **Turnstile:** widget criado (2026-11-18); as chaves estão no seu cofre. No deploy de produção, `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` na API, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no painel e `EXPO_PUBLIC_TURNSTILE_SITE_KEY` no app. Em dev seguem as chaves de teste.
- **G6:** push no celular de verdade pede um projeto EAS (conta da empresa na Expo) e um build de desenvolvimento.

## Próximo passo

Depois do merge do PR #33, numa branch nova (nada novo entra na `feat/v0.1`): seguir a revisão de UI do app, a lista de unidades. Na revisão de cada tela, tirar os "·" que o review apontou e que nenhum design aprovado usa: lista de unidades e mapa web no app, cartão e gaveta de cancelamento; Unidades, Sessões e Equipe no painel. Depois, o plano da fatia 5 (pré-cadastro). Anotado para depois: o questionário sem cara de dispositivo médico (junto do D8 e do D10).

## Fora do código

- **Parceiro do piloto:** contatos, sem acordo. Pré-requisito de D4, D5, D6, D7, D9.
- **Discoveries:** D1 SSE no app, D2 notificação ao vivo, D3 TV smart; D4 operação da UBS; D5 jurídico e LGPD; D6 regulação e CADSUS; D7 contratação; D8 validação clínica do questionário; D9 teste de uso do protótipo; D10 publicação nas lojas. Detalhes em [tasks](features/mvp-filas/tasks.md#discoveries-e-spikes).
- **Licença (AD-052):** AGPL-3.0 aplicada; falta CLA no GitHub e revisão do advogado (D5/D7).
- **Adiado:** extensão SISREG, depois do piloto, junto com a integração da regulação (D6).

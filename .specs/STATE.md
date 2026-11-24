# STATE

Só onde estamos e o próximo passo; o histórico está no `git log`. Mantenha curto (ver "Limpeza" no `CLAUDE.md` da raiz).

## Onde estamos (2026-11-24)

- **v0.1 na `main`** (PR #33, fatias 0 a 4). Falta a fatia 5 (pré-cadastro).
- **Docs públicas da API na `main`** (PR #34; AD-066 a AD-069): guias e a referência da API v1 em `/docs` do `apps/web`, gerada das rotas (`npm run docs:openapi`).
- **Revisão de UI com o design system em andamento.** Feitas no painel: Agendamento, Fila do dia, QR de entrada e unidade no menu, Estação (com "Compareceu"), TV. No app: página da unidade, entrar, criar conta, aba "hoje" (bilhete), mapa das unidades, inscrição (com a relação para outra pessoa). Designs em [features/design-system/](features/design-system/).
- **Código em inglês** pela tabela de [nomes no código](specs/nomes-no-codigo.md); telas e specs em português. Migrações recriadas do zero (NC2); o banco de dev já está no conjunto novo (2026-11-18).
- **Testes (2026-11-24):** API 462, domínio 464, painel 171, app 173, schemas 76, design 9; lint limpo. Review antes de cada commit.

## Esperando você

- Clicar no [roteiro](features/mvp-filas/roteiro-v01.md) os formulários com erro por campo (cadastro, login, unidade, sessão), porque todas as rotas mudaram por dentro; revisar DA1 a DA12 em [decisoes-para-revisar](features/mvp-filas/decisoes-para-revisar.md).
- Revisar as decisões provisórias em [decisoes-para-revisar](features/mvp-filas/decisoes-para-revisar.md) (I1–I8, I10, DS, QU, ES, TV, AU, EN, CA, HO, IN, NC, CP). Tentativas de login e captcha prontos (AD-062 a AD-065; valores de partida, a reajustar com o piloto). Alinhamento de 2026-11-19: aprovadas na AD-070; as que você comentou (G9/G10, H4, I10, E3, P1, DA1…) estão anotadas no topo do arquivo, sem mudança no código.
- **Turnstile:** widget criado (2026-11-18); as chaves estão no seu cofre. No deploy de produção, `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` na API, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no painel e `EXPO_PUBLIC_TURNSTILE_SITE_KEY` no app. Em dev seguem as chaves de teste.
- **Push no Android na `main`** (PR #35; AD-071 a AD-074). Rodar `npm run db:migrate`. **Na produção, a API só depois do app novo instalado** (o canal do push mudou para `avisos`). iOS pede o `bundleIdentifier` e a conta da Apple.
- **RV7, perder a vez e queda percebida na `main`** (PRs #36 a #38; AD-075, AD-076). Confirmar a leitura da lei com o advogado (D5). Fonte do sinal na `main` (PR #39); sinal parado julgado por fonte e no giro (PR #40, QP7) esperando revisão.

## Próximo passo

Pausa, fechar a estação e alerta de sinal ([plano](features/mvp-filas/plano-pausa-e-fechar.md)), em PRs pequenas: o domínio (AD-077, branch `feat/station-pause`) espera revisão; depois API, painel, app. Depois, a revisão de UI do app (lista de unidades, tirar os "·" que nenhum design aprovado usa) e o plano da fatia 5 (pré-cadastro).

## Fora do código

- **Parceiro do piloto:** contatos, sem acordo. Pré-requisito de D4, D5, D6, D7, D9.
- **Discoveries:** D1 WebSocket no app, D2 notificação ao vivo, D3 TV smart; D4 operação da UBS; D5 jurídico e LGPD; D6 regulação e CADSUS; D7 contratação; D8 validação clínica do questionário; D9 teste de uso do protótipo; D10 publicação nas lojas. Detalhes em [tasks](features/mvp-filas/tasks.md#discoveries-e-spikes).
- **Licença (AD-052):** AGPL-3.0 aplicada; falta CLA no GitHub e revisão do advogado (D5/D7).
- **Adiado:** extensão SISREG, depois do piloto, junto com a integração da regulação (D6).
- **Google Maps no Android, fora do v0.1** (G12): sem a chave, a aba de unidades mostra só a lista (o suporte ao mapa fica no código). Para ligar: pré-pagamento no Google Cloud (ou conta da empresa), chave restrita a `br.com.filasaude.app` com o SHA-1 `08:8F:08:50:CC:01:9D:66:33:97:0B:B3:2D:14:D3:C1:EB:DC:17:2F`, em `GOOGLE_MAPS_ANDROID_API_KEY` (EAS e `apps/mobile/.env.local`).

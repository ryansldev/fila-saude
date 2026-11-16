# STATE

Só onde estamos e o próximo passo; o histórico está no `git log`. Mantenha curto (ver "Limpeza" no `CLAUDE.md` da raiz).

## Onde estamos (2026-11-16)

- **Branch `feat/v0.1`**, sem PR. v0.1 rodando local com dados de exemplo: fatias 0 a 4 prontas (pública, na unidade, triagem, privada); falta a fatia 5 (pré-cadastro).
- **Revisão de UI com o design system em andamento.** Feitas no painel: Agendamento, Fila do dia, QR de entrada e unidade no menu, Estação (com "Compareceu"), TV. No app: página da unidade, entrar, criar conta, aba "hoje" (bilhete), mapa das unidades. Designs em [features/design-system/](features/design-system/).
- **Testes (2026-11-16):** API 270, domínio 356, painel 151, app 127, schemas 67, design 9.

## Esperando você

- Clicar o [roteiro](features/mvp-filas/roteiro-v01.md) no navegador e no celular (inclui ler o QR novo com um celular de verdade). Reinicie `npm run dev:mobile` antes.
- Revisar as decisões provisórias em [decisoes-para-revisar](features/mvp-filas/decisoes-para-revisar.md) (I1–I10, DS, QU, ES, TV, AU, EN, CA, HO). **RV7** (80+ e os outros grupos legais) pede sua decisão.
- **CA1:** e-mail obrigatório no cadastro, opcional ou fora? (muda a API).
- **G6:** push no celular de verdade pede um projeto EAS (conta da empresa na Expo) e um build de desenvolvimento.

## Próximo passo

Seguir a revisão de UI do app: inscrição ("para quem é o atendimento?" e o questionário), depois a lista de unidades. Depois, o plano da fatia 5 (pré-cadastro).

## Fora do código

- **Parceiro do piloto:** contatos, sem acordo. Pré-requisito de D4, D5, D6, D7, D9.
- **Discoveries:** D1 SSE no app, D2 notificação ao vivo, D3 TV smart; D4 operação da UBS; D5 jurídico e LGPD; D6 regulação e CADSUS; D7 contratação; D8 validação clínica do questionário; D9 teste de uso do protótipo; D10 publicação nas lojas. Detalhes em [tasks](features/mvp-filas/tasks.md#discoveries-e-spikes).
- **Licença (AD-052):** AGPL-3.0 aplicada; falta CLA no GitHub e revisão do advogado (D5/D7).
- **Adiado:** extensão SISREG, depois do piloto, junto com a integração da regulação (D6).

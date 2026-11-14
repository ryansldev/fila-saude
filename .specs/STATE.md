# STATE

Só o handoff entre sessões. Princípios: [constitution.md](constitution.md). Regras: [specs/](specs/). Decisões: [decisions.md](decisions.md). Checagem: `npm run specs:check`.

## Onde estamos (2026-11-13)

- **Branch:** `feat/v0.1` (tudo até aqui: 1A, 1B Tasks 1–10, fase 2 Tasks 1–8), sem PR.
- **Specs reorganizadas** (AD-051): a antiga `features/mvp-filas/source.md` virou as specs por capacidade em `specs/`, as ADs saíram deste arquivo para `decisions.md` (AD-001..AD-051; PD-01..PD-31 no plan), e `scripts/specs-check.mjs` confere IDs, decisões substituídas e cobertura.
- **MVP:** `features/mvp-filas/` com `spec.md` (escopo e histórias), `plan.md` (PD-01..PD-33), `tasks.md` (47 tasks em 8 fases, TDD, discoveries D1–D10).
- **Protótipo:** revisões 1–4 construídas e verificadas.

## Próximo (2026-11-11)

**Trilha da v0.1** (PD-32, PD-33; [tasks](features/mvp-filas/tasks.md#trilha-da-v01-2026-11-11)): v0.1 do sistema real, rodando local com dados de exemplo (ainda não pronta para produção), em fatias verticais: 0 Base → 1 Pública básica → 2 Na unidade → 3 Triagem → 4 Privada → 5 Pré-cadastro → roteiro.

- **Fase 1A** concluída, com a revisão final e as correções (domínio, 234 testes).
- **Fase 1B:** Tasks 1–10 prontas. As Tasks 15–18 entram na fatia 0; 11–14 ficam para depois da v0.1.
- **Fase 2:** Tasks 1–8 prontas e juntadas (fatia 0, Task 1).
- **Fatia 0 concluída (2026-11-12):** Tasks 1–20 em `feat/v0.1`, em modo rápido (sem revisão por task; ver V1–V5 em [decisoes-para-revisar](features/mvp-filas/decisoes-para-revisar.md#fatia-0-da-v01-execução-rápida-2026-11-12)). API 159 testes, painel 54, schemas 57. `npm run dev:seed` + `npm run dev` → `http://exemplo.localhost:3000/login` (senha `exemplo123`). Verificado por HTTP (login, telas respondendo, re-semear com a API no ar); falta o clique no navegador do Step 5 da Task 20.
- **Revisão da fatia 0 (2026-11-12, feedback do usuário):** endereço estruturado + CNES da unidade; [discovery de papéis](features/mvp-filas/discovery-papeis-ubs.md) → perfis viraram ocupação por unidade + funções de gestão (SMS, Regulação, Gerente da UBS) + permissão "Agendar"; RN-PERF-04 (quem cadastra quem) e RN-PERF-05 (risco é do enfermeiro). Provisórios E1–E6 em decisoes-para-revisar. Testes da API na porta 3334 (rodam com `npm run dev` no ar).
- **Fatia 1 concluída (2026-11-12):** [plano](features/mvp-filas/plano-fatia-1-publica.md), modo rápido; provisórios F1–F10 em [decisoes-para-revisar](features/mvp-filas/decisoes-para-revisar.md#fatia-1-da-v01-2026-11-12). Fila do dia como `DiaSessao` em jsonb com trava pela sessão (PD-43); abrir/encerrar e presença no painel; estação de chamada; rotas do app (agenda, inscrição, "minhas"); app Expo em `apps/mobile` (login por token bearer). React 19.3 no monorepo. API 189 testes, painel 74, domínio 331, mobile 9. [Roteiro](features/mvp-filas/roteiro-v01.md) executado por HTTP; falta o clique no navegador e no celular.
- **Revisão da fatia 1 (2026-11-12, seu pedido):** presença pelo QR rotativo (segredo por sessão, link `filasaude://check-in`, câmera do app ou do celular), recepção só para pendências, com a conta verificada na conferência; Fila do dia só para quem tem ação dela na unidade. Provisórios Q1–Q5 e F1/F2 revistos em decisoes-para-revisar. API 195 testes, painel 75, mobile 12.
- **Redesign do app (2026-11-13):** app do paciente no design (Nunito, mascote, boas-vindas, textos em minúsculas), commitado.
- **Fatia 2 concluída (2026-11-13):** [plano](features/mvp-filas/plano-fatia-2-na-unidade.md), modo rápido; provisórios G1–G9 em [decisoes-para-revisar](features/mvp-filas/decisoes-para-revisar.md#fatia-2-da-v01-2026-11-13). TV pareada por código (`/tv` e "TVs" no painel) com chamadas, rechamadas, contadores, QR, som e fila de anúncios; "Vou sair" no app; outbox `aviso` com "sua vez", "pulado", "saia de casa" e "venha agora", varredura a cada minuto dentro da API e envio pela Expo; app registra o token de push. API 206 testes, painel 78, domínio 331, schemas 61, mobile 15. [Roteiro](features/mvp-filas/roteiro-v01.md#fatia-2--na-unidade) executado por HTTP.
- **Revisão de todas as fatias (2026-11-13, seu pedido):** ~90 achados de quatro revisores; os confirmados corrigidos com teste (CPF e nascimento validados, estados do app honestos, sessões sempre encerráveis, uso indevido de CPF fechado, painel e TV estáveis). API 221, painel 92, domínio 336, schemas 63, mobile 25. Ver [revisão](features/mvp-filas/decisoes-para-revisar.md#revisão-de-todas-as-fatias-2026-11-13): RV1–RV6 provisórios, **RV7–RV11 pedem sua decisão**.
- **Precisa de você:** G6, push no celular de verdade pede um projeto EAS (conta da empresa na Expo) e um build de desenvolvimento.
- **Próximo passo:** clicar o roteiro no navegador (TV com som) e no celular; depois o plano da fatia 3 (triagem). CARRY da fatia 0: RN-PIORA-01.

## Pendências fora do código

- **Parceiro do piloto:** há contatos, sem acordo. Pré-requisito de D4, D5, D6, D7, D9.
- **Discoveries:** D1 SSE no app, D2 notificação ao vivo, D3 TV smart (técnicos); D4 operação da UBS (com a entrevista de linha de base e a pergunta sobre conferência na chamada); D5 jurídico e LGPD; D6 regulação e CADSUS; D7 contratação; D8 validação clínica do questionário; D9 teste de uso do protótipo; D10 publicação nas lojas. Detalhes em [tasks](features/mvp-filas/tasks.md#discoveries-e-spikes).
- **Licença (AD-052):** AGPL-3.0 aplicada; falta CLA no GitHub e revisão do advogado (D5/D7).
- **Adiado:** extensão SISREG (risco vindo do SISREG, sem classificação própria): depois do piloto, junto com a integração da regulação (D6).

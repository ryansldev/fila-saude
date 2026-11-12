# Fatia 1 da v0.1 — Pública básica

> Modo rápido (2026-11-12): execução direta na sessão principal, TDD com um arquivo de teste por recurso e só os casos principais, sem revisão por task. Atalhos em [decisoes-para-revisar](decisoes-para-revisar.md#fatia-1-da-v01-2026-11-12).

**Goal:** paciente se cadastra no app, vê a agenda, responde o questionário e se inscreve numa sessão pública; o painel abre a sessão; o app mostra posição e tempo (consulta a cada ~3 s); a estação chama, rechama, finaliza e marca "não compareceu"; o app mostra "sua vez"; o painel encerra a sessão.

**Tasks do backlog:** T3.1 (sem push e sem recuperação), T3.2 (agenda lida do município, sem projeção no central), T3.3 (sem captcha), T3.4 (abertura por botão, consulta periódica), T3.7 (sem mini-janela e modo celular), T3.9 (sem lembrete no horário de fim).

**Architecture:** a fila do dia é o `DiaSessao` do domínio, gravado inteiro numa tabela `dia_sessao` (jsonb) ao lado da `sessao`. Toda operação da fila trava a linha da sessão (`SELECT … FOR UPDATE`), lê o dia e as entradas, chama a função do domínio e grava o dia, as entradas e a sessão na mesma transação (com auditoria quando vem do painel). Duas estações chamando ao mesmo tempo ficam em série na trava e recebem pacientes diferentes (INV-04, L-003). O app do paciente é Expo (`apps/mobile`), autenticado pelo cookie da central (PD-34), e lê o estado num endpoint com o formato que o SSE terá (PD-33).

## Decisões desta fatia

| ID | Decisão | Por quê | Custa se errado |
| --- | --- | --- | --- |
| PD-43 | **Fila do dia como jsonb (`dia_sessao.dia`)**, um documento por sessão, trava pela linha da `sessao` | O domínio já opera sobre o `DiaSessao` inteiro; sem mapeamento item a item | Médio: consultas por item (métricas, T8.8) pedem extrair do jsonb ou normalizar depois |
| PD-44 | **Sessão sem `dia_sessao` está planejada**; o dia é montado na hora (serviço, estações da sessão, config efetiva) e gravado na abertura | Nada a criar ao cadastrar a sessão | Baixo |
| PD-45 | **Rotas do app no caminho** (`/v1/municipios/:slug/…`, PD-15): `GET agenda`, `POST sessoes/:id/inscricoes`, `GET minhas` (entradas do paciente com a estimativa) | Formato já decidido | Baixo |
| PD-46 | **Estação na v0.1:** quem opera escolhe a estação na tela; ressalva "acolhimento na triagem" = estação de etapa triagem, "atendimento" = etapa atendimento | Sem login por estação ainda | Baixo |

## Tasks (TDD em todas: teste vermelho → código → verde → commit)

1. **Domínio — RN-CHAM-01 (CARRY da fatia 0):** "Chamar próximo" sem elegível finaliza o chamado em aberto e libera a estação, devolvendo `nenhum_elegivel` só quando não havia chamado.
2. **Repositório da fila** (`infra/fila/dia.ts`, tabela `dia_sessao`): `naSessao(tx, sessaoId, fn)` trava, monta ou lê o dia, roda `fn` e grava dia, entradas tocadas e `ocupadas`. Teste de infra: duas transações em paralelo não perdem atualização.
3. **Painel — abrir e encerrar** (`POST /v1/painel/sessoes/:id/abrir|encerrar`, ação de sessão) e `GET /v1/painel/sessoes/:id/fila` (senhas, estados e etapa; sem dado clínico para quem não precisa).
4. **Estação** (`GET /v1/painel/estacoes/:id/operacao`, `POST …/chamar|rechamar|finalizar|nao-compareceu`, `operar_chamadas` com as ressalvas por etapa). Teste com duas estações chamando ao mesmo tempo.
5. **App na API:** `GET /v1/municipios` (central), `GET /v1/municipios/:slug/agenda`, `POST /v1/municipios/:slug/sessoes/:id/inscricoes`, `GET /v1/municipios/:slug/minhas`. Recusas: duplicada, privada, já na lista do serviço (AD-032), emergência; lotada vai para a reserva (S2).
6. **Painel — telas:** sessões com Abrir/Encerrar e a fila; tela `/estacao`.
7. **`apps/mobile` (Expo):** cadastro e login na central, escolha do município, agenda, "para quem é", questionário com emergência → 192 e apoio CVV/SAMU, inscrição, tela da vez (consulta a cada 3 s). Lógica testada com Vitest; telas sem teste de layout.
8. **Seed e roteiro:** sessão pública de hoje no `exemplo`; trecho da fatia 1 no roteiro, executado à mão uma vez.

## Fora desta fatia

Push, recuperação de senha, captcha, abertura automática no worker, SSE, mini-janela e modo celular da estação, lembrete de encerramento, TV e check-in (fatia 2), triagem pela estação (fatia 3; o domínio já aceita, a tela não mostra o risco).

# Fatia 2 da v0.1 — Na unidade

> Modo rápido, como a fatia 1: execução direta na sessão principal, TDD com um arquivo de teste por recurso e só os casos principais, sem revisão por task. Atalhos em [decisoes-para-revisar](decisoes-para-revisar.md#fatia-2-da-v01-2026-11-13).

**Goal:** a TV da sala de espera é pareada pelo admin e mostra a chamada atual com som, as últimas chamadas, os contadores por serviço e o QR de entrada; o paciente toca "Vou sair" no app; o paciente recebe push de "saia de casa", "venha agora", "sua vez" e "você foi pulado".

**Tasks do backlog:** T2.6 (pareamento), T3.5 (TV em funcionamento, sem D3), T3.6 (o que faltava: "Vou sair"; o check-in e a recepção vieram na revisão da fatia 1), T3.8 com T2.4 (outbox, varredura e envio por Expo).

**Architecture:** a TV é uma página do painel (`/tv`, no subdomínio do município) que se registra na API como dispositivo (código de 6 dígitos + token guardado no navegador) e consulta `GET /v1/tv/tela` a cada 2 s, como o app (PD-33). O admin vincula o código a uma unidade. A fila de anúncios e o som ficam no navegador, numa função pura testada. Os avisos ao paciente nascem dos eventos do domínio: `naSessao` grava, na mesma transação do dia, uma linha na tabela `aviso` (outbox) para cada evento que vira push, com chave única por evento para sair uma vez só. Uma varredura por minuto, por município e com trava consultiva, gera os avisos que dependem do tempo ("saia de casa", "venha agora") e envia os pendentes pelo serviço de push da Expo, com nova tentativa.

## Decisões desta fatia

| ID | Decisão | Por quê | Custa se errado |
| --- | --- | --- | --- |
| PD-47 | **TV como dispositivo:** tabela `tv` no município (código, hash do token, unidade, pareada/revogada, último sinal). Sem login de pessoa; o token do navegador é a credencial | RN-TV-01/02 sem sessão de usuário na TV | Baixo |
| PD-48 | **TV por consulta a cada 2 s** (sem SSE, D1/D3 abertos) | Mesmo caminho do app na v0.1 | Atraso de até 2 s no anúncio |
| PD-49 | **Outbox `aviso` no município**, chave única `(tipo, entrada, etapa/evento)`; tokens de push do paciente na central (`dispositivo_push`) | O evento e o aviso entram juntos na transação; nunca sai duas vezes | Baixo |
| PD-50 | **Varredura dentro do processo da API** (intervalo de 60 s, `pg_try_advisory_lock` por município), desligada nos testes; os testes chamam a função | Um processo só para rodar local | Médio: em produção vira processo próprio (T2.4 completa) |

## Tasks (TDD em todas: teste vermelho → código → verde → commit)

1. **"Vou sair"** (`POST /v1/municipios/:slug/entradas/:entradaId/vou-sair`, só a conta responsável) e o botão no app quando presente.
2. **Pareamento da TV:** `POST /v1/tv` (registra, devolve código e token), `GET /v1/tv/tela` (pareando ou a tela da unidade), `POST /v1/painel/unidades/:id/tvs` (vincula pelo código), `GET` (lista com online), `DELETE /v1/painel/tvs/:id` (revoga). Só `configurar_servicos_sessoes_estacoes_tv`.
3. **Tela da TV na API:** chamada atual e últimas (senha e destino, nunca nome), contadores por serviço (presentes e a caminho), QR de entrada; só da unidade pareada.
4. **Painel:** `/tv` (pareamento, "iniciar painel", fila de anúncios com destaque da unidade, som de dois tons, "reconectando…") e a lista de TVs na unidade (parear, revogar, online).
5. **Outbox e eventos:** tabela `aviso`; `naSessao` aceita eventos e grava os que viram push ("chamado" → sua vez, "pulado"); textos sem dado clínico (RN-NOT-01).
6. **Varredura e envio:** `varrerMunicipio` (saia de casa e venha agora pelo domínio, depois envia os pendentes com nova tentativa); enviador Expo trocável no teste; registro do token (`PUT /v1/paciente/push`).
7. **App:** pedir permissão e registrar o token (expo-notifications); seed e roteiro da fatia 2.

## Fora desta fatia

SSE (D1), teste em smart TV (D3), notificação ao vivo (D2), avisos de alocação, reserva e requisição (fatias 4–5), WhatsApp (RN-NOT-02), processo próprio do worker com materialização de séries.

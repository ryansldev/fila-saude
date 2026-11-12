# Plan: MVP Filas UBS/Policlínicas

2026-11-10 · status: **rascunho para revisão**

Spec: [spec.md](spec.md) (escopo e histórias) e as [specs por capacidade](../../specs/) (RN-*, INV-*, RNF-*, transições, permissões). Decisões de produto em [decisions.md](../../decisions.md); princípios na [constituição](../../constitution.md). Anexos: [discovery-identidade.md](discovery-identidade.md) (decidido), [discovery-hospedagem.md](discovery-hospedagem.md) (MVP e piloto decididos, PD-12; longo prazo no D7) e [discovery-regulacao.md](discovery-regulacao.md) (MVP decidido, AD-026; piloto a confirmar).

## 1. Decisões de arquitetura

| ID | Decisão | Por quê |
| --- | --- | --- |
| PD-01 | **App do paciente em Expo** (React Native, Expo Router), em `apps/mobile` | Android e iOS com um código só em TS; câmera (QR e fotos) e push prontos; reaproveita `packages/*` |
| PD-02 | **Push pelo Expo Push** (FCM e APNs por baixo) | Gratuito e integrado ao Expo |
| PD-03 | **Multi-tenant desde o início: uma API única, com um banco Postgres isolado por município** e um banco central | RNF-DADOS-01 e LGPD; o mesmo código roda com um tenant só na infra da prefeitura |
| PD-04 | **Município do web por subdomínio** (`<municipio>.filasaude.com.br`); o app roteia pela unidade, via catálogo central | O login do painel já nasce no tenant; depois do piloto, o `fila.<municipio>.gov.br` do gov.br aponta para o mesmo endereço |
| PD-05 | **better-auth em duas configurações**: central para pacientes (CPF como username, plugin Expo) e uma por tenant para o painel (criada sob demanda, em cache). Perfis e escopo em tabela própria | Contas de servidores municipais ficam no banco do município |
| PD-06 | **Identidade por nível de confiança** (AD-017): a recepção verifica no 1º check-in; gov.br depois do piloto | Lançar sem depender da prefeitura |
| PD-07 | **Tempo real por SSE**, com **LISTEN/NOTIFY** do Postgres entre as instâncias da API; ações por HTTP | Fluxo só de ida; HTTP comum passa pelo firewall municipal; reconexão nativa; sem Redis |
| PD-08 | **Regras em `packages/domain`**: TS puro, sem banco nem relógio próprio, reescrito a partir do `prototype/js/engine.js`, com os 51 testes portados antes | As regras já validadas viram aceite; a API só carrega, aplica e grava |
| PD-09 | **`apps/painel`**: Next com `/painel`, `/estacao` e `/tv` no subdomínio do tenant; a landing segue em `apps/web` | Separa a área autenticada do site público |
| PD-10 | **Recorrência RFC 5545** (lib `rrule`): a série guarda DTSTART/DTEND/RRULE/EXDATE/RDATE; as ocorrências viram sessões numa janela móvel de 90 dias | Alocação, vagas e fila sempre apontam para uma linha real |
| PD-11 | **Worker com varredura a cada minuto** por tenant, com consultas idempotentes; **push por tabela de saída** (outbox) | Não perde nada se cair; não reagenda quando um horário muda; ~8 consultas/s com 100 tenants |
| PD-12 | **Piloto em duas VPS nossas, no Brasil** (revista em 2026-11-10; [discovery-hospedagem.md](discovery-hospedagem.md), [discovery-preco.md](discovery-preco.md)): **VPS central** (API central: contas, catálogo, roteamento; Postgres central) e **VPS do município** (API em modo de um tenant, `TENANT_MODE=single` da PD-03, com Postgres e fotos do município), ambas com Docker Compose e Caddy. Backup contínuo do Postgres (WAL-G ou pgBackRest, criptografado) para armazenamento de objetos no Brasil, com restauração testada; fotos criptografadas na aplicação com chave por município. Deploy por GitHub Actions. ~R$ 100–150/mês. A VPS do município pode passar para a infra da prefeitura depois, como opção de contrato, com o mesmo contêiner | Custo mínimo para o piloto dar lucro; sem depender da TI municipal para começar. LGPD: somos operadores, com contrato (D5/D7). Sem alta disponibilidade (contingência em papel). Substitui o desenho EC2 + RDS (R$ 300–410) |
| PD-13 | **Ações do domínio devolvem resultado + eventos** (2026-11-10): `acao(estado, comando, agora)` → `{ ok: true, estado, eventos }` ou `{ ok: false, erro }` com código estável. Não alteram o que recebem. A API grava o estado e transforma cada evento em auditoria, outbox de push e `NOTIFY`, na mesma transação | Auditoria e push explícitos (o evento diz o *porquê*: chamado, rechamado, remanejado); testes TDD sobre eventos; erro vira `409` direto. Descartados: mutar como o protótipo e comparar antes/depois (frágil, perde o motivo) e classes de agregado (cerimônia sem ganho) |
| PD-14 | **Um Postgres em dev/teste com `fila_central` e `fila_t_<slug>`**; o central guarda referência ao banco (`template:` em dev, `env:` em produção) (detalhe: [plano 1B](plano-fase-1b-fundacao-api.md#decisões-desta-fase)) | Isolamento real por banco desde o dev, sem segredo no banco |
| PD-15 | **Tenant pelo `Host` no web e pelo caminho `/v1/municipios/:slug/…` no app**; `TENANT_MODE=single` fixa o tenant ([plano 1B](plano-fase-1b-fundacao-api.md#decisões-desta-fase)) | Cookie preso ao subdomínio; caminho funciona na central e na VPS do município e passa pelo SSE |
| PD-16 | **Dois conjuntos de schema e migrations (central e municipal)** e runner que migra todos e retoma por tenant ([plano 1B](plano-fase-1b-fundacao-api.md#decisões-desta-fase)) | Falha num tenant não para os outros |
| PD-17 | **Login da central aceito no tenant por JWT EdDSA de 15 min** (plugin `jwt` do better-auth), conferido pelo JWKS da central em cache ([plano 1B](plano-fase-1b-fundacao-api.md#decisões-desta-fase)) | A VPS do município não consulta a central a cada requisição |
| PD-18 | **Auditoria na mesma transação** por `acaoDoPainel`; teste falha se rota mutável do painel não declarar a ação ([plano 1B](plano-fase-1b-fundacao-api.md#decisões-desta-fase)) | INV-12 garantido por construção |
| PD-19 | **Testes da API em série**, bancos por arquivo derrubados com `FORCE`, rotas só de teste em `NODE_ENV=test` ([plano 1B](plano-fase-1b-fundacao-api.md#decisões-desta-fase)) | Um Postgres e uma porta compartilhados |
| PD-20 | **Mailer de dev grava no banco central**; testes leem de lá ([plano 1B](plano-fase-1b-fundacao-api.md#decisões-desta-fase)) | Servidor e testes em processos diferentes |
| PD-21 | **Senha ≥ 8; 5 erros seguidos bloqueiam a conta por 15 min**; limite por IP no login ([plano 1B](plano-fase-1b-fundacao-api.md#decisões-desta-fase)) | RN-ID-04 por conta, não só por IP |
| PD-22 | **Zod de `packages/schemas` na entrada e saída; formato único de erro** com o código do domínio no 409 ([plano 1B](plano-fase-1b-fundacao-api.md#decisões-desta-fase)) | Mesmo contrato para painel e app |
| PD-23 | **Paciente = usuário do better-auth central renomeado `paciente`; usuário do painel = `usuario_painel` do tenant**, login por `username` ([plano 1B](plano-fase-1b-fundacao-api.md#decisões-desta-fase)) | Uma linha por pessoa |
| PD-24 | **Painel em `<slug>.localhost:3000` chama a API com cookie e CORS só do mesmo tenant**; mesma origem em produção ([plano 2](plano-fase-2-configuracao.md#decisões-desta-fase)) | Sem proxy que perca o `Host` |
| PD-25 | **Worker no mesmo processo por `PAPEIS`**, lock consultivo por tenant, outbox com backoff e 8 tentativas, push atrás de interface ([plano 2](plano-fase-2-configuracao.md#decisões-desta-fase)) | PD-11 testável no processo do teste |
| PD-26 | **Recorrência em hora local flutuante** convertida pelo fuso da unidade; chave da ocorrência = início local ([plano 2](plano-fase-2-configuracao.md#decisões-desta-fase)) | Sem depender do fuso da máquina; materialização idempotente |
| PD-27 | **"Esta e as seguintes"**: `UNTIL` na antiga e série nova; sessões futuras com pacientes são mantidas ([plano 2](plano-fase-2-configuracao.md#decisões-desta-fase)) | Nunca some sessão com paciente |
| PD-28 | **Herança de configuração** em colunas anuláveis, calculada no domínio ([plano 2](plano-fase-2-configuracao.md#decisões-desta-fase)) | Uma regra para API, painel e worker |
| PD-29 | **TV com token de dispositivo e código de 6 dígitos válido por 10 min** ([plano 2](plano-fase-2-configuracao.md#decisões-desta-fase)) | RN-TV-01/02 com pouco atrito |
| PD-30 | **Tabela mínima `entrada` na fase 2** para RN-ENC-07 ([plano 2](plano-fase-2-configuracao.md#decisões-desta-fase)) | Testar a troca de modo com dados reais |
| PD-31 | **Testes do painel com Vitest, jsdom e Testing Library**, API injetada ([plano 2](plano-fase-2-configuracao.md#decisões-desta-fase)) | Sem servidor nos testes de tela |
| PD-32 | **Trilha da v0.1** (2026-11-11): antes do piloto, a **v0.1 do sistema real**, rodando local com dados de exemplo e ainda não pronta para produção, construída em fatias verticais (ver [tasks](tasks.md#trilha-da-v01-2026-11-11)). Cobre sessão pública, sessão privada, triagem e pré-cadastro; app do paciente em Expo nativo no celular, painel, estações e TV no web | Mostrar algo funcionando a uma prefeitura cedo, sem construir o que a v0.1 não usa e sem nada feito só para a apresentação. Nada é descartado: o resto do backlog volta depois na ordem original |
| PD-33 | **Simplificações da v0.1, cada uma atrás de uma peça única**: a API confere a sessão do paciente direto, num guard só (o JWT da PD-17 entra depois no lugar dele); tempo real por consulta a cada ~3 s num endpoint de estado com o mesmo formato que o SSE (PD-07) terá; sessão aberta e encerrada por botão no painel (o worker chama a mesma função depois); sessões só avulsas, criadas pela tela mínima do painel ou pelo `dev:seed` (séries depois); fotos do pré-cadastro no disco local atrás de uma interface de armazenamento | Completar depois troca uma peça, sem espalhar mudança. **Mantidos inteiros:** multi-tenant, auth do painel, perfis, guard pela matriz e auditoria na mesma transação (PD-18), para não haver retrabalho |
| PD-34 | **Guard da sessão do paciente (PD-33)** ([fatia 0](plano-fatia-0-base.md#decisões-desta-fatia)) | Provisória; detalhe e custo no plano da fatia |
| PD-35 | **Configuração da unidade numa coluna `config jsonb`** ([fatia 0](plano-fatia-0-base.md#decisões-desta-fatia)) | Provisória; detalhe e custo no plano da fatia |
| PD-36 | **Toda entrada aponta para uma `pessoa_local`** ([fatia 0](plano-fatia-0-base.md#decisões-desta-fatia)) | Provisória; detalhe e custo no plano da fatia |
| PD-37 | **`sessao.ocupadas` é um contador gravado** ([fatia 0](plano-fatia-0-base.md#decisões-desta-fatia)) | Provisória; detalhe e custo no plano da fatia |
| PD-38 | **Guard com ressalvas fechado por padrão** ([fatia 0](plano-fatia-0-base.md#decisões-desta-fatia)) | Provisória; detalhe e custo no plano da fatia |
| PD-39 | **Auth do painel no banco do tenant** ([fatia 0](plano-fatia-0-base.md#decisões-desta-fatia)) | Provisória; detalhe e custo no plano da fatia |
| PD-40 | **`dev:seed` preenche o município `exemplo` pelas mesmas funções das rotas, com auditoria** ([fatia 0](plano-fatia-0-base.md#decisões-desta-fatia)) | Provisória; detalhe e custo no plano da fatia |
| PD-41 | **Funções de serviço com contexto do ator** (`executarAcao`): rota e `dev:seed` chamam a mesma função ([fatia 0](plano-fatia-0-base.md#decisões-desta-fatia)) | Provisória; detalhe e custo no plano da fatia |
| PD-42 | **Troca do modo do serviço só sem entradas ativas na v0.1** ([fatia 0](plano-fatia-0-base.md#decisões-desta-fatia)) | Provisória; detalhe e custo no plano da fatia |

## 2. Visão geral

```
 apps/mobile (Expo)          apps/painel (Next)                 apps/web (Next)
 paciente                    /painel  /estacao  /tv             landing
     │  HTTPS + SSE              │  HTTPS + SSE (subdomínio do tenant)
     └──────────────┬────────────┘
                    ▼
            apps/api (Fastify)  ── http (rotas)  ── sse (eventos)  ── worker (varredura + outbox)
                    │ usa packages/domain (regras) e packages/schemas (contratos Zod)
        ┌───────────┼─────────────────────────────┐
        ▼           ▼                             ▼
   banco central   banco do município A ... N    armazenamento de objetos (fotos; chave por tenant)
   (VPS central)   (uma VPS por município no piloto; PD-12)
   (catálogo,      (listas, filas, cadastros,
    contas)         painel, auditoria, outbox)
                    │
                    └─ Expo Push (FCM / APNs)
```

**O processo da API** sobe em três papéis, ligados por variável de ambiente: `http`, `sse` e `worker`. No MVP os três rodam juntos num contêiner; separá-los é só configuração.

## 3. Monorepo

| Pacote | Conteúdo |
| --- | --- |
| `apps/api` | Fastify 5 + autoload (padrão atual), Drizzle, better-auth, SSE, worker |
| `apps/painel` | Next 16, React 19, Tailwind 4, shadcn; design da landing |
| `apps/mobile` | Expo, Expo Router, expo-camera, expo-notifications, `@better-auth/expo` |
| `apps/web` | Landing (sem mudança) |
| `packages/domain` | Regras puras (§6 deste plan) |
| `packages/schemas` | Contratos Zod da API, compartilhados por api, painel e mobile |

## 4. Multi-tenant

**Banco central** (dono: empresa; INV-11: nunca guarda sintomas, documentos nem dados de fila):
- `municipio` (slug, UF, fuso, conexão do banco do tenant em referência a segredo, status);
- `unidade_publica` (catálogo para o mapa e a agenda: endereço, coordenadas, horários, serviços, sessões públicas futuras com vagas restantes). É projetada a partir do tenant pelo worker;
- `paciente` (CPF, hash da senha, nome, e-mail, telefone, nascimento, consentimentos, **nível de confiança**: verificada em, por qual método e por qual município);
- `dispositivo_push` (token Expo por paciente);
- tabelas do better-auth dos pacientes.

**Banco do município**: todas as entidades de [specs/modelo](../../specs/modelo/spec.md#entidades), exceto as acima, mais `usuario_painel` e `perfil` (escopo por unidade), `auditoria`, `outbox_push` e as tabelas do better-auth do painel.

**Resolução do tenant por requisição:**
- **Web** (painel, estação, TV): pelo `Host` → slug → `municipio`.
- **App:** cada chamada leva o slug do município, que o app obtém no catálogo (a unidade da sessão diz o município). A API confere que o recurso pertence ao tenant.
- Um **pool de conexão por tenant**, criado sob demanda e mantido num LRU; uma instância Drizzle por pool.

**Operação:**
- `tenant:create` cria o banco, aplica as migrations, registra no central e cria o primeiro gestor.
- `db:migrate` aplica as migrations do schema municipal em todos os tenants (e no central, com o seu próprio conjunto de migrations).
- Na infra da prefeitura: a mesma imagem, com `TENANT_MODE=single`.

**Pessoa sem app (AD-035):** `pessoa_local` no banco do município (nome, nascimento, CPF opcional), usada no balcão, em entradas criadas pela recepção e em lançamentos de serviço regulado; quando surge uma conta central verificada com o mesmo CPF, o vínculo é gravado no tenant.

**Paciente × município:** a conta é central; o que o paciente tem num município (entradas, filas, cadastro) fica no banco daquele município, referenciando o `paciente.id` central. O app junta as visões consultando cada tenant onde o paciente tem algo ativo (índice no central: paciente → municípios em que tem registros, sem nenhum dado clínico).

## 5. Autenticação e autorização

- **Paciente:** better-auth central; username = CPF validado pelos dígitos; recuperação por código no e-mail (RN-ID-01); hash forte e bloqueio após tentativas (RN-ID-04). No app, sessão por token via plugin Expo.
- **Painel:** better-auth por tenant (cache de instâncias por slug). O login é usuário + senha do município.
- **Autorização:** a matriz de [specs/permissoes](../../specs/permissoes/spec.md) vira uma tabela de ações × perfis em `packages/domain`. Um guard do Fastify confere perfil e escopo de unidade em cada rota do painel. Toda ação do painel grava em `auditoria` na mesma transação (INV-12).
- **Estação:** token vinculado ao usuário logado e à estação escolhida (RNF-SEG-02).
- **TV:** dispositivo pareado por código de 6 dígitos (RN-TV-01); token revogável guardado no navegador da TV.
- **Nível de confiança** (AD-017): `paciente.verificado_em/metodo` no central. A recepção verifica pelo painel do tenant, que grava no central (só o fato, sem o documento) e na auditoria local.

## 6. Domínio (`packages/domain`)

Funções puras sobre dados explícitos (entradas, configuração, chamadas já feitas, `agora`). Nada de I/O. Formato das ações (PD-13): recebem estado, comando e `agora` e devolvem `{ ok: true, estado, eventos }` ou `{ ok: false, erro }`; consultas (ordem, estimativa, visões) devolvem só o valor calculado.

| Módulo | Regras | Origem no protótipo |
| --- | --- | --- |
| `questionario` | Classificação 7.3, exclusividade de "Nenhum", prioridade legal (RN-RISCO-04): grupos fixos com conferência e prazo (AD-025), da pessoa atendida com exceção da criança de colo (AD-027) | `classify`, `legalPriority`, `toggleOption` |
| `ordem` | RN-ORD com risco × legal configurável (AD-004), sugestão de alocação RN-AL-02 | `orderCompare`, `allocCompare`, `riskThenLegal` |
| `fila` | Elegibilidade (inclusive prioridade não conferida, AD-024), janela protegida, atraso pela ordem (AD-010), ordem de chamada | `callOrder`, `becomeEligible`, `releaseLocks` |
| `chamada` | Chamar próximo, rechamar, finalizar, "Não compareceu" com 1º/2º/3º pulo (AD-006), passagem de etapa da triagem | `callNext`, `skip`, `finishCurrent` |
| `estimativa` | Posição e tempo do remoto/presente, "venha agora", aviso por etapa, média RN-ETA-05 | `eta`, `patientEta`, `tick` |
| `sessao` | Contratos de estado das specs (transição não listada = erro), vagas (INV-02), lançamento de serviço regulado (AD-026), encerramento (falta × remanejado; falta anulável, AD-021; sem falta no período de contingência, AD-020) | vários |
| `qr` | Token HMAC por sessão, janela de 30 s, aceita o atual e o anterior | `qrToken`, `checkIn` |
| `recorrencia` | Expansão RRULE/EXDATE/RDATE em ocorrências, divisão de série | novo |
| `permissoes` | Matriz de specs/permissoes | novo |

**Porte:**
1. Os 51 testes de `prototype/tests/engine.test.js` (casos C1..C45 de `.specs/features/prototipo/proofs.md`) são reescritos em Vitest contra a nova API do pacote **antes** da implementação.
2. As regras vêm em TS com tipos explícitos para estado de entrada/fila.
3. A reescrita está pronta quando todos passam, mais os testes novos das regras que o protótipo não cobre (recorrência, permissões, encerramento, AD-015..017, AD-020..048).

## 7. API

- **Rotas** em `routes/v1/...` (autoload), agrupadas por ator: `paciente/*`, `painel/*` (admin, agendador, recepção), `estacao/*`, `tv/*` e `publico/*` (catálogo e agenda).
- **Contratos** em `packages/schemas` (Zod), validados na entrada e na saída. INV-06: as respostas do app são montadas por funções de visão que só incluem dados do próprio paciente.
- **Transações:** toda ação carrega o estado necessário, aplica a regra do domínio e grava na mesma transação, junto com a auditoria, a outbox de push, o `NOTIFY` e os eventos de fila com horário (base das métricas do piloto, AD-042).
- **Concorrência:**
  - "Chamar próximo", "Não compareceu", check-in e saída travam a linha da sessão (`SELECT … FOR UPDATE`), o que serializa as mudanças de ordem de uma fila (RN-CHAM-01, INV-04);
  - alocação e inscrição usam um contador de versão da sessão; uma tentativa com versão velha recebe `409` e a lista atualizada (RN-PERF-02, INV-02).
- **Erros:** uma transição proibida pelos contratos de estado responde `409` com um código estável (ex.: `sessao_aberta`, `lotada`, `duplicada`).

## 8. Tempo real (SSE)

- Endpoints: `GET /v1/eventos/tv`, `/v1/eventos/estacao/:id` e `/v1/eventos/paciente`.
- Toda transação que muda uma fila emite `NOTIFY tenant_<slug>, '<sessaoId>'`. Cada instância da API escuta os canais dos tenants com conexões abertas e, ao receber, recalcula **a visão de cada assinante**:
  - TV: chamada atual, últimas chamadas, contadores por serviço (RN-TV-*);
  - estação: chamado atual, tolerância, próxima senha;
  - paciente: só a própria posição, o tempo e o estado (INV-06).
- Ao conectar ou reconectar (`Last-Event-ID`), o servidor manda primeiro a visão completa atual (RNF-DES-02). Heartbeat a cada 15 s.
- App fechado: o push cobre os avisos que importam (saia de casa, sua vez, pulado, venha agora).
- Meta de 3 s do clique à TV (RNF-DES-01): uma transação + NOTIFY + recálculo; medir no piloto.

## 9. Worker e push

Varredura a cada minuto, por tenant, com lock consultivo (`pg_try_advisory_lock`) para que só uma instância trabalhe em cada tenant:

| Tarefa | Regra |
| --- | --- |
| Abrir sessões cujo início chegou | RN-FILA-01, contrato da sessão |
| Liberar alocações pendentes e vagas seguras com encaminhamento não aceito na abertura (lançamentos de serviço regulado nunca, AD-026) | RN-CONF-04, RN-ENC-04 |
| Destacar alocação pendente há mais de 24 h | RN-CONF-03 |
| "Saia de casa" e recálculo de estimativa em sessões abertas (suspensos em modo manual) | RN-ETA-03 |
| Detectar unidade sem sinal (TV e todas as estações por ~2 min) e entrar/sair do modo manual | RN-SES-05, AD-043 |
| Encaminhamento vencido | RN-ENC-03 |
| "Ainda precisa?" (30 dias) e arquivamento (7 dias) | RN-PARADA |
| Lembrar o admin no horário de fim | RN-SES-01 |
| Materializar ocorrências das séries (janela de 90 dias) | PD-10 |
| Projetar o catálogo público no banco central | §4 deste plan |
| Enviar a outbox de push (com nova tentativa e backoff) | RN-NOT |

- **Push:** a outbox do tenant guarda o paciente e o texto, sem dado clínico (RN-NOT-01). O worker busca os tokens no central e envia pelo Expo; os recibos marcam os tokens inválidos.
- **Sem tolerância automática:** a tolerância esgotada é só exibida na estação (AD-006).

## 10. Outros componentes

- **QR de entrada:** a TV mostra `HMAC(segredo da sessão, janela de 30 s)` de cada sessão aberta da unidade; a API confere com o relógio do servidor, aceitando a janela atual e a anterior (RN-PRES-01). O check-in exige o paciente logado (RNF-SEG-01).
- **Estação:** página em `/estacao`, com mini-janela por Document Picture-in-Picture (Chrome/Edge), e fallback para aba normal e para modo celular (RN-EST-02, RN-EST-04). Uma estação com chamado não fecha (RN-EST-05).
- **TV:** rota enxuta, com pouco JavaScript, fonte grande, botão "Iniciar painel" para o som, fila de anúncios com destaque configurável por unidade, padrão 10 s (RN-TV-04, RN-TV-07, AD-022). Sem nomes (AD-012).
- **Documentos:** upload direto para o armazenamento de objetos (compatível com S3) por URL pré-assinada, criptografados com chave por tenant. A leitura é por URL pré-assinada curta, emitida só para os perfis da matriz, e cada emissão vai para a auditoria (RNF-LGPD-03).
- **Recorrência:** criar uma série gera as ocorrências; editar uma vira exceção daquela sessão; "esta e as seguintes" fecha a série com UNTIL e cria outra; cancelar uma ocorrência segue o fluxo de cancelamento (13.3).
- **Fuso:** todas as datas em UTC no banco; regras de dia ("véspera", "no dia") no fuso da unidade.

## 11. Testes

**Todo código é escrito em TDD** (vermelho → verde → refatorar), em toda camada. A regra completa está no [tasks.md](tasks.md#tasks-mvp-filas-ubspoliclínicas).

| Camada | Ferramenta | O que cobre |
| --- | --- | --- |
| Domínio | Vitest | Os 46 casos do protótipo, mais as regras novas; cada INV-* vira teste |
| API | Vitest + Postgres de teste (padrão atual de `tests/integration`) | Contratos de estado pelas rotas, isolamento entre dois tenants, concorrência real com dois escritores (L-003), permissões |
| Painel / app | Testes de componente onde houver lógica | — |
| Ponta a ponta | Depois do MVP (Playwright no painel, Maestro no app) | Fluxo principal do protótipo |

Lições candidatas a aplicar ([LESSONS.md](../../LESSONS.md)): L-001 (limpar referências ao sair de um estado), L-002 (precedência pela ordem real), L-003, L-004 (os dois lados de cada limite numérico) e L-005.

## 12. Ordem de construção

Backlog completo em [tasks.md](tasks.md). Mudança de 2026-11-10: a infra (VPS, backup, deploy) saiu da fundação e virou a fase 4, depois da fatia vertical rodando local. Ordem original abaixo, para referência.

1. **Fundação:** infra (VPS, Postgres, armazenamento, DNS, Caddy) e deploy (GitHub Actions), banco central e do tenant, resolução do tenant, `tenant:create`, migrations multi-tenant, `packages/domain` com os testes portados, auth do paciente e do painel, auditoria.
2. **Configuração:** município, unidades, serviços, estações, sessões e séries, pareamento da TV (US-13).
3. **Fatia vertical da sessão pública** (o fluxo principal do protótipo): agenda (US-01) → inscrição pública com questionário (US-02, US-16) → abertura → fila remota no app com SSE (US-06) → check-in pelo QR, "Vou sair" e verificação na recepção (US-07, AD-017) → chamada na estação e na TV (US-08..US-11).
4. **Sessão privada:** lista de espera, encaminhamento, alocação, confirmação e lista de ligação (US-03..US-05).
5. **Triagem:** duas etapas e confirmação de risco (RN-TRI, US-09).
6. **Recepção:** balcão e pré-cadastro (US-12, US-14).
7. **P2:** cancelamento e remanejamento (US-15), cancelamento pelo paciente (US-17), lista de reserva (RN-PUB-02); serviço regulado (US-18) na fase 5 e contingência (US-19) na fase 7.

## 13. Riscos

| Risco | Mitigação |
| --- | --- |
| Muitos tenants = muitas conexões | Pool pequeno por tenant num LRU; PgBouncer se precisar |
| Migration que falha no meio dos tenants | Migrations idempotentes; o runner registra o estado por tenant e pode retomar |
| Push ignorado ou desativado | Lista de ligação (RN-CONF-03) e "venha agora" dentro do app; onboarding explica o push |
| SSE caindo em rede móvel ruim | Reconexão com visão completa; o app também atualiza ao voltar para o primeiro plano |
| Atraso ou recusa na publicação nas lojas (Apple 5.1.1(ix): app de saúde enviado por quem presta o serviço) | D10: conta de desenvolvedor da empresa e submissão de teste cedo; um app só, da empresa (AD-028); o piloto pode usar TestFlight e teste interno do Google Play |

## Em aberto

- Provedor de longo prazo, oferta "na infra da prefeitura" e modelo de cobrança ([discovery-hospedagem.md](discovery-hospedagem.md)); a cobrança e as exigências de hospedagem saem do D7.
- Jurídico e LGPD (D5): termo (RNF-LGPD-01), RIPD (RNF-LGPD-02), retenção das fotos, grupos e documentos de prioridade legal, aviso de declaração falsa (AD-024).
- Contratação (D7): modalidade, exigências de hospedagem e modelo de cobrança.
- Regulação (D6, [discovery-regulacao.md](discovery-regulacao.md)): configuração dos serviços do piloto, validade da requisição e integração pós-piloto com e-SUS Regulação/SISREG (AD-026).
- Validação clínica do questionário v1 (D8), antes do piloto.
- Números-alvo dos critérios de sucesso do piloto (AD-029), depois da entrevista do D4.
- Propostas a validar no piloto (RN-ETA-05 tempo médio, RN-TRI-06 triagem cadenciada, RN-PARADA-02 30 dias).

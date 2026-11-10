# Plan: MVP Filas UBS/Policlínicas

2026-11-10 · status: **rascunho para revisão**

Spec: [spec.md](spec.md) e [source.md](source.md) (RN-*, INV-*, RNF-*). Decisões de produto: AD-001..AD-017 em [`.specs/STATE.md`](../../STATE.md). Anexos: [discovery-identidade.md](discovery-identidade.md) (decidido) e [hospedagem.md](hospedagem.md) (em aberto).

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
| PD-08 | **Regras em `packages/domain`**: TS puro, sem banco nem relógio próprio, reescrito a partir do `prototype/js/engine.js`, com os 46 testes portados antes | As regras já validadas viram aceite; a API só carrega, aplica e grava |
| PD-09 | **`apps/painel`**: Next com `/painel`, `/estacao` e `/tv` no subdomínio do tenant; a landing segue em `apps/web` | Separa a área autenticada do site público |
| PD-10 | **Recorrência RFC 5545** (lib `rrule`): a série guarda DTSTART/DTEND/RRULE/EXDATE/RDATE; as ocorrências viram sessões numa janela móvel de 90 dias | Alocação, vagas e fila sempre apontam para uma linha real |
| PD-11 | **Worker com varredura a cada minuto** por tenant, com consultas idempotentes; **push por tabela de saída** (outbox) | Não perde nada se cair; não reagenda quando um horário muda; ~8 consultas/s com 100 tenants |
| PD-12 | **MVP e piloto na AWS sa-east-1, setup enxuto** ([hospedagem.md](hospedagem.md)): 1 VM t4g.small com Docker Compose (Caddy, API, painel) + RDS Postgres db.t4g.micro zona única com PITR (um banco por município na mesma instância) + S3/KMS; infra em OpenTofu; deploy por GitHub Actions. ~R$ 300–410/mês. Tudo em contêiner e Postgres padrão, para migrar ou instalar na prefeitura depois | Mais barato sem abrir mão de backup, criptografia, isolamento e dados no Brasil; sem alta disponibilidade no piloto |

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
   banco central   banco do município A ... N    armazenamento S3 (fotos; prefixo e chave por tenant)
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
| `packages/domain` | Regras puras (§6) |
| `packages/schemas` | Contratos Zod da API, compartilhados por api, painel e mobile |
| `packages/configs` | Configurações compartilhadas (existente) |

## 4. Multi-tenant

**Banco central** (dono: empresa; INV-11: nunca guarda sintomas, documentos nem dados de fila):
- `municipio` (slug, UF, fuso, conexão do banco do tenant em referência a segredo, status);
- `unidade_publica` (catálogo para o mapa e a agenda: endereço, coordenadas, horários, serviços, sessões públicas futuras com vagas restantes). É projetada a partir do tenant pelo worker;
- `paciente` (CPF, hash da senha, nome, e-mail, telefone, nascimento, consentimentos, **nível de confiança**: verificada em, por qual método e por qual município);
- `dispositivo_push` (token Expo por paciente);
- tabelas do better-auth dos pacientes.

**Banco do município**: todas as entidades do §5 da fonte, exceto as acima, mais `usuario_painel` e `perfil` (escopo por unidade), `auditoria`, `outbox_push` e as tabelas do better-auth do painel.

**Resolução do tenant por requisição:**
- **Web** (painel, estação, TV): pelo `Host` → slug → `municipio`.
- **App:** cada chamada leva o slug do município, que o app obtém no catálogo (a unidade da sessão diz o município). A API confere que o recurso pertence ao tenant.
- Um **pool de conexão por tenant**, criado sob demanda e mantido num LRU; uma instância Drizzle por pool.

**Operação:**
- `tenant:create` cria o banco, aplica as migrations, registra no central e cria o primeiro gestor.
- `db:migrate` aplica as migrations do schema municipal em todos os tenants (e no central, com o seu próprio conjunto de migrations).
- Na infra da prefeitura: a mesma imagem, com `TENANT_MODE=single`.

**Paciente × município:** a conta é central; o que o paciente tem num município (entradas, filas, cadastro) fica no banco daquele município, referenciando o `paciente.id` central. O app junta as visões consultando cada tenant onde o paciente tem algo ativo (índice no central: paciente → municípios em que tem registros, sem nenhum dado clínico).

## 5. Autenticação e autorização

- **Paciente:** better-auth central; username = CPF validado pelos dígitos; recuperação por código no e-mail (RN-ID-01); hash forte e bloqueio após tentativas (RN-ID-04). No app, sessão por token via plugin Expo.
- **Painel:** better-auth por tenant (cache de instâncias por slug). O login é usuário + senha do município.
- **Autorização:** a matriz de permissões (9.3) vira uma tabela de ações × perfis em `packages/domain`. Um guard do Fastify confere perfil e escopo de unidade em cada rota do painel. Toda ação do painel grava em `auditoria` na mesma transação (INV-12).
- **Estação:** token vinculado ao usuário logado e à estação escolhida (RNF-SEG-02).
- **TV:** dispositivo pareado por código de 6 dígitos (RN-TV-01); token revogável guardado no navegador da TV.
- **Nível de confiança** (AD-017): `paciente.verificado_em/metodo` no central. A recepção verifica pelo painel do tenant, que grava no central (só o fato, sem o documento) e na auditoria local.

## 6. Domínio (`packages/domain`)

Funções puras sobre dados explícitos (entradas, configuração, chamadas já feitas, `agora`). Nada de I/O.

| Módulo | Regras | Origem no protótipo |
| --- | --- | --- |
| `questionario` | Classificação 7.3, exclusividade de "Nenhum", prioridade legal (RN-RISCO-04) | `classify`, `legalPriority`, `toggleOption` |
| `ordem` | RN-ORD com risco × legal configurável (AD-004), sugestão de alocação RN-AL-02 | `orderCompare`, `allocCompare`, `riskThenLegal` |
| `fila` | Elegibilidade, janela protegida, atraso pela ordem (AD-010), ordem de chamada | `callOrder`, `becomeEligible`, `releaseLocks` |
| `chamada` | Chamar próximo, rechamar, finalizar, "Não compareceu" com 1º/2º/3º pulo (AD-006), passagem de etapa da triagem | `callNext`, `skip`, `finishCurrent` |
| `estimativa` | Posição e tempo do remoto/presente, "venha agora", aviso por etapa, média RN-ETA-05 | `eta`, `patientEta`, `tick` |
| `sessao` | Contratos de estado 9.3 (transição não listada = erro), vagas (INV-02), encerramento (falta × remanejado) | vários |
| `qr` | Token HMAC por sessão, janela de 30 s, aceita o atual e o anterior | `qrToken`, `checkIn` |
| `recorrencia` | Expansão RRULE/EXDATE/RDATE em ocorrências, divisão de série | novo |
| `permissoes` | Matriz 9.3 | novo |

**Porte:**
1. Os 46 testes de `prototype/tests/engine.test.js` (casos C1..C45 de `.specs/features/prototipo/proofs.md`) são reescritos em Vitest contra a nova API do pacote **antes** da implementação.
2. As regras vêm em TS com tipos explícitos para estado de entrada/fila.
3. A reescrita está pronta quando todos passam, mais os testes novos das regras que o protótipo não cobre (recorrência, permissões, encerramento, AD-015..017).

## 7. API

- **Rotas** em `routes/v1/...` (autoload), agrupadas por ator: `paciente/*`, `painel/*` (admin, agendador, recepção), `estacao/*`, `tv/*` e `publico/*` (catálogo e agenda).
- **Contratos** em `packages/schemas` (Zod), validados na entrada e na saída. INV-06: as respostas do app são montadas por funções de visão que só incluem dados do próprio paciente.
- **Transações:** toda ação carrega o estado necessário, aplica a regra do domínio e grava na mesma transação, junto com a auditoria, a outbox de push e o `NOTIFY`.
- **Concorrência:**
  - "Chamar próximo", "Não compareceu", check-in e saída travam a linha da sessão (`SELECT … FOR UPDATE`), o que serializa as mudanças de ordem de uma fila (RN-CHAM-01, INV-04);
  - alocação e inscrição usam um contador de versão da sessão; uma tentativa com versão velha recebe `409` e a lista atualizada (RN-PERF-02, INV-02).
- **Erros:** uma transição proibida pelos contratos 9.3 responde `409` com um código estável (ex.: `sessao_aberta`, `lotada`, `duplicada`).

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
| Liberar alocações pendentes e vagas seguras com encaminhamento não aceito na abertura | RN-CONF-04, RN-ENC-04 |
| Destacar alocação pendente há mais de 24 h | RN-CONF-03 |
| "Saia de casa" e recálculo de estimativa em sessões abertas | RN-ETA-03 |
| Encaminhamento vencido | RN-ENC-03 |
| "Ainda precisa?" (30 dias) e arquivamento (7 dias) | RN-PARADA |
| Lembrar o admin no horário de fim | RN-SES-01 |
| Materializar ocorrências das séries (janela de 90 dias) | PD-10 |
| Projetar o catálogo público no banco central | §4 |
| Enviar a outbox de push (com nova tentativa e backoff) | RN-NOT |

- **Push:** a outbox do tenant guarda o paciente e o texto, sem dado clínico (RN-NOT-01). O worker busca os tokens no central e envia pelo Expo; os recibos marcam os tokens inválidos.
- **Sem tolerância automática:** a tolerância esgotada é só exibida na estação (AD-006).

## 10. Outros componentes

- **QR de entrada:** a TV mostra `HMAC(segredo da sessão, janela de 30 s)` de cada sessão aberta da unidade; a API confere com o relógio do servidor, aceitando a janela atual e a anterior (RN-PRES-01). O check-in exige o paciente logado (RNF-SEG-01).
- **Estação:** página em `/estacao`, com mini-janela por Document Picture-in-Picture (Chrome/Edge), e fallback para aba normal e para modo celular (RN-EST-02, RN-EST-04). Uma estação com chamado não fecha (RN-EST-05).
- **TV:** rota enxuta, com pouco JavaScript, fonte grande, botão "Iniciar painel" para o som, fila de anúncios de 10 s (RN-TV-04, RN-TV-07). Sem nomes (AD-012).
- **Documentos:** upload direto para o S3 por URL pré-assinada, com prefixo e chave KMS por tenant. A leitura é por URL pré-assinada curta, emitida só para os perfis da matriz, e cada emissão vai para a auditoria (RNF-LGPD-03).
- **Recorrência:** criar uma série gera as ocorrências; editar uma vira exceção daquela sessão; "esta e as seguintes" fecha a série com UNTIL e cria outra; cancelar uma ocorrência segue o fluxo de cancelamento (13.3).
- **Fuso:** todas as datas em UTC no banco; regras de dia ("véspera", "no dia") no fuso da unidade.

## 11. Testes

| Camada | Ferramenta | O que cobre |
| --- | --- | --- |
| Domínio | Vitest | Os 46 casos do protótipo, mais as regras novas; cada INV-* vira teste |
| API | Vitest + Postgres de teste (padrão atual de `tests/integration`) | Contratos 9.3 pelas rotas, isolamento entre dois tenants, concorrência real com dois escritores (L-003), permissões |
| Painel / app | Testes de componente onde houver lógica | — |
| Ponta a ponta | Depois do MVP (Playwright no painel, Maestro no app) | Fluxo principal do protótipo |

Lições candidatas a aplicar ([LESSONS.md](../../LESSONS.md)): L-001 (limpar referências ao sair de um estado), L-002 (precedência pela ordem real), L-003, L-004 (os dois lados de cada limite numérico) e L-005.

## 12. Ordem de construção (insumo para o tasks.md)

1. **Fundação:** infra (OpenTofu, VM, RDS, S3, DNS, Caddy) e deploy (GitHub Actions), banco central e do tenant, resolução do tenant, `tenant:create`, migrations multi-tenant, `packages/domain` com os testes portados, auth do paciente e do painel, auditoria.
2. **Configuração:** município, unidades, serviços, estações, sessões e séries, pareamento da TV (US-13).
3. **Fatia vertical da sessão pública** (o fluxo principal do protótipo): agenda (US-01) → inscrição pública com questionário (US-02, US-16) → abertura → fila remota no app com SSE (US-06) → check-in pelo QR, "Vou sair" e verificação na recepção (US-07, AD-017) → chamada na estação e na TV (US-08..US-11).
4. **Sessão privada:** lista de espera, encaminhamento, alocação, confirmação e lista de ligação (US-03..US-05).
5. **Triagem:** duas etapas e confirmação de risco (RN-TRI, US-09).
6. **Recepção:** balcão e pré-cadastro (US-12, US-14).
7. **P2:** cancelamento e remanejamento (US-15), cancelamento pelo paciente (US-17), lista de reserva (RN-PUB-02).

## 13. Riscos

| Risco | Mitigação |
| --- | --- |
| Muitos tenants = muitas conexões | Pool pequeno por tenant num LRU; PgBouncer se precisar |
| Migration que falha no meio dos tenants | Migrations idempotentes; o runner registra o estado por tenant e pode retomar |
| Push ignorado ou desativado | Lista de ligação (RN-CONF-03) e "venha agora" dentro do app; onboarding explica o push |
| SSE caindo em rede móvel ruim | Reconexão com visão completa; o app também atualiza ao voltar para o primeiro plano |
| Atraso na publicação nas lojas (Apple) | Começar o build e a conta de desenvolvedor cedo; o piloto pode usar TestFlight e teste interno do Google Play |

## Em aberto

- Provedor de longo prazo, oferta "na infra da prefeitura" e modelo de cobrança ([hospedagem.md](hospedagem.md)).
- Plano de contingência da unidade quando o sistema cair (fonte §16), necessário porque o piloto não tem alta disponibilidade.
- Termo do app com o jurídico (RNF-LGPD-01) e o RIPD (RNF-LGPD-02).
- Propostas da fonte §16 para validar no piloto (questionário, tempo médio, 30 dias, 3 pulos, 10 s na TV).

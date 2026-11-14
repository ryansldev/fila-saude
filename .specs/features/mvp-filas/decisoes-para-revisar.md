# Decisões para revisar

Decisões tomadas durante a implementação autônoma das fases 1 e 2 (a partir de 2026-11-11). Cada uma ficou **provisória e reversível**: o código segue o que está aqui até você confirmar ou mudar. As já decididas saíram daqui e estão nas specs. Quando confirmar, a regra vai para a spec da capacidade e a decisão vai para `decisions.md` (constituição, processo 6).

Formato: **contexto** · **o que foi feito** · **alternativa** · **custa se errado**.

## Lacunas das specs encontradas no domínio (fase 1A)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| G2 | RN-ORD-05 diz que a posição "nunca piora", e o exemplo da RN-ORD-03 piora | Segue o exemplo da RN-ORD-03 | Ajustar o texto da RN-ORD-05 | Só o texto da spec |
| G4 | Atraso no 1º pulo e na passagem triagem → atendimento | Não aplica atraso nesses dois casos, como no protótipo (`applyLate: false`) | Aplicar atraso | Ordem diferente após um pulo |
| G5 | "Vem depois de X" usa a chave atual de X ou a do momento da chamada? | Chave atual | Foto no momento da chamada | Só muda se o risco ou a prioridade de X mudar depois de chamado |
| G7 | Código de erro para estação desconhecida | Inconsistente (`nenhum_elegivel` em um lugar, `transicao_proibida` em outro) | Um código próprio (`estacao_desconhecida`) | Mensagem de erro confusa na API |
| G8 | "Aguardando início" (RN-ETA-02) | Esconde a posição; o protótipo mostrava | Mostrar a posição sem o tempo | O paciente não vê a posição antes da abertura |
| G9 | Tempo médio inicial | Um valor por etapa na unidade; a spec sugere por serviço | Por serviço | Estimativa pior no início do dia |
| G10 | Média do dia (RN-ETA-05) | Não desconta períodos de contingência nem estação parada | Descontar | Média inflada depois de uma queda |
| G11 | Tempo para "saia de casa" (RN-ETA-03): "abaixo de" | `<` estrito (spec), não `<=` (protótipo) | `<=` | Diferença de um minuto |

## Lista de espera e alocação (fase 1A, Task 8)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| L1 | Alocação não confirmada liberada na abertura (RN-CONF-04): a entrada volta à lista com a data original. Se ela era de um remanejado, mantém a preferência de remanejado? | Mantém a preferência. A spec não diz | Perde a preferência (trata como quem não respondeu) | O remanejado que não responde continua passando na frente |
| L3 | "Ainda precisa?" (RN-PARADA) perguntado, depois a entrada é alocada e volta para a lista (recusa ou liberação na abertura) | A pergunta pendente continua valendo e a entrada pode ser arquivada logo em seguida. A contagem dos 30 dias parte da data de entrada original | Alocar conta como resposta ("sim") e reinicia a contagem | Paciente que acabou de interagir é arquivado |
| L2 | Entrada arquivada e duplicidade (RN-LE-05) | A arquivada não conta como ativa. Ao reativar, a duplicidade é conferida de novo | Arquivada bloqueia uma entrada nova no mesmo serviço | A pessoa pode ter duas entradas: a arquivada e uma nova |

## Sessão do dia (fase 1A, Task 9)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| S1 | A tabela de transições da entrada (specs/marcacao) não tinha linha para a inclusão pelo balcão | Uma linha nova foi criada ("Recepção inclui no balcão" → na fila), gerada a partir do código | Deixar o balcão fora do contrato | Só o texto da spec |
| S2 | Sessão pública lotada | Quem tenta se inscrever vai para a lista de reserva (RN-PUB-02). O teste do protótipo esperava um erro "lotada" | Recusar com "lotada" | Muda a mensagem no app |
| S3 | Foto do encaminhamento aceita | Quem chama a função informa; não fica guardado na entrada | Guardar na entrada | Só a forma do dado |
| S4 | Número na sessão pública (RN-FILA-01 diz "hora da inscrição") | Ordena pela data de entrada original; não há campo "inscrita em". Para inscrição nova é a mesma coisa | Guardar a hora da inscrição na entrada | Remanejado de sessão pública ou troca da reserva fica com o número da data antiga |
| S5 | Prioridade declarada no balcão | A recepção já confere na hora (RN-ENC-06 diz que "pode dar a prioridade na 1ª presença") | Deixar pendente para conferir depois | Prioridade passa a valer sem conferência explícita |

## Encerramento, faltas e remanejados (fase 1A, Task 10)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| E1 | "A vez passou" no encerramento | Definição literal da fila do dia (alguém depois da pessoa foi chamado na etapa atual dela), contando só chamadas feitas enquanto ela estava fora (AD-010). Quem voltou para remoto no 2º pulo sem ninguém chamado depois é remanejado, não faltoso | Contar qualquer chamada posterior | Algumas faltas viram remanejamentos (ou o contrário) |
| E2 | Contingência registrada depois do encerramento (RN-CONT-03) | A falta só é apagada se todas as chamadas que passaram a vez caíram dentro do período registrado. O item volta de "saiu da fila" para "remanejado" (o contrato do item não tem linha de reversão) | Apagar se qualquer chamada caiu no período | Menos faltas apagadas |
| E3 | Período de contingência | Só aceita período já terminado (início < fim ≤ agora); recusa sessão planejada; em sessão aberta ou cancelada só registra; em sessão encerrada só recalcula no mesmo dia local do encerramento | Aceitar período em aberto | Quem registra a contingência durante a queda precisa esperar a volta |
| E4 | Novo remanejamento | A entrada recebe a origem da sessão atual e o contador de recusas volta a 0 | Manter a origem e as recusas do 1º remanejamento | Quem é remanejado várias vezes ganha preferência de novo a cada vez |
| E5 | "Outra data" (RN-REM-03) | Vale só quando a sessão em que a pessoa está é privada ou regulada (pela visibilidade da sessão, não pela origem). Remanejado de pública alocado numa privada pode usar; numa pública, não. Também entra em "sessões recusadas", como a recusa normal | Decidir pela origem | O botão aparece ou some em casos de borda |
| E6 | Desistir | Em "aguardando remarcação" usa a linha "Paciente cancela"; na fila, aceita remoto ou presente. "Outra data" só aceita remoto | Restringir desistir a remoto | Só o estado aceito |
| E7 | Assinatura de encerrar/cancelar | Recebem as entradas e a origem da sessão e devolvem {dia, entradas}, porque falta e remanejamento mudam a entrada | Assinatura do plano (só a sessão) | Só a forma da chamada |

## Revisão final do domínio (fase 1A)

A revisão de toda a fase 1A encontrou falhas na ligação entre a fila do dia e a lista de espera (entrada presa em "Na fila" depois do atendimento; falta por chamada feita antes de a pessoa entrar na fila). A correção trouxe estas decisões:

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| F1 | Idoso (60+ e 80+) e a pendência "prioridade" no check-in | Idoso **não** gera pendência de conferência de prioridade: vem da data de nascimento, que a conferência de identidade já cobre. Gestante, PcD, colo etc. continuam pendentes até a recepção conferir | Idoso também pendente (como estava) | Se a UBS quiser conferir idade à parte, todo idoso com app volta a passar no balcão em toda ida |
| F2 | Quem entra na fila com a sessão já aberta (inscrição, reserva, regulado) | Só conta como "vez passada" a chamada feita depois de a pessoa entrar na fila | Contar todas (como estava, gerava falta injusta) | Nenhum conhecido |
| F3 | Conferência da prioridade | Fica guardada na entrada e vale nas próximas idas até o prazo (AD-024); a idade é recalculada no dia de cada sessão | Foto tirada na criação da entrada | Nenhum conhecido |

Pendências conhecidas do domínio (corrigir junto com a rota que as usa):

- Refazer o questionário (Tela 5) hoje descarta os grupos de prioridade novos; deveria somá-los como "declarados, não conferidos" para quem está na lista ou remoto.
- "Dar prioridade" na 1ª presença sem app marca como conferidos todos os grupos do item, inclusive os que a recepção não viu.
- Remanejado "na reserva" não tem ação de desistir.

## Configurações (fase 2, Task 4)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| C1 | Herança de configurações compostas (alerta de faltas, "ainda precisa?", prazos de prioridade) | O objeto inteiro é herdado: a unidade ou define tudo ou herda tudo | Herdar campo a campo | A unidade não consegue mudar só o número de faltas sem repetir os dias |
| C2 | "Esta e as seguintes" escolhida numa sessão avulsa (data extra fora da regra) | A série nova começa na próxima sessão normal da regra e mantém o horário e o intervalo dela; a sessão avulsa continua avulsa. Se a regra já tinha acabado, a série antiga fica como estava | Recusar o corte numa sessão avulsa | Só a forma de dividir; nenhuma sessão some ou se repete |

## Permissões (fase 1A, Task 12)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| P1 | Células com ressalva ("próprios", "só ao aplicar no balcão", "na alocação ou lançamento") | `pode()` libera qualquer célula preenchida. A nova `condicoes()` devolve as ressalvas, e a API é obrigada a conferi-las | `pode()` só libera ✓ sem ressalva | Uma rota que use só `pode()` deixaria um paciente ver dados de outro: a revisão da API precisa cobrir isso |
| P2 | "Chamar, rechamar, pular, finalizar" | Uma ação só (`operar_chamadas`), sem separar triagem de atendimento | Duas ações | A matriz não distingue a estação de triagem |

## Fase 1B e fase 2 (arquitetura)

Os planos detalhados ([1B](plano-fase-1b-fundacao-api.md), [fase 2](plano-fase-2-configuracao.md)) registraram as decisões PD-14 a PD-31 em `plan.md`, cada uma com o motivo e o custo se estiver errada. Todas são **provisórias**. As que mais merecem o seu olhar:

| PD | Resumo | Por que olhar |
| --- | --- | --- |
| PD-17 | O login do paciente feito na central vale no município por um JWT EdDSA de 15 min, conferido pelo JWKS da central | Fecha o item em aberto do plan. Muda o app (troca sessão por token) e o prazo de bloqueio de conta |
| PD-21 | Senha com no mínimo 8 caracteres; 5 erros seguidos bloqueiam a conta por 15 min; limite por IP | É regra de produto (RN-ID-04 não fixa os números) |
| PD-15 | No app, o município vai no caminho (`/v1/municipios/:slug/…`); no web, no subdomínio | Define o formato de todas as rotas do app |
| PD-27 | "Esta e as seguintes": sessões futuras com pacientes ficam como estão e passam para a série nova | Comportamento visível ao admin |
| PD-29 | TV pareada por código de 6 dígitos válido por 10 min; até o SSE, consulta o estado a cada 5 s | Detalhe de operação na unidade |
| PD-24 | Em dev, painel em `:3000` e landing (`apps/web`) movida para `:3001` | Muda o seu `npm run dev` da landing |
| PD-14, 16, 18, 19, 20, 22, 23, 25, 26, 28, 30, 31 | Bancos por município, migrations, auditoria, testes, mailer de dev, formato de erro, tabelas de conta, worker/outbox, recorrência em hora local, herança de config, tabela mínima `entrada`, testes do painel | Técnicas e de baixo custo para trocar |

## Fatia 0 da v0.1 (execução rápida, 2026-11-12)

Pedido: "o mais rápido possível, menos perfeccionista". Tasks 2–20 feitas direto, sem o ciclo de subagente + revisão por task.

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| V1 | Processo | TDD mantido, mas um arquivo de teste por recurso (não por rota/método) e só os casos principais de cada task; sem revisão de código por task | Revisão por task (fluxo SDD) | Bug que a revisão pegaria; vale um `/code-review` da branch antes do PR |
| V2 | Rota de teste das ressalvas (Task 8) | Ressalvas testadas só na unidade (`permitido`); a 403 por escopo é testada nas rotas reais | A rota `/v1/teste/painel/…/protegida` | Baixo |
| V3 | CORS (Task 10) | Hook próprio em vez de `@fastify/cors`; mutação em `/v1/painel` com `Origin` de outro município → 403 antes da rota (CSRF) | `@fastify/cors` | Baixo: um arquivo |
| V4 | Login do painel | Plugin username do better-auth: login só com letras, números, `.` e `_` (3–30) | Validador próprio que aceite hífen | Login com hífen dá 400 |
| V5 | `GET /v1/painel/unidades` e `/config` | Qualquer usuário logado vê as unidades dos seus perfis (gestor: todas) | Exigir uma ação da matriz | Baixo |

## Papéis da equipe (discovery, 2026-11-12)

Decididos por você: ocupação + função de gestão; quem cria quem (RN-PERF-04); "Agendar" como permissão ligável; técnico acolhe e enfermeiro classifica (RN-PERF-05). Ficaram provisórios:

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| E1 | Confirmar nível de risco | Só o enfermeiro (a matriz antiga dava ao agendador, "na alocação ou lançamento") | Médico também confirma | O agendamento não confirma risco: precisa de enfermeiro |
| E2 | Lançar paciente de serviço regulado | Regulação SMS e quem tem "Agendar" na UBS | Só a Regulação SMS | A UBS pode lançar o regulado que recebeu |
| E3 | Técnico de enfermagem vê a resposta sobre pensamentos de tirar a própria vida (RN-RISCO-06) | Vê, para encaminhar no acolhimento | Só o enfermeiro vê | Exposição maior de um dado sensível |
| E4 | ACS e saúde bucal (técnico/auxiliar) | Entram na equipe sem ação no painel | Dar alguma ação | Nenhum por enquanto |
| E5 | Gerente edita alguém com atribuições fora da UBS dele | Recusado (403); só a SMS mexe | O gerente mexe só na parte da UBS dele | A SMS precisa ajustar quem trabalha em duas UBS |
| E6 | CBO | Ocupações sem o código CBO por enquanto | Guardar o CBO de cada ocupação | Importar do CNES depois pede o mapeamento |

## Remoções e horário (2026-11-12)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| R1 | Remover unidade | Arquiva (some das listas, histórico fica); recusa com sessão planejada/aberta ou paciente na lista; tira as ocupações e funções da equipe naquela unidade | Apagar de verdade; ou só esconder sem mexer na equipe | Gerente de uma unidade removida fica sem tela |
| R2 | Remover pessoa da equipe | Marca como removida; apaga senha, sessões e atribuições; o login continua ocupado | Apagar a pessoa; ou liberar o login para outro | Não dá para recadastrar alguém com o mesmo login |
| R3 | Horário de funcionamento | Lista de intervalos por dia; intervalos do mesmo dia não podem se sobrepor (encostados valem); dia vazio = fechado | Um intervalo por dia | Nenhum |

## Fatia 1 da v0.1 (2026-11-12)

Execução rápida, como a fatia 0. Q3 e Q5 aprovadas em 2026-11-12 (AD-055; RN-ID-05). Plano: [plano-fatia-1-publica](plano-fatia-1-publica.md) (PD-43 a PD-46).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| F1 | Quem vê a fila do dia e as sessões de hoje (revisto por você) | Quem tem, na unidade, alguma ação da fila: abrir/encerrar sessão, conferir e marcar presença ou operar chamadas (gerente, recepção, enfermagem, quem atende). Gestão SMS, ACS e saúde bucal não veem | Uma ação própria "ver fila do dia" na matriz | Baixo |
| F2 | Presença (revisto por você: pelo QR) | Presença pelo QR (RN-PRES-01). A recepção só confere quem teve o QR recusado por pendência (RN-FILA-05); o botão aparece só para esses | Recepção marcando qualquer um | A conferência da prioridade ainda não é guardada na entrada (`conferenciaNaEntrada`): vale só no dia |
| Q1 | Onde o QR aparece antes da TV (fatia 2) | Tela "QR de entrada" no painel, para o monitor da recepção, vista por recepção e gerente | Esperar a TV pareada | Baixo: a TV usa a mesma rota de dados depois |
| Q2 | Um QR para várias sessões abertas da unidade | Segredo por sessão (criado na abertura, nunca sai da API); o QR é um link `filasaude://check-in?m=&u=&t=` com o token de cada sessão aberta; a câmera do celular abre o app | Um QR por sessão | QR mais denso com muitas sessões abertas ao mesmo tempo |
| Q4 | Pendências calculadas na leitura | Conta não verificada → "conta"; pessoa atendida que não é o dono e nunca foi conferida na unidade → "pessoa_atendida"; mais a prioridade a conferir (domínio). Pré-cadastro fica para a fatia 5 | Calcular na inscrição | Nenhum conhecido |
| F3 | Estação aberta ou fechada (RN-EST) | As estações da sessão abrem junto com a sessão; não há abrir/fechar estação | Botão na tela da estação | A estimativa conta estações que ninguém está usando |
| F4 | Login do app nativo | Plugin `bearer` do better-auth: o app guarda o token no SecureStore e manda `Authorization` (sem cookie, sem Origin); o guard do paciente (PD-34) é o mesmo | Cookie no `fetch` do React Native | Baixo; o JWT da PD-17 entra no lugar depois |
| F5 | Expo SDK 58 pede React 19.3 | React e React DOM 19.3.0 em todo o monorepo (`overrides` na raiz); painel testado e com `next build` ok | App fora dos workspaces | Uma atualização do Next pode exigir outra versão |
| F6 | O que o app mostra em "minhas" | Entradas ativas da conta (inclusive na lista de espera) e as finais por 12 h depois do fim da sessão | Só as da sessão do dia | Baixo |
| F7 | Inscrição em sessão privada pelo app | `409 sessao_privada` (código novo), antes do domínio | `transicao_proibida` | Só a mensagem |
| F8 | Idade no questionário do app | Calculada no fuso de Brasília para decidir emergência/apoio na hora; o nível que vale é o da API | Fuso da unidade | Um dia de diferença na virada, só no aviso local |
| F9 | Seed da fatia 1 | Serviço "Curativos" (sem triagem) e sessão pública "de agora" (hora cheia, 4 h) com Ana e Bruno inscritos pelo caminho do app | Sessão de hoje no Clínico (com triagem, fatia 3) | Baixo: só dados de exemplo |
| F10 | Encerrar sessão | Sem o aviso de sinal perdido (`semSinalSemContingencia` sempre falso) | Calcular pelo `ultimo_sinal_em` das estações | O aviso RN-SES-04 não aparece |

## Fatia 2 da v0.1 (2026-11-13)

Execução rápida, como as fatias 0 e 1. Plano: [plano-fatia-2-na-unidade](plano-fatia-2-na-unidade.md) (PD-47 a PD-50). **G6 precisa de você** (conta na Expo).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| G1 | Como a TV ganha o código | A TV se registra sozinha ao abrir `/tv` (código de 6 dígitos válido por 15 min, token guardado no navegador); revogada ou com o navegador limpo, mostra um código novo | O admin gera o código no painel e digita na TV | Baixo; limpar os dados do navegador da TV pede parear de novo |
| G2 | Rechamar na TV (RN-CHAM-02) | A chamada no domínio ganhou `rechamadas` (horários); a TV anuncia cada uma como chamada nova. O horário da chamada e a tolerância não mudam | Uma lista de anúncios à parte, só na API | Baixo |
| G3 | Quando sai o "venha agora" | Pela regra do domínio: remoto sem ninguém na frente na etapa. A tabela de notificações diz "venha agora (urgente confirmado)"; o domínio não exige urgência | Só para urgente confirmado (fatia 3, triagem) | Mais avisos "venha agora" do que a spec prevê |
| G4 | "Saia de casa" e "venha agora" juntos | Quem já é o próximo recebe só o "venha agora"; o "saia de casa" fica marcado como dado | Mandar os dois | Nenhum conhecido |
| G5 | Quais eventos viram push agora | Sua vez, pulado, saia de casa, venha agora. Rechamar não manda push (a TV e a tela já mostram). Sessão aberta, cancelada, remanejada e os da lista de espera ficam para as fatias que os criam | Push em toda mudança | O paciente não recebe "sua vez não chegou hoje" por push ainda |
| G6 | **Push no celular de verdade** | O app pede a permissão e registra o token da Expo, mas o token exige o `projectId` de um projeto EAS (`EXPO_PUBLIC_EAS_PROJECT_ID`), e o Expo Go no Android não recebe push remoto (desde o SDK 53): precisa de um build de desenvolvimento (`eas build --profile development`). Sem projeto, o app segue só com a consulta da tela | Notificação local disparada pela consulta (só com o app aberto) | **Precisa de você:** criar a conta/projeto na Expo (da empresa, junto com o D10) |
| G7 | Varredura e envio (T2.4 enxuta) | Dentro do processo da API, a cada 60 s; trava consultiva na geração; envio com `SKIP LOCKED`; 5 tentativas com espera 2, 4, 8, 16 min; token recusado pela Expo (`DeviceNotRegistered`) é apagado. Sem teste de duas instâncias ao mesmo tempo | Processo próprio do worker (T2.4 completa) | Médio em produção: vira processo próprio antes do piloto |
| G8 | Onde fica o token de push | Central (`dispositivo_push`), entrou na lista de colunas permitidas do INV-11 (não é dado clínico nem da fila); o mesmo aparelho logado em outra conta passa a avisar só a conta nova | No município | Baixo |
| G9 | Destaque da TV | Lido da config da unidade (`destaqueTvSegundos`, padrão 10 s); a TV consulta a cada 2 s, então o anúncio pode atrasar até 2 s | SSE (D1/D3) | Baixo |

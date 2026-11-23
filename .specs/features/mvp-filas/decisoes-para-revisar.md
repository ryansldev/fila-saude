# Decisões para revisar

Decisões tomadas durante a implementação autônoma das fases 1 e 2 (a partir de 2026-11-11). Cada uma ficou **provisória e reversível**: o código segue o que está aqui até você confirmar ou mudar. As já decididas saíram daqui e estão nas specs. Quando confirmar, a regra vai para a spec da capacidade e a decisão vai para `decisions.md` (constituição, processo 6).

Formato: **contexto** · **o que foi feito** · **alternativa** · **custa se errado**.

## Alinhamento de 2026-11-19 (respostas e perguntas em aberto)

Aprovadas e levadas à **AD-070**: CA1, F1 (idoso), S5, RV1, RV2, PD-21, G7, I3. As que você não comentou continuam abaixo, para você ver. As que você comentou ficam aqui **só anotadas, sem mudança no código** até voltarmos a elas:

| # | Sua resposta | O que fica para quando voltarmos |
| --- | --- | --- |
| RV7 | "O que a lei mandar" | O Estatuto da Pessoa Idosa (Lei 10.741/2003, art. 3º, § 2º, incluído pela Lei 13.466/2017) dá aos 80+ prioridade especial **sobre os demais idosos**; a Lei 10.048/2000 não ordena os outros grupos entre si. Ou seja: 80+ só antes dos 60–79, o contrário do código de hoje. Mudar a regra (spec e domínio) e confirmar com o advogado (D5) |
| G9/G10 | A estimativa vem dos atendimentos já feitos na mesma sessão (ou em sessões parecidas); sem nenhum, uma estimativa inicial fixa definida por quem criou a sessão; a partir do 1º atendimento, ele já conta | Redesenhar o tempo médio (RN-ETA) com essa regra: valor inicial na sessão, troca pelo dado real no 1º atendimento, uso de sessões parecidas |
| H4 | Gosta da triagem atendendo só uma sessão, mas não sabe se é válido: em UPA uma sala de triagem atende vários problemas | Investigar como as UBS e UPAs do piloto organizam a triagem (junto do D4) |
| L3 | Não entendeu | Explicado na conversa de 2026-11-19; aguarda a sua resposta |
| E1, E2 (encerramento) | Não entendeu | Explicado na conversa de 2026-11-19; aguarda a sua resposta |
| E4 (encerramento) | Pediu mais explicação | Explicado na conversa de 2026-11-19; aguarda a sua resposta |
| I10 | "Faça isso": aplicar a regra do titular (RN-ID-06) no alerta de faltas | A fazer, numa branch própria (com `titularDaFalta` e as faltas numa tabela) |
| E3 (papéis) | "Talvez possamos repensar" | Rever quem vê a resposta sobre pensamentos de tirar a própria vida (técnico de enfermagem hoje vê) |
| P1 | "Talvez valha um middleware" | Conferir as ressalvas (`condicoes()`) num hook comum das rotas do painel, em vez de cada rota lembrar |
| R2 | "Por que não?" (liberar o login de quem saiu da equipe) | Explicado na conversa de 2026-11-19; aguarda a sua resposta |
| PD-17 | O login do paciente deve ficar mais complexo depois | Rever junto com o login do paciente; nada agora |
| CP3 | Tem como contornar? | Explicado na conversa de 2026-11-19; aguarda a sua resposta |
| DA1 | "Vamos rever" | Rever o 401 antes da validação do corpo no painel |
| DA4 | Verificar os dados antes de rodar scripts | Um script que grave no banco confere os dados com os schemas antes; anotar no guia de scripts quando houver |
| F10 | Não entendeu | Explicado na conversa de 2026-11-19; aguarda a sua resposta |

## Lacunas das specs encontradas no domínio (fase 1A)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| G2 | RN-ORD-05 diz que a posição "nunca piora", e o exemplo da RN-ORD-03 piora | Segue o exemplo da RN-ORD-03 | Ajustar o texto da RN-ORD-05 | Só o texto da spec |
| G4 | Atraso no 1º pulo e na passagem triagem → atendimento | Não aplica atraso nesses dois casos, como no protótipo (`applyLate: false`) | Aplicar atraso | Ordem diferente após um pulo |
| G5 | "Vem depois de X" usa a chave atual de X ou a do momento da chamada? | Chave atual | Foto no momento da chamada | Só muda se o risco ou a prioridade de X mudar depois de chamado |
| G7 | Código de erro para estação desconhecida | Inconsistente (`nenhum_elegivel` em um lugar, `transicao_proibida` em outro) | Um código próprio (`estacao_desconhecida`) | Mensagem de erro confusa na API |
| G8 | "Aguardando início" (RN-ETA-02) | Esconde a posição; o protótipo mostrava | Mostrar a posição sem o tempo | O paciente não vê a posição antes da abertura |
| G9 | Tempo médio inicial | Um valor por etapa na unidade; a spec sugere por serviço | Por serviço | Estimativa pior no início do dia |
| G14 | Avisos que perderam a hora no envio | A varredura junta o último minuto (G7). No envio, a rechamada que vem junto de uma chamada da mesma entrada ainda não enviada sai (vai só a primeira), e a chamada ou rechamada seguida de "pulado" sai (vai só o "pulado"); ficam como `stale`. Achado do code review de 2026-11-23 | Enviar na hora do evento, sem esperar a varredura; ou mandar tudo | Baixo: o paciente deixa de ver uma rechamada que ainda não tinha recebido |
| G12 | Mapa no build próprio do Android | O Google Maps trava o app sem chave (o Expo Go traz a dele). Sem `GOOGLE_MAPS_ANDROID_API_KEY` no build, a aba de unidades não mostra o mapa, só a lista (o suporte fica no código); com a chave, o Google Maps com o nosso estilo. O app sabe se o build levou a chave pela marca `extra.googleMaps` da config gravada no build (a config pública não leva `android.config`, e a do Metro é a da máquina de quem roda) | Exigir a chave e travar o build sem ela; ou o mapa simplificado da web | Baixo: sem a chave, a aba fica só com a lista. Fora do v0.1 (você, 2026-11-20: "não é uma feat tão relevante"): fica só a lista; a chave volta com o pré-pagamento do Google Cloud ou a conta da empresa |
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

Os planos detalhados ([1B](../../arquivo/planos/mvp-filas/plano-fase-1b-fundacao-api.md), [fase 2](../../arquivo/planos/mvp-filas/plano-fase-2-configuracao.md)) registraram as decisões PD-14 a PD-31 em `plan.md`, cada uma com o motivo e o custo se estiver errada. Todas são **provisórias**. As que mais merecem o seu olhar:

| PD | Resumo | Por que olhar |
| --- | --- | --- |
| PD-17 | O login do paciente feito na central vale no município por um JWT EdDSA de 15 min, conferido pelo JWKS da central | Fecha o item em aberto do plan. Muda o app (troca sessão por token) e o prazo de bloqueio de conta |
| PD-15 | No app, o município vai no caminho (`/v1/municipalities/:slug/…`); no web, no subdomínio | Define o formato de todas as rotas do app |
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
| V3 | CORS (Task 10) | Hook próprio em vez de `@fastify/cors`; mutação em `/v1/panel` com `Origin` de outro município → 403 antes da rota (CSRF) | `@fastify/cors` | Baixo: um arquivo |
| V4 | Login do painel | Plugin username do better-auth: login só com letras, números, `.` e `_` (3–30) | Validador próprio que aceite hífen | Login com hífen dá 400 |
| V5 | `GET /v1/panel/units` e `/config` | Qualquer usuário logado vê as unidades dos seus perfis (gestor: todas) | Exigir uma ação da matriz | Baixo |

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

Execução rápida, como a fatia 0. Q3 e Q5 aprovadas em 2026-11-12 (AD-055; RN-ID-05). Plano: [plano-fatia-1-publica](../../arquivo/planos/mvp-filas/plano-fatia-1-publica.md) (PD-43 a PD-46).

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

Execução rápida, como as fatias 0 e 1. Plano: [plano-fatia-2-na-unidade](../../arquivo/planos/mvp-filas/plano-fatia-2-na-unidade.md) (PD-47 a PD-50). G6: projeto EAS criado (AD-071).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| G1 | Como a TV ganha o código | A TV se registra sozinha ao abrir `/tv` (código de 6 dígitos válido por 15 min, token guardado no navegador); revogada ou com o navegador limpo, mostra um código novo | O admin gera o código no painel e digita na TV | Baixo; limpar os dados do navegador da TV pede parear de novo |
| G2 | Rechamar na TV (RN-CHAM-02) | A chamada no domínio ganhou `rechamadas` (horários); a TV anuncia cada uma como chamada nova. O horário da chamada e a tolerância não mudam | Uma lista de anúncios à parte, só na API | Baixo |
| G3 | Quando sai o "venha agora" | Pela regra do domínio: remoto sem ninguém na frente na etapa. A tabela de notificações diz "venha agora (urgente confirmado)"; o domínio não exige urgência | Só para urgente confirmado (fatia 3, triagem) | Mais avisos "venha agora" do que a spec prevê |
| G4 | "Saia de casa" e "venha agora" juntos | Quem já é o próximo recebe só o "venha agora"; o "saia de casa" fica marcado como dado | Mandar os dois | Nenhum conhecido |
| G5 | Quais eventos viram push agora | Sua vez, pulado, saia de casa, venha agora e, desde a AD-072, a rechamada. Sessão aberta, cancelada, remanejada e os da lista de espera ficam para as fatias que os criam | Push em toda mudança | O paciente não recebe "sua vez não chegou hoje" por push ainda |
| G6 | **Push no celular de verdade** | O app pede a permissão e registra o token da Expo, mas o token exige o `projectId` de um projeto EAS (`EXPO_PUBLIC_EAS_PROJECT_ID`), e o Expo Go no Android não recebe push remoto (desde o SDK 53): precisa de um build de desenvolvimento (`eas build --profile development`). Sem projeto, o app segue só com a consulta da tela | Notificação local disparada pela consulta (só com o app aberto) | Projeto EAS na organização `fila-saude` (AD-071); push testado no aparelho com o build de desenvolvimento (2026-11-20); o `google-services.json` vem da variável secreta do EAS |
| G8 | Onde fica o token de push | Central (`dispositivo_push`), entrou na lista de colunas permitidas do INV-11 (não é dado clínico nem da fila); o mesmo aparelho logado em outra conta passa a avisar só a conta nova | No município | Baixo |
| G9 | Destaque da TV | Lido da config da unidade (`destaqueTvSegundos`, padrão 10 s); a TV consulta a cada 2 s, então o anúncio pode atrasar até 2 s | SSE (D1/D3) | Baixo |

## Revisão de todas as fatias (2026-11-13)

Pedido seu: revisão rígida do código todo. Quatro revisores (domínio, API, painel, app) acharam cerca de 90 problemas; os confirmados foram corrigidos com teste antes (API 221, painel 92, domínio 336, schemas 63, app 25). Commits `7e9c454`..`dc44b77`.

**Corrigido (principais):** CPF validado (dígitos) no cadastro e na "outra pessoa", no app e na API; nascimento real, não futuro, até 130 anos; app não diz mais "a fila começa às 7h" depois das 7h nem "aguardando início" com a fila andando, só diz "hoje" quando é hoje, não mostra cancelada como "não compareceu" e mostra "hora de sair de casa" quando o push saiu; CPF de outra pessoa não revela nome nem ocupa a vaga dela; sessão sempre encerrável (estação em uso não sai); sessão exige estação que chame; inscrição depois do fim recusada; mais vagas promovem a reserva; "venha agora" não vai para quem já perdeu a vez; "não compareceu" fora do tempo médio; painel sem piscar nem trocar a sessão escolhida; recepção marca presença de qualquer remoto e vê nascimento e CPF mascarado; TV sem depender do relógio dela; 401 volta ao login; sair do app desliga o push do aparelho.

**Provisórios desta revisão:**

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| RV3 | Remover estação | Recusado se estiver em sessão planejada ou aberta (`estacao_em_uso`) | Tirar das planejadas automaticamente | Precisa editar as sessões futuras antes |
| RV4 | Conferência de documento | Painel mostra nascimento e CPF `•••.982.247-••`; "não confere" pede o motivo | CPF inteiro | Baixo |
| RV5 | Nascimento depois da verificação | A conta verificada não muda a data pelo app (`birth_date_verified`); só a recepção | Desfazer a verificação | Correção de data pede ida à recepção |
| RV6 | Sessão aberta esquecida de outro dia | Continua na lista da fila do dia até alguém encerrar; a estação opera a sessão aberta mais recente | Encerrar sozinha (worker) | Precisa encerrar à mão |

**Respondidas por você (2026-11-13):** RV8 → fila nova depois da triagem; RV9 → só o enfermeiro confirma, com as cores do Acolhimento com Classificação de Risco na fatia 3; RV10 → fim do seu nível; RV11 → todo remoto sem ninguém na frente (AD-056, implementado). RV7 continua aberta (ver abaixo).

**Precisa de você (regra da spec ambígua; o código segue como estava):**

| # | Pergunta | Hoje |
| --- | --- | --- |
| RV7 | 80+ vem antes de todos os grupos de prioridade legal, ou só antes dos idosos 60–79? | Antes de todos. **Você (2026-11-19): o que a lei mandar** (ver o alinhamento no topo) |
| RV8 | Quem passa da triagem ao atendimento entra com a janela protegida (fica atrás dos K presentes)? RN-TRI-04 diz que vale a posição original | Entra com a janela |
| RV9 | Alocar paciente confirma o risco sugerido (vira urgência confirmada)? E1 diz que só o enfermeiro confirma | Confirma |
| RV10 | Quem perde a vez vai para o fim de todos os presentes, ou só do seu nível de risco/prioridade? | Fim do seu nível |
| RV11 | "Venha agora" só para urgente confirmado (tabela de notificações) ou para todo remoto sem ninguém na frente (domínio, G3)? | Todo remoto |

**Ficou para depois (anotado, sem correção agora):** triagem confirmar risco pela estação e chave de ordem gravada na chamada (fatia 3); relançar remanejado de serviço regulado e reconciliação da contingência (domínio, fases 5/8); juntar filas de serviços diferentes na mesma estação (RN-EST-03); bloqueio após tentativas de login, captcha e limite de requisições (1B Tasks 13); abrir e encerrar sessão sozinho no horário (worker); fechar/abrir estação no meio do dia; tela de explicação antes de pedir a permissão de notificação; corrida rara entre cancelar sessão e inscrição na reserva, e entre dois gestores se removendo; botões "Alterar/Remover" da equipe para quem o gerente não pode mexer.

## Fatia 3 da v0.1 (2026-11-14)

Execução rápida, como as fatias anteriores. Plano: [plano-fatia-3-triagem](../../arquivo/planos/mvp-filas/plano-fatia-3-triagem.md). Antes da triagem, terminei o **AD-057** (prazo de chegada depois do "venha agora"), que o commit `e285362` deixou pela metade: o domínio estava com 17 testes falhando e sem `avisosVenhaAgora`.

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| H1 | Cores da triagem (AD-056) | **Respondida por você (2026-11-14): Manchester padrão** → AD-058, cinco cores com o nível novo `muito_urgente` (laranja) | — | — |
| H2 | Vermelho na triagem | **Respondida por você (2026-11-14)** → AD-059: vermelho vai ao 1º lugar do atendimento da unidade; "Encaminhar à emergência" é um botão à parte, só com vermelho, que tira da fila | — | — |
| H3 | Classificar é obrigatório? | Sim: com alguém chamado na triagem, "Finalizar" e "Chamar próximo" pedem a cor (`422 classifique_o_risco`); "Não compareceu" e "Rechamar" não | Manter o sugerido quando o enfermeiro não escolhe | Baixo; um toque a mais por paciente |
| H4 | **Triagem com vários serviços (RN-TRI-02): adiada** | A estação de triagem atende uma sessão aberta por vez (a mais recente), como antes. Juntar filas de sessões diferentes numa chamada fica para depois da v0.1 (já anotado como RN-EST-03) | Comparar o 1º elegível de cada sessão (urgência, risco, prioridade; empate por quem chegou antes) | Médio: com dois serviços com triagem abertos ao mesmo tempo na mesma sala, só um é chamado |
| H5 | O que o paciente vê da triagem | "triagem feita. agora, o atendimento" e a posição; a cor não aparece no app | Mostrar a cor | Baixo |
| H6 | RN-PIORA-01 | Só a orientação: quem está na unidade vê "meus sintomas pioraram", que manda avisar a recepção ou a enfermagem e tem o botão do 192. Reclassificar no balcão fica para a recepção (fase 7) | Reaplicar o questionário pelo app | Baixo |
| H7 | AD-057 em modo manual | Sem "venha agora" não há prazo, então remoto não perde a vez por atraso; só os pulos decidem | Usar a hora de abertura da sessão como início do prazo | Baixo: modo manual é exceção |
| H8 | Chave do push "venha agora" | Passou a incluir a hora (`venha_agora:item:etapa:em`), porque "Vou sair" recomeça e pode haver um segundo "venha agora" na mesma etapa | Manter uma por etapa | Nenhum conhecido |

H1 e H2 respondidas (AD-058, AD-059). RV7 continua aberta.

## Fatia 4 da v0.1 (2026-11-16)

Execução rápida. Plano: [plano-fatia-4-privada](../../arquivo/planos/mvp-filas/plano-fatia-4-privada.md). Lista de espera pelo app, alocação pelo agendador e confirmação.

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| I1 | Onde o paciente entra na lista | Na página da unidade, "serviços com lista de espera" (ativos, modo livre) | Uma aba própria "lista de espera" | Baixo |
| I2 | Serviço com requisição antes da T5.2 | A API recusa (`409 requisicao_em_breve`) e o app explica | Criar "aguardando encaminhamento" sem a foto | Baixo |
| I4 | Alerta ao agendador (RN-RISCO-03) | Visual: urgente sugerido não alocado no topo da sugestão com selo; a tela de Agendamento mostra a contagem por serviço e uma faixa (não no menu, que não consulta a API) | Push ou e-mail para a equipe; contagem no menu | Baixo |
| I5 | "Remover" e "trocar" (RN-AL-04) | Remover = recusa em nome do paciente (volta à lista com a data original, não é sugerido de novo para a sessão); trocar = remover + alocar | Uma transição própria "desalocar" que não marca a sessão como recusada | Baixo |
| I6 | "Sem contato" (RN-CONF-02) | Só anota a tentativa (auditoria e "última tentativa" na lista de ligação) | Liberar a vaga após N tentativas | Baixo |
| I7 | Conflito entre agendadores (INV-08) | Trava da sessão e da entrada; o segundo recebe 409 com a sugestão atualizada | Trava otimista pela `versao` enviada pelo painel | Baixo |
| I8 | Texto do push "confirme" | "confirme sua consulta" + serviço, unidade, dia e hora; sem sintoma | — | Baixo |
| I10 | Alerta de faltas (RN-FALTA-03, RN-AL-03) | Conta as faltas da mesma pessoa atendida nos encerramentos da janela (padrão 2 em 90 dias), sem a regra do titular (RN-ID-06: responsável x pessoa conferida) | Aplicar `titularDaFalta` e guardar as faltas numa tabela própria | Baixo na v0.1; revisar antes do piloto |

## Design system (2026-11-16)

Design: [design-system/design.md](../design-system/design.md); plano: [design-system/plan.md](../../arquivo/planos/design-system/plan.md). Pacote `@fila-saude/design` (tokens), um `Botao` no app e um `Button` no painel com as mesmas variações, travas que falham com botão fora do kit, Agendamento no caminho A.

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| DS1 | Azul do painel | O azul do app (`#1a73c8`) em todo o painel: o de antes tinha contraste 3,76 com texto branco (abaixo do AA) | Manter o azul claro só fora dos botões | Baixo: o painel ficou um pouco mais escuro |
| DS2 | Botão desativado | 45% de opacidade e sem relevo nos dois | Fundo cinza no painel, como antes | Baixo |
| DS3 | Contador do menu | Pessoas para ligar da unidade escolhida, a cada 60 s | Somar os alertas de urgência | Baixo |
| DS4 | Variação `textoPerigo` | Acrescentada ao design: links vermelhos de baixo peso ("não vou poder ir", "meus sintomas pioraram", lixeira) | Usar `perigoContorno` | Baixo |
| DS5 | Toques que não são botão no app | `AreaTocavel` e `Segmentado` no kit (a linha da conta e o cartão de município mantêm a aparência) | Um `ItemDeLista` único | Baixo |
| DS6 | Botões de texto no app | Quebram em até 2 linhas; os de relevo, 1 linha com reticências | Cortar todos em 1 linha | Baixo |
| DS7 | Diálogo de confirmação perigosa | Botão `perigo` cheio (única ação decisiva do modal) | `perigoContorno` | Baixo |
| DS8 | Ruído na sugestão | Sem selo para rotina sugerida e sem "Sem sinais de risco" nos motivos | Selo em toda linha | Baixo |

## QR de entrada e unidade no menu (2026-11-16)

Design: [qr-e-unidade.md](../design-system/qr-e-unidade.md).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| QU1 | QR da TV | A TV também usa o QR novo (pontos pretos, coração azul) | Manter o QR quadrado na TV | Baixo |
| QU2 | Tela do paciente | Aberta pela equipe, numa aba nova (`/qr-paciente`), com a sessão dela; fora do menu, como a TV | Pareamento próprio, como a TV | Baixo |
| QU3 | Menu por unidade | O menu mostra só o que a pessoa pode fazer na unidade escolhida | Menu com tudo, páginas recusam | Baixo |
| QU4 | Unidade inicial | A guardada, se ainda vale; senão, a primeira (antes, com várias, a página pedia a escolha) | Pedir a escolha | Baixo |
| QU5 | Resumo de hoje | Rota leve `/unidades/hoje`, calculada das sessões (vale para a gestão SMS, que não tem ação da fila) | Junto da lista de unidades | Baixo |


## Estação: chamado, compareceu e a fila à vista (2026-11-16)

Design: [estacao.md](../design-system/estacao.md).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| ES1 | "Compareceu" | Uma marcação na chamada (`compareceuEm`), sem estado novo na fila | Estado "na sala" na máquina de estados | Baixo: um relatório de tempo de sala lê a marcação |
| ES2 | Fechar sem Compareceu | Triagem recusa (`sem_comparecimento`); consultório marca sozinho na hora de fechar (aprovado na conversa) | Recusar nos dois | Baixo |
| ES3 | "O mais antigo" | Fica vermelha depois do tempo-alvo da cor confirmada (urgência confirmada ou passou pela triagem); sem cor confirmada, 30 min | Usar a cor sugerida pelo app | Baixo: serviço sem triagem nunca usa a cor do app |
| ES4 | Chips da fila | Só senha e primeiro nome, até 3 de cada grupo e "+N" | Nome completo | Baixo |
| ES5 | Troca de estação | Cartão de uma linha e painel lateral "Em qual estação você está?", como a unidade | Menu suspenso | Baixo |

## TV branca e azul (2026-11-16)

Design: [tv.md](../design-system/tv.md).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| TV1 | Topo da TV | Só o nome da unidade, sem o endereço (a TV não o recebe) | Trazer o endereço na API da TV | Baixo |
| TV2 | Hora | Pelo relógio da TV, atualizada a cada 10 s | Hora do servidor | Baixo: TV com relógio errado mostra a hora errada |

## App: página da unidade com a faixa de dias (2026-11-16)

Design: [app-unidade.md](../design-system/app-unidade.md).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| AU1 | Filtros por serviço | Saíram ("todos", "curativos", …): com a faixa de dias, a lista de um dia já é curta | Manter os filtros junto da faixa | Baixo |
| AU2 | Botão do calendário | Aparece sempre que a faixa tem mais de um dia | Só quando a faixa não cabe na tela | Baixo |
| AU3 | Lista de espera | Uma seção abaixo dos atendimentos, um cartão por serviço com o botão embaixo do nome | O cartão "não achou o dia?" levando a outra tela | Baixo |

## App: entrar (2026-11-16)

Design: [app-entrar.md](../design-system/app-entrar.md).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| EN1 | Olho da senha | Dentro do campo, no `CampoSenha` do kit: vale para o app inteiro (cadastro também) | Só na tela "entrar" | Baixo |
| EN2 | "ver as unidades perto de mim" | Abre a lista de unidades do município (não pede login) | Abrir a unidade em que a pessoa se inscreveu por último | Baixo |

## App: criar conta, uma pergunta por tela (2026-11-16)

Design: [app-cadastro.md](../design-system/app-cadastro.md).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| CA2 | CPF já com conta | Volta à tela do CPF com o erro e "entrar com este CPF" (abre o "entrar" com o CPF preenchido) | Só o erro | Baixo |
| CA3 | "confira" | Tela com o resumo e "corrigir" por linha antes de criar a conta | Criar direto da tela do e-mail | Baixo: um toque a mais |

## App: a aba "hoje" como bilhete (2026-11-16)

Design: [app-hoje.md](../design-system/app-hoje.md).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| HO1 | Quem vira o bilhete | venha agora → mostre na recepção → na unidade → na fila em casa (menor posição) → sem previsão → para confirmar → aguardando a fila abrir | Na unidade antes de "venha agora" (a Ana, na unidade para o clínico geral, vê primeiro o "venha agora" dos curativos) | Baixo |
| HO2 | Confirmar a data | "vou, confirmar" é o botão do bilhete; "não posso nesta data" fica no "⋯" | Os dois no bilhete | Baixo |
| HO3 | Outros dias | Um número na aba "atendimentos" no lugar do cartão "mais 1 atendimento" | Manter o cartão | Baixo |
| HO4 | O número da aba "atendimentos" nas outras abas | Aparece em todas as abas; "unidades" e "conta" buscam a lista uma vez ao abrir, sem repetir a cada 3 s (pode ficar velho enquanto a pessoa está nelas) | Repetir a consulta em todas as abas | Baixo |
| HO5 | O sininho | No topo de todas as telas com conta; tocar abre a tela dos avisos, que mostra se estão ligados, oferece ligar ou leva aos ajustes do celular | Uma gaveta no lugar da tela; só nas abas | Baixo |
| HO6 | Dr. Lino no "hoje" | Sem a caixa branca, direto no fundo cinza-claro (`#f4f7f8`), como o usuário pediu depois de ver a faixa branca | Faixa branca de ponta a ponta (testada e recusada) ou redesenhar o jaleco branco no SVG | Baixo |

## App: a inscrição com o Dr. Lino e a relação (2026-11-16)

Design: [app-inscricao.md](../design-system/app-inscricao.md).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| IN1 | Texto das declarações para outra pessoa | Responsável legal: "declaro que sou responsável legal por {Ana}"; quem cuida ou ajuda: "{Ana} sabe e concorda com esta inscrição". Só o responsável legal responde pela pessoa; para adulto vale a concordância (mandato, CC art. 656); o dado de saúde segue a LGPD art. 11, II, sem depender disso. Provisório até o D5 | Uma declaração única para todos | Só o texto (app) |
| IN2 | As relações | Três, como as pessoas se veem: "sou mãe, pai ou responsável legal de {Ana}", "cuido de {Ana} no dia a dia", "sou da família ou amigo de {Ana} e estou ajudando" (inclui quem faz um favor aos pais ou avós) | Mais opções ou separar família de amigo | Uma migração de valores e o texto no painel |
| IN3 | O que o painel mostra | Pílula "por Carla (família ou amigo)" na linha da Fila do dia ("responsável legal", "cuida no dia a dia"), sem gênero e só com o primeiro nome | Nome completo, ou também na estação | Baixo |
| IN4 | Recusa da conferência num dado | A conferência roda depois da relação; erro do CPF volta para a tela do CPF, erro da pessoa para a do nome | Conferir a cada tela | Uma chamada a mais por tela |

## Nomes do código em inglês (2026-11-17)

Ao terminar a troca (ver [nomes no código](../../specs/nomes-no-codigo.md)).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| NC1 | Comentários e títulos dos testes | Seguem em português; só os nomes do código citados neles foram trocados. A tabela diz "comentários e testes em inglês", mas traduzir todos é outra tarefa, sem mudar comportamento | Traduzir tudo agora | Baixo: um passe só de texto, quando quiser |
| NC2 | Migrações recriadas do zero | `0000_central` e `0000_municipal` substituem as 15 antigas. Banco antigo não migra: o migrador para com "recrie o banco" ao ver migração fora do journal; apague os bancos `fila_*` do `postgres-dev` e rode `npm run dev:seed` | Migrações de rename sobre as antigas | Nenhum enquanto não há piloto; com dados reais seria inaceitável |
| NC3 | Códigos que eram só em português | `email_in_use`, `invalid_credentials`, `password_too_short`/`_long`, `immutable_field`, `birth_date_verified`, `person_mismatch`, `invalid_response`, `invalid_phone`, `invalid_rrule`, `occurrence_not_found`; avisos `pending`/`sent`/`failed`/`no_device`; lista de sessões com `?from=&until=`; campo `selfHarm` na sugestão do agendador. Endereços das telas seguem em português (`/inscricao/lista`, `/inscricao/refazer`) | Outros nomes | Baixo: troca em um lugar e nos testes |
| NC4 | Ressalvas da matriz e logins de exemplo | Ficam em português: a ressalva é o texto da spec (`"atendimento"`), o login é o que a pessoa digita (`recepcao`) | Chaves em inglês | Baixo |

## Captcha e tentativas: detalhes das rodadas de review (2026-11-18)

Decisões tomadas durante os code reviews da AD-062 a AD-065.

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| CP1 | Respostas da Cloudflare | Só `invalid-input-response` conta como erro no par (token inventado). `timeout-or-duplicate` (token vencido ou repetido) e a Cloudflare sem responder ou com a nossa configuração errada (`invalid-input-secret` e afins, que vão para o log) devolvem a vaga sem contar. Todos respondem `captcha_failed` no login. Risco conhecido: chave do site e segredo de widgets diferentes fazem a Cloudflare responder `invalid-input-response` para todos, e isso conta como erro (só passado o teto) | Contar tudo como erro, ou nada | Baixo: no pior caso, um atacante resolve captchas de verdade e erra sem gastar o par (o teto segue contando) |
| CP2 | Cloudflare fora do ar na inscrição | 503 `captcha_unavailable` ("a verificação está fora do ar agora"), separado de `captcha_failed` (400), para o paciente não achar que errou e o monitoramento ver a queda | O mesmo `captcha_failed` | Baixo: só o texto e o status mudam |
| CP3 | Fila por chave em cada instância | Até 20 pedidos da mesma chave esperam; além disso, a reserva responde "ocupado" (429). Contra uma enxurrada maior numa só conta, o dono também ouve "espere alguns segundos" enquanto ela dura | Fila sem limite (a espera cresce sem fim) | Médio: um ataque grande numa conta a deixa lenta ou "ocupada" para o dono enquanto dura |

## Docs da API: schemas no Fastify (2026-11-18)

Decisões da migração das rotas para o schema no Fastify (DOC2, [plano](../../arquivo/planos/docs-api/plan.md)).

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| DA1 | Painel sem login com corpo inválido | O login do painel vai para o `preValidation` (hook em `infra/panel/guard.ts`): sem login é 401 antes do schema (corpo, query e caminho); só o corpo que nem é JSON o Fastify recusa antes, ao ler o pedido (400). Antes, as mutações conferiam o corpo primeiro e respondiam 400 | Manter o 400 primeiro (o login ficaria no handler, depois do schema) | Baixo: só muda o erro de quem não está logado; o painel logado não vê diferença |
| DA2 | Resposta fora do schema | Vira 500 `internal_error` com log, pelo serializador; antes o `validate()` da saída respondia 400 `invalid_input`, como se o erro fosse de quem chamou | Manter 400 | Baixo: só aparece com bug no servidor |
| DA3 | Comando da estação sem corpo | O schema aceita `null` (o Fastify entrega `null` sem corpo) e o comando vale com as opções padrão, como antes | Exigir `{}` | Quebraria o painel, que manda os comandos sem corpo |
| DA4 | Leituras do painel que não validavam a resposta (unidades, serviços, estações, sessões, equipe, configuração) | Agora passam pelo schema de saída, que herda as regras da entrada (CNES com 7 dígitos, prefixo em maiúsculas…). Não há dado antigo: o banco foi recriado do zero (NC2) e todo dado entra pelas rotas de criar e editar, que já validavam | Schemas de saída sem as regras da entrada | Médio se um script gravar fora das regras: a lista inteira vira 500 (aparece no log como "resposta fora do schema") |
| DA5 | Códigos de 409 na referência | Cada rota que pode dar 409 lista todos os códigos de 409 da API: as recusas do domínio (`ERROR_CODES` de `packages/domain`), as que a própria API lança e `duplicate`. Um teste varre o código e falha se um 409 novo ficar fora da lista | Listar à mão, rota por rota, só os que cada uma pode dar | Baixo: a referência mostra códigos a mais em algumas rotas |
| DA6 | Rotas do better-auth (`/v{n}/auth/*`, `/v{n}/panel/auth/*`) na referência | Ficam fora dos documentos OpenAPI e do teste de cobertura; o guia de autenticação das docs explica o login do paciente e do painel | Juntar o documento do plugin OpenAPI do better-auth ao nosso | Baixo: quem integra lê o login no guia, não na referência |
| DA8 | "Testar a rota" (playground) na referência | Desligado: a API só aceita chamadas do navegador vindas do painel do município (CORS), então a página das docs não consegue chamar nem a de produção (AD-069) nem a local. Liga quando a API aceitar as docs no CORS ou com o proxy do Fumadocs | Ligar com o proxy do Fumadocs já agora | Baixo: quem integra usa o exemplo em cURL de cada rota |
| DA9 | Várias versões da API (AD-068) | A versão sai do caminho (`/v{n}`, sem zero à esquerda) em todo filtro de rota (painel, login, referência). `npm run docs:openapi` grava um `apps/api/openapi/v{n}.json` por versão e apaga o de versão que sumiu; o site monta uma aba de referência por arquivo que achar, e os guias linkam `/docs/api/atual/…`, que leva à mais nova. O login (better-auth) e as rotas de teste continuam montados só em `/v1` | Um documento só, com todas as versões | Baixo: muda só como a referência é montada |
| DA10 | A cara e o texto das docs | Títulos e menu em minúsculas, Nunito extrabold, cartões com relevo, passos em pílula azul-clara e o Dr. Lino na introdução, como a landing; cores dos avisos e do tema saem do `packages/design`. Texto no tom do Duolingo: frases curtas, "você", cada guia com objetivo, passos e "deu errado?". Siglas (API, TV, QR) e nomes de pessoas ficam como são | Docs em frase normal, como o painel | Baixo: só o visual e o texto das docs |
| DA11 | O que as docs públicas contam dos limites | Só os códigos e o que fazer em cada um; sem os números (tentativas, tempo, teto por hora) nem como a contagem funciona, que ficam nas specs (AD-064, AD-065). Também saíram os IDs internos das descrições do OpenAPI | Documentar os valores para quem integra | Baixo: quem integra trata pelo código, não pelo número |
| DA12 | `api.filasaude.com.br` caía no tenant "api" (AD-069) | `api`, `www`, `homolog`, `docs` e `admin` são rótulos reservados, só no Host e na criação: o Host com eles não define município (o app manda o município no caminho) e não se cria município com esses nomes; o caminho e o modo single não mudam. Município antigo com esses nomes: a API sobe e avisa no log (o painel e a TV dele param). A homologação roda com `TENANT_BASE_DOMAIN=homolog.filasaude.com.br`. A referência da API lista produção, homologação e dev; o build das docs da homologação troca só os guias (`DOCS_API_URL`, `DOCS_PANEL_URL`), e na referência quem lê escolhe o servidor | Um domínio separado para a API do app (ex.: `filasaude-api.com.br`) | Baixo: um município não pode se chamar "api", "www", "homolog", "docs" ou "admin" |

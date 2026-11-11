# Decisões para revisar

Decisões tomadas durante a implementação autônoma das fases 1 e 2 (a partir de 2026-11-11). Cada uma ficou **provisória e reversível**: o código segue o que está aqui até você confirmar ou mudar. Quando confirmar, a regra vai para a spec da capacidade e a decisão vai para `decisions.md` (constituição, processo 6).

Formato: **contexto** · **o que foi feito** · **alternativa** · **custa se errado**.

## Lacunas das specs encontradas no domínio (fase 1A)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| G1 | Janela protegida (RN-ORD-01): "os K primeiros de ordem(elegíveis)" | Conta pela **ordem real de chamada**, com as travas de atraso. A ordem pura quebra o exemplo da RN-ORD-03 | Ordem pura e reescrever o exemplo | A janela protege outra pessoa em casos raros |
| G2 | RN-ORD-05 diz que a posição "nunca piora", e o exemplo da RN-ORD-03 piora | Segue o exemplo da RN-ORD-03 | Ajustar o texto da RN-ORD-05 | Só o texto da spec |
| G3 | "Vou sair" e as travas de quem estava atrás | Ao sair, a pessoa libera as travas que apontavam para ela, como no protótipo. A spec não diz nada, e sem isso a fila pode travar | Manter as travas | Fila travada em sair/voltar repetido |
| G4 | Atraso no 1º pulo e na passagem triagem → atendimento | Não aplica atraso nesses dois casos, como no protótipo (`applyLate: false`) | Aplicar atraso | Ordem diferente após um pulo |
| G5 | "Vem depois de X" usa a chave atual de X ou a do momento da chamada? | Chave atual | Foto no momento da chamada | Só muda se o risco ou a prioridade de X mudar depois de chamado |
| G6 | "Chamar próximo" sem ninguém elegível | Não muda nada. A chamada anterior continua aberta (Review Focus 2 do plano); o protótipo fechava | Fechar a anterior | Um toque a mais para liberar a estação |
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

## Configurações (fase 2, Task 4)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| C1 | Herança de configurações compostas (alerta de faltas, "ainda precisa?", prazos de prioridade) | O objeto inteiro é herdado: a unidade ou define tudo ou herda tudo | Herdar campo a campo | A unidade não consegue mudar só o número de faltas sem repetir os dias |

## Permissões (fase 1A, Task 12)

| # | Contexto | O que foi feito | Alternativa | Custa se errado |
| --- | --- | --- | --- | --- |
| P1 | Células com ressalva ("próprios", "só ao aplicar no balcão", "na alocação ou lançamento") | `pode()` libera qualquer célula preenchida. A nova `condicoes()` devolve as ressalvas, e a API é obrigada a conferi-las | `pode()` só libera ✓ sem ressalva | Uma rota que use só `pode()` deixaria um paciente ver dados de outro: a revisão da API precisa cobrir isso |
| P2 | "Chamar, rechamar, pular, finalizar" | Uma ação só (`operar_chamadas`), sem separar triagem de atendimento | Duas ações | A matriz não distingue a estação de triagem |

## Processo e ambiente

| # | Contexto | O que foi feito | Custa se errado |
| --- | --- | --- | --- |
| E1 | Branches | Fase 1 (1A + 1B) continua em `feat/domain-fase-1a`, que já está no GitHub e não foi renomeada. A fase 2 fica em `feat/fase-2-configuracao`, criada a partir do fim da fase 1 | Renomear depois |
| E2 | Paralelismo | Tasks independentes rodam em worktrees separadas e são juntadas na branch da fase | Commits de merge no histórico |

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

# MVP Filas UBS/Policlínicas

**Approved**: 2026-11-04 - user: "essa é a spec MVP já ok"

Regras detalhadas: [source.md](source.md) (RN-*, INV-*, RNF-*, contratos 9.3, questionário 7.3, TV 12.1). Esta spec só registra escopo e desvios da fonte.

## Problem Statement

Trocar a fila física de UBS/policlínicas por fila remota: paciente espera em casa e vai quando a vez está perto. Meta: espera presencial < 10 min.

## Out of Scope

Igual à fonte §2, mais: migrar entradas entre unidades na transferência.

## Assumptions & Open Questions

Desvios confirmados (y) e propostas da fonte a validar antes do piloto (n).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Risco × prioridade legal | Config do município (AD-004) | Decisão local | y |
| Posição do presente | Ordem real (AD-002) | RN-ETA-01 enganava | y |
| Remoto já 1º | "venha agora" (AD-003) | "1º · ~0 min" engana | y |
| Pulo automático | Removido (AD-006) | Pulava quem estava em consulta | y |
| "Saia de casa" com triagem | Por etapa (AD-009) | RN-TRI-05 não acontecia | y |
| Atraso | Por ordem, não por número (AD-010) | Urgente com nº maior tirava a vez | y |
| Visibilidade | Por sessão; privada só sinaliza interesse (AD-011) | Nem toda unidade tem os mesmos serviços | y |
| Confirmação da inscrição pública | Já entra confirmada (AD-013) | Paciente escolheu o dia | y |
| Encaminhamento em sessão pública | Segura a vaga até aceito; liberada na abertura (AD-015) | Fonte não definia | y |
| Pré-cadastro por sessão | Opção "dispensa pré-cadastro" (e vínculo), só em sessão pública (AD-016) | Plantão atende quem aparecer | y |
| Prova de identidade | Nível de confiança; verificada pela recepção no 1º check-in; gov.br depois do piloto (AD-017) | Sem depender da prefeitura para lançar | y |
| Inscrever outra pessoa | Responsável informa a pessoa atendida na inscrição, sem cadastro de dependentes (AD-018) | Pais marcam para filhos; familiares para idosos | y |
| Recuperação de acesso | E-mail obrigatório + recepção como alternativa (AD-019) | Parte do público não lembra o e-mail | y |
| Data da sessão | Recorrência RFC 5545 (AD-014) | Padrão de mercado (Google Calendar) | y |
| Nome na TV | Nenhum; só senha. Presencial recebe papel com a senha (AD-012) | Primeiro nome repete; mais que isso fere a privacidade | y |
| Questionário v1 (7.3) | Como na fonte | Validar com enfermeiro/médico no D8, antes do piloto | n |
| Marcação de especialidade | Dois modos por serviço: requisição pelo app (paciente marca de casa) ou regulado pela central (agendador lança); integração com a regulação depois do piloto (AD-026) | Municípios diferem; integração depende da secretaria e do DATASUS | y |
| Validade da requisição | Levantar no D6: não há prazo nacional e a guia muitas vezes não traz data | Depende do município | n |
| Exclusão de fotos (RNF-LGPD-04) | Retidas enquanto cadastro ativo | Depende do jurídico | n |
| Tempo médio (RN-ETA-05), triagem cadenciada (RN-TRI-06), reativação 30 d (RN-PARADA-02) | Valores da fonte | Propostas | n |
| 3 pulos = falta | Sempre, com ou sem check-in; recepção anula com motivo (AD-021) | Quem sai sem avisar não escapa; o caso injusto se resolve no balcão | y |
| Destaque da chamada na TV | Configurável por unidade, padrão 10 s (AD-022) | Unidades de tamanhos diferentes | y |
| Poder da recepção sobre a prioridade legal | Dá só na inclusão pelo balcão, tira a qualquer momento; relatório ao gestor (AD-023) | Evita subir quem já está na fila | y |
| Prioridade legal declarada | Aviso ao declarar; conferida pela recepção ou na chamada pelo profissional; pendência não tira a vez (AD-024, AD-050); vale nas próximas idas, exceto as com prazo | Autodeclaração aberta demais | y |
| Grupos de prioridade legal | Lei 10.048 + Lei 14.626/2023 (inclui mobilidade reduzida e doador de sangue), lista fixa no código (AD-025) | Sem tela de edição antes de saber se algum município precisa | y |
| Prioridade ao marcar para outra pessoa | Da pessoa atendida; criança de colo atendida mantém a prioridade; a do acompanhante não passa (AD-027) | Padrão até o D5 | n |
| Contingência | Lista do dia impressa + reconciliação na volta; sem falta no período da queda, registrado com motivo e cruzado com o sinal de vida da TV e das estações; app avisa indisponibilidade (AD-020) | Piloto sem alta disponibilidade | y |
| Abrangência por endereço | Fora do MVP | Fonte em aberto | n |
| Hospedagem municipal | MVP e piloto na AWS sa-east-1, setup enxuto (PD-12); longo prazo e cobrança no D7 | Arquitetura | y |

**Open questions:** none.

## User Stories

US-01..US-13 (P1) e US-14..US-19 (P2) conforme fonte §14, com os desvios acima.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AG-01 | US-01 | Design | Pending |
| LE-01 | US-02 | Design | Pending |
| RISCO-01 | US-02 | Design | Pending |
| ENC-01 | US-03 | Design | Pending |
| AL-01 | US-04 | Design | Pending |
| CONF-01 | US-05 | Design | Pending |
| FILA-01 | US-06 | Design | Pending |
| PRES-01 | US-07 | Design | Pending |
| ORD-01 | US-08 | Design | Pending |
| ORD-02 | US-09 | Design | Pending |
| CHAM-01 | US-10 | Design | Pending |
| CHAM-02 | US-11 | Design | Pending |
| BAL-01 | US-12 | Design | Pending |
| TV-01 | US-13 | Design | Pending |
| PRE-01 | US-14 | - | Pending |
| SES-01 | US-15 | - | Pending |
| PUB-01 | US-16 | - | Pending |
| CANC-01 | US-17 | - | Pending |
| ENC-05 | US-18 | - | Pending |
| SES-04/05 | US-19 | - | Pending |

ID = grupo de regras `RN-<ID>-NN` da fonte.

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
| Questionário v1 (7.3) | Como na fonte | Validar com enfermeiro/médico | n |
| Validade do encaminhamento | Agendador informa ao aceitar | Fonte em aberto | n |
| Exclusão de fotos (RNF-LGPD-04) | Retidas enquanto cadastro ativo | Depende do jurídico | n |
| Tempo médio (RN-ETA-05), triagem cadenciada (RN-TRI-06), reativação 30 d (RN-PARADA-02), 3 pulos = falta, destaque TV 10 s | Valores da fonte | Propostas | n |
| Abrangência por endereço, contingência offline | Fora do MVP | Fonte em aberto | n |
| Hospedagem municipal | Decidir no design | Arquitetura | n |

**Open questions:** none.

## User Stories

US-01..US-13 (P1) e US-14..US-17 (P2) conforme fonte §14, com os desvios acima.

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

ID = grupo de regras `RN-<ID>-NN` da fonte.

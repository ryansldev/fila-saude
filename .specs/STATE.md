# STATE

## Decisions (todas active, 2026-11-04)

- **AD-001** Protótipo HTML+CSS+JS antes de qualquer código do MVP.
- **AD-002** Presente vê posição na ordem de chamada real (com janela protegida); tempo = (pos − 1) × média ÷ estações abertas. Remoto segue RN-ETA-01.
- **AD-003** Remoto 1º em ordem(todas) com estação aberta vê "venha agora" (só é chamado após ler o QR).
- **AD-004** Ordem risco × prioridade legal é config do município (`risco antes` padrão | `prioridade legal antes`), sempre abaixo de urgência confirmada (e remanejados na alocação). Vale p/ alocação e chamada.
- **AD-005** Protótipo no visual da landing (`apps/web`), sem animações. (Parte "uma página por história" substituída pela AD-008.)
- **AD-006** Sem pulo automático: tolerância é só contador. Fila avança só por "Não compareceu" (regras de 1º/2º/3º pulo) ou "Chamar próximo" (fecha atual como atendido). Substitui RN-CHAM-03/RN-EST-05.
- **AD-007** Triagem como etapa própria: serviço "exige triagem" + estação de triagem; mesma senha nas duas filas (RN-TRI-01..05).
- **AD-008** Protótipo = apresentação + fluxo principal único (inscrição pública → alocação privada de odontologia → aviso → QR → triagem → "Vou sair" → volta → consulta, ver AD-011) + modo livre. Botão de demo avança o relógio até o próximo aviso da protagonista.
- **AD-009** Um "saia de casa" por etapa: antes da triagem usa só o tempo da triagem; previsão da consulta mostrada à parte.
- **AD-011** (2026-11-09, revista pela AD-013) Visibilidade é **por sessão**, não por serviço: nem toda unidade tem clínico geral, e odontologia também é só uma sessão. Pública = o paciente se inscreve sozinho, sem aprovação (ex.: clínico geral, onde o volume do dia inviabiliza aprovar um a um); ordem do dia pela hora da inscrição, com urgência, risco e prioridade legal por cima (RN-FILA-01, RN-ORD). Privada = o paciente só sinaliza interesse (lista de espera) e o agendador escolhe quem marcar, vendo o motivo (RN-AL). Lista de reserva (RN-PUB-02) não está modelada no protótipo.
- **AD-012** (2026-11-09) A TV continua só com senhas (RN-TV-05), sem nenhum nome: o primeiro nome não resolve (pode haver várias Marias) e mais que isso fere a privacidade. Quem marca presencialmente, sem app (ex.: idosos no balcão), recebe da recepção um papel com a senha escrita, para conferir com a TV.
- **AD-013** (2026-11-09) Inscrição pública já entra **confirmada** no MVP (como no protótipo): o paciente escolheu o dia. Substitui a confirmação em 24 h da RN-PUB-01 para inscrição antecipada.
- **AD-014** (2026-11-09) Sessão tem data + recorrência no modelo iCalendar (RFC 5545: DTSTART/DTEND, RRULE, EXDATE, RDATE), como Google Calendar. Cada sessão (ou série) tem sua própria configuração, inclusive visibilidade. Como as ocorrências viram instâncias com estado próprio (abrir, cancelar uma, encerrar) fica para o plan.
- **AD-015** (2026-11-10) Sessão pública de serviço com encaminhamento: a inscrição segura a vaga até o agendador aceitar a foto (aí vira confirmada). Rejeitada, o paciente pode mandar outra. Se não estiver aceita na abertura da sessão, a vaga é liberada e a entrada volta a "aguardando encaminhamento" (como RN-CONF-04).
- **AD-016** (2026-11-10) Opção da sessão **"dispensa pré-cadastro"** (padrão desligada), em sessão pública ou privada: ignora as exigências de pré-cadastro e de vínculo da unidade para aquela sessão (ex.: plantão, que atende quem aparecer). É uma opção genérica, não um tipo "plantão", para continuar extensível. No check-in o paciente nunca fica "aguardando validação".
- **AD-010** Atraso (8.3) por ordem, não por número: ao voltar, perde a vez só se foi chamado, na mesma etapa, alguém que vinha depois na ordem real. Vale também p/ falta e remanejamento.

## Handoff

- Adiado (após validar o protótipo): extensão SISREG, onde o risco vem do SISREG e o Fila Saúde não classifica. Entrada por registro do regulador, comprovante ou planilha; API depois. Decidir: entrada sem classificação, papel da triagem presencial, destino do questionário.
- `mvp-filas` aprovado; aguarda design. `prototipo` revisões 1–4 construídas e verificadas (todos os findings fechados).

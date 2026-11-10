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
- **AD-011** (2026-11-09) Clínico geral é sempre sessão pública: o paciente se inscreve sozinho, sem aprovação, porque no volume de um dia de atendimento nenhum humano daria conta de aprovar um a um. A ordem do dia segue a hora da inscrição, com urgência, risco e prioridade legal por cima (RN-FILA-01, RN-ORD). Serviços privados (ex.: odontologia): o paciente só sinaliza interesse (entra na lista) e o agendador escolhe quem marcar, vendo o motivo (RN-AL). No protótipo, a inscrição pública já conta como confirmada (ele escolheu o dia); lista de reserva (RN-PUB-02) não está modelada.
- **AD-012** (2026-11-09) A TV continua só com senhas (RN-TV-05), sem nenhum nome: o primeiro nome não resolve (pode haver várias Marias) e mais que isso fere a privacidade. Quem marca presencialmente, sem app (ex.: idosos no balcão), recebe da recepção um papel com a senha escrita, para conferir com a TV.
- **AD-010** Atraso (8.3) por ordem, não por número: ao voltar, perde a vez só se foi chamado, na mesma etapa, alguém que vinha depois na ordem real. Vale também p/ falta e remanejamento.

## Handoff

- Adiado (após validar o protótipo): extensão SISREG, onde o risco vem do SISREG e o Fila Saúde não classifica. Entrada por registro do regulador, comprovante ou planilha; API depois. Decidir: entrada sem classificação, papel da triagem presencial, destino do questionário.
- `mvp-filas` aprovado; aguarda design. `prototipo` revisões 1–4 construídas e verificadas (todos os findings fechados).

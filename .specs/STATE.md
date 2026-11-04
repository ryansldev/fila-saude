# STATE

## Decisions

- **AD-001** (active, 2026-11-04) - Antes de qualquer código do MVP, um protótipo só com HTML + CSS + JS mostra o painel administrativo e o app do paciente nos cenários da spec `mvp-filas`, para validar a ideia. Rationale - user: "antes de qualquer código, vamos criar um protótipo apenas com HTML + CSS + JS".
- **AD-002** (active, 2026-11-04) - Paciente presente vê a posição na ordem de chamada real entre os presentes do serviço (com janela protegida), e o tempo = (posição − 1) × tempo médio ÷ estações abertas. Remoto continua com RN-ETA-01. Rationale - pergunta: "Como fica a posição de quem está presente?"; user: "Ordem de chamada real".
- **AD-003** (active, 2026-11-04) - Remoto que é o 1º em ordem(todas), com estação aberta, vê "venha agora" em vez de número e tempo, com o aviso de que só é chamado depois de ler o QR. Rationale - pergunta: "O que o remoto vê quando a vez dele já chegou?"; user: "Estado \"venha agora\"".
- **AD-004** (active, 2026-11-04) - A ordem entre risco e prioridade legal vira configuração do município (`risco antes`, padrão, ou `prioridade legal antes`), abaixo da urgência confirmada (e dos remanejados na alocação). Vale para a sugestão de alocação e para a ordem de chamada. Rationale - pergunta: "O que o protótipo faz?" (ponto da área técnica); user: "Regra configurável".
- **AD-005** (active, 2026-11-04) - O protótipo vira apresentação no visual da landing (`apps/web`), uma página por história com roteiro guiado que se marca sozinho, e um modo livre. Sem animações. Rationale - user: "A UI Precisa autoexplicativa, o protótipo quase que vende a si próprio... Se inspire na UI ... da nossa landing page ... Mas sem animacoes"; plano aceito: "Sim, seguir esse plano".

## Handoff

- `mvp-filas/spec.md` aprovado. `prototipo` revisão 2 em execução (AD-002..AD-005).

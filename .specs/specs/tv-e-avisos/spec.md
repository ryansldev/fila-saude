# TV e avisos

A TV é **uma URL pareada**, uma por unidade, com todos os serviços juntos. No MVP o único canal automático para o paciente é o **push do app**; o canal de segurança é a **lista de ligação** do agendador. O onboarding pede permissão de notificação e explica por que ela é essencial.

## TV

**RN-TV-01 · Pareamento**
A TV abre um endereço fixo e curto (ex.: `/tv`) e mostra um código de 6 dígitos. QUANDO o admin digitar o código no painel, O SISTEMA DEVE vincular a TV à unidade; ela fica autenticada até ser revogada e, QUANDO o admin revogar, DEVE voltar à tela de pareamento.

**RN-TV-02 · Sem pareamento, nada**
A URL sem pareamento não exibe nada da unidade. Isso protege o QR de entrada.

**RN-TV-03 · Uma tela por unidade**
Uma tela e uma fila por unidade no MVP, com todos os serviços.

**RN-TV-04 · Som**
Botão **Iniciar painel** ao abrir, para liberar o som; depois, um som de aviso a cada chamada. Sem voz.

**RN-TV-05 · Só senhas**
A TV NÃO DEVE mostrar nomes de pacientes, nem o primeiro nome, só senhas. Quem é incluído no balcão recebe da recepção um papel com a senha, para conferir com a TV.
*Decisões: AD-012.*

**RN-TV-06 · TV fraca**
Página leve, fonte grande, legível do fundo da sala, reconexão automática e sinal de vida. Indicador "online/offline" no painel do admin.

**RN-TV-07 · Fila de anúncios**
QUANDO duas chamadas acontecerem ao mesmo tempo, O SISTEMA DEVE enfileirá-las; cada uma fica em destaque pelo tempo configurado na unidade (padrão 10 s) e depois desce para "últimas chamadas".
*Decisões: AD-022.*

**Layout**

```
┌──────────────────────────────────────┬───────────────────┐
│          CHAMANDO AGORA              │ ÚLTIMAS CHAMADAS  │
│                                      │ O-007 · Consult. 2│
│        C-012                         │ G-031 · Consult. 1│
│        Cardiologia → Consultório 3   │ C-014 · Triagem 1 │
├──────────────────────────────────────┼───────────────────┤
│ CLÍNICO   5 aguardando · +3 a caminho │                   │
│ CARDIO    2 aguardando · +1 a caminho │   [ QR ENTRADA ]  │
│ ODONTO    1 aguardando                │   Leia ao chegar  │
└──────────────────────────────────────┴───────────────────┘
```

- Cada chamada mostra a senha e o destino (consultório ou sala de triagem). A senha é a mesma nas duas etapas.
- "Aguardando" conta os presentes; "a caminho", os remotos. São só números.
- Com mais de 4 serviços, a faixa de baixo rola automaticamente.

## Notificações

| Evento | Quem recebe | Canal |
| --- | --- | --- |
| Alocado numa sessão: confirme em 24 h | Paciente | Push + tela no app |
| Lançado por serviço regulado: sua consulta está marcada (só conta verificada) | Paciente | Push + tela no app |
| Alocação pendente de confirmação (destacada após 24 h) | Agendador | Lista de ligação no painel |
| Sessão aberta: você está na fila remota | Paciente | Push |
| Saia de casa (tempo estimado abaixo do limite) | Paciente | Push |
| Venha agora (urgente confirmado) | Paciente | Push |
| Sua vez: senha, serviço e sala | Paciente | Push + TV |
| Você foi pulado / perdeu a vez | Paciente | Push |
| Sessão cancelada, remarcada, aguardando nova data ou "escolha outra data" | Paciente | Push |
| Vaga liberada para quem está na lista de reserva | Paciente | Push |
| Requisição aceita, rejeitada ou vencida | Paciente | Push |
| Cadastro validado ou transferido | Paciente | Push |
| Você faltou 2 vezes nos últimos 90 dias | Paciente | Push |
| Ainda precisa deste atendimento? | Paciente | Push + tela no app |
| Paciente refez o questionário e subiu para urgente | Agendador | Alerta no painel |
| Paciente de serviço regulado desmarcou: comunicar a regulação | Agendador | Lista de ligação no painel |

**RN-NOT-01 · Sem dado clínico**
Nenhuma notificação contém sintomas ou dados clínicos, só a ação e o local.

**RN-NOT-02 · WhatsApp depois**
WhatsApp fica fora do MVP. Quando entrar, será a API oficial configurada e paga pela própria prefeitura.

## Implantação na unidade (TI da prefeitura)

- [ ] Chrome ou Edge atualizado em cada consultório e sala de triagem
- [ ] Domínio do sistema liberado no firewall da rede municipal
- [ ] TV da sala de espera abrindo a URL da TV (smart TV, TV box ou computador no HDMI), com som ligado
- [ ] TV pareada no painel
- [ ] Estações cadastradas e testadas com uma chamada
- [ ] Usuários do painel criados com seus perfis
- [ ] Impressora na recepção para a lista do dia (RN-CONT-01)

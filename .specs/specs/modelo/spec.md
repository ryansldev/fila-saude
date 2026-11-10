# Modelo: atores, entidades, configurações e invariantes

A hierarquia é **Município → Unidade → Serviço → Sessão**. O paciente tem uma identidade central e se relaciona com cada unidade por meio de cadastro, entradas e filas. Termos no [glossário](../glossario.md).

## Atores e perfis

Uma pessoa pode acumular perfis (ex.: agendador e recepção). Cada perfil é concedido com um **escopo**: o município inteiro ou unidades específicas. Toda ação administrativa fica registrada em auditoria. O que cada perfil pode fazer está em [permissões](../permissoes/spec.md).

| Perfil | Escopo | Papel |
| --- | --- | --- |
| Paciente | Próprio (e de quem ele marca) | Usa o app: lista de espera, inscrição, fila, check-in, cancelamento |
| Gestor municipal | Município | Cria unidades, define regras do município, gerencia usuários do painel, vê relatórios e métricas |
| Admin da unidade | Unidade | Configura serviços, sessões, TV e estações; abre, cancela e encerra sessões |
| Agendador | Unidade | Valida requisições, aloca pacientes, lança pacientes de serviço regulado, liga e registra confirmações |
| Recepção | Unidade | Balcão, conferência de documentos e prioridade, presença, ajustes, contingência |
| Triagem | Unidade | Chama para triagem, confirma ou reclassifica o risco, confere pendências na chamada |
| Profissional | Unidade | Chama, rechama, pula e finaliza na estação; confere pendências na chamada |
| TV (dispositivo) | Unidade | Exibe chamadas e QR. Não é um usuário; é um dispositivo pareado |

## Entidades

| Entidade | Pertence a | Atributos principais |
| --- | --- | --- |
| Município | — | nome, UF, regras municipais |
| Unidade | Município | tipo (UBS, Policlínica, UPA), endereço, coordenadas, fuso, horário de funcionamento, configurações |
| Serviço | Unidade | nome, prefixo de senha, exige triagem, como é marcado (livre, requisição pelo app, regulado), tempo médio inicial |
| Série de sessões | Serviço | DTSTART/DTEND, RRULE, EXDATE, RDATE (RFC 5545), configuração padrão das ocorrências (vagas, visibilidade, profissional, estações) |
| Sessão | Serviço (e opcionalmente uma série) | data, horário, vagas (opcional), visibilidade, dispensa pré-cadastro, profissional (texto), estações, estado |
| Paciente | Central | CPF, hash da senha, nome, e-mail, telefone, data de nascimento, consentimentos, nível de confiança (verificada em, por quem, método) |
| Pessoa local | Município | nome, data de nascimento, CPF (opcional), documento conferido por e em; vínculo com o Paciente central quando houver conta verificada com o mesmo CPF. Representa quem não tem app e a pessoa atendida informada por um responsável |
| Cadastro na unidade | Paciente × Unidade | dados do formulário, Cartão SUS, foto do documento com foto, foto do Cartão SUS, ID de atendimento, estado de validação, validado por, validado em |
| Encaminhamento | Pessoa atendida × Serviço | foto, data de emissão, validade, estado (pendente, aceito, rejeitado, vencido), motivo |
| Entrada | Responsável (Paciente) ou Pessoa local × Serviço | pessoa atendida, data de entrada original, classificação de risco (sugerida e confirmada), prioridade legal (declarada, conferida, expira em), remanejada (origem), recusas, estado |
| Questionário de risco | Entrada | respostas estruturadas, nível sugerido, data; histórico de versões |
| Alocação | Entrada × Sessão | alocado por, motivos da sugestão, prazo de confirmação, estado da confirmação |
| Entrada na fila | Sessão × Entrada | senha, origem (alocado, público, balcão, lançado), etapa atual, presença, pendências, posição original, pulos no dia, chamadas, estado |
| Chamada | Entrada na fila × Estação | horário, rechamadas, resultado (compareceu, pulado) |
| Estação | Unidade | nome (ex.: Consultório 3), etapa, serviços atendidos, profissional logado (aberta ou fechada), último sinal de vida |
| Dispositivo TV | Unidade | nome, token de pareamento, último sinal de vida, revogado |
| Sinal de vida | Unidade | TV ou estação, horário; histórico usado na contingência e no modo manual |
| Ocorrência de falta | Pessoa atendida, pessoa local ou responsável × Unidade | data, tipo (faltou sem avisar, não compareceu à chamada), anulada (por quem, motivo) |
| Período de contingência | Unidade | início, fim, motivo, registrado por |
| Usuário do painel | Município | nome, login, perfis com escopo |
| Evento de auditoria | Município | quem, o quê, quando, sobre qual registro, motivo (quando exigido) |
| Evento de fila | Município | sessão, entrada, tipo (check-in, "Vou sair", chamada, atendido, pulo, falta), estação, horário; sem dado clínico |

## Configurações

Cada nível herda o padrão do nível acima quando não define o seu.

| Nível | Configuração | Padrão |
| --- | --- | --- |
| Município | Cadastro ativo em uma só unidade do município por vez | Desligado |
| Município | Alerta de faltas: número de faltas no período | 2 faltas em 90 dias |
| Município | Pergunta "ainda precisa?" na lista de espera: intervalo e prazo de resposta | 30 dias / 7 dias |
| Município | Ordem entre risco e prioridade legal | Risco antes |
| Unidade | Tipo | UBS |
| Unidade | Endereço, coordenadas, fuso horário e horário de funcionamento | — (obrigatório) |
| Unidade | Exige pré-cadastro (com foto do documento e do Cartão SUS) | Ligado (AD-053) |
| Unidade | Só atende pacientes com cadastro validado na unidade (vínculo) | Desligado |
| Unidade | Aviso "saia de casa": tempo estimado até a chamada | 30 min |
| Unidade | Tolerância de chamada | 5 min |
| Unidade | Tamanho da janela protegida (K) | 1 |
| Unidade | Intervalo de troca do QR de entrada | 30 s |
| Unidade | Tempo de destaque de cada chamada na TV | 10 s |
| Unidade | Prazo de confirmação da alocação | 24 h |
| Serviço | Nome e prefixo de senha | — (obrigatório) |
| Serviço | Exige triagem | Desligado |
| Serviço | Como é marcado: livre, requisição pelo app ou regulado pela central | Livre |
| Serviço | Tempo médio inicial por atendimento (por etapa) | 15 min |
| Sessão | Data e horário; recorrência opcional (RRULE/EXDATE/RDATE) | — (obrigatório) |
| Sessão | Vagas | Sem limite (recomendado definir) |
| Sessão | Visibilidade: pública ou privada | Privada |
| Sessão | Profissional (texto informativo) e estações | — |
| Sessão | Dispensa pré-cadastro (só em sessão pública; ignora pré-cadastro e vínculo) | Desligado |

## Invariantes

Nunca podem ser violados; cada um vira teste.

- **INV-01:** uma pessoa atendida tem no máximo uma entrada ativa por serviço.
- **INV-02:** entradas não finais numa sessão, somando alocadas, confirmadas, inscritas, lançadas e do balcão, ≤ vagas. Entradas "Na reserva" não contam.
- **INV-03:** só elegíveis são chamados. Remoto nunca é chamado.
- **INV-04:** um paciente está chamado em no máximo uma estação por vez.
- **INV-05:** a senha é única na sessão.
- **INV-06:** nenhuma resposta ao app do paciente contém dados de outro paciente. A TV mostra só senhas e contadores.
- **INV-07:** nível confirmado só é gravado por agendador ou triagem.
- **INV-08:** nenhuma alocação existe sem ação de um agendador.
- **INV-09:** a data de entrada original de uma entrada nunca muda.
- **INV-10:** remanejado nunca tira a vaga de quem já está confirmado.
- **INV-11:** a camada central nunca armazena sintomas, documentos ou dados de fila.
- **INV-12:** toda ação do painel gera evento de auditoria.

## Contratos de estado

As tabelas de transição estão distribuídas pelas specs de cada capacidade; **somadas, são o contrato**: toda transição não listada é proibida e retorna erro com código estável.

| Ciclo de vida | Onde |
| --- | --- |
| Sessão | [fila-do-dia](../fila-do-dia/spec.md#sessão) |
| Entrada (lista, inscrição, reserva, lançamento) | [lista-espera](../lista-espera/spec.md#transições), [marcacao](../marcacao/spec.md#transições), [excecoes](../excecoes/spec.md#transições) |
| Entrada na fila do dia (por etapa) | [fila-do-dia](../fila-do-dia/spec.md#transições), [chamada](../chamada/spec.md#transições), [contingencia](../contingencia/spec.md#transições), [marcacao](../marcacao/spec.md#transições) |

Estados da entrada:

| Estado | Significa | Final? |
| --- | --- | --- |
| Aguardando encaminhamento | Falta foto aceita da requisição (com ou sem vaga segura) | Não |
| Aguardando | Na lista, pronta para ser sugerida | Não |
| Alocada | Aguarda confirmação | Não |
| Confirmada | Entra na fila quando a sessão abrir | Não |
| Na reserva | Inscrita numa sessão pública lotada; espera vaga. Conta como ativa (INV-01) | Não |
| Na fila | Está na fila do dia | Não |
| Remanejada | Perdeu o atendimento por culpa da unidade; tem preferência | Não |
| Arquivada | Não respondeu "ainda precisa?" | Não (pode reativar) |
| Concluída | Atendida na última etapa | Sim |
| Cancelada | Desistiu, foi removida ou recusada na conferência | Sim |
| Encerrada sem atendimento | Saiu por 3 pulos, ou faltou | Sim (revertida só pela contingência registrada depois) |

Estados da entrada na fila do dia: **Remoto**, **Presente** (com ou sem pendência), **Chamado** (com ou sem pendência), **Atendido na etapa**, **Saiu da fila**, **Remanejado**.

# Permissões

As colunas da matriz são **papéis de permissão**, não cargos. Eles vêm da **ocupação** da pessoa na unidade (enfermeiro, técnico de enfermagem, recepção; "Atendimento" reúne médico, dentista e eMulti), das **funções de gestão** (Gestão SMS, Regulação SMS, Gerente da UBS) e da permissão **Agendar**, ligada por unidade ([modelo](../modelo/spec.md#atores-e-perfis), [discovery](../../features/mvp-filas/discovery-papeis-ubs.md)). Os papéis se somam. A matriz lista as ações sensíveis; as demais ações de cada papel estão nas regras.

**RN-PERF-01 · Escopo**
O acesso a respostas do questionário e a documentos segue a matriz abaixo, sempre restrito à unidade do perfil.

**RN-PERF-02 · Concorrência na alocação**
QUANDO dois agendadores tentarem alocar a mesma vaga, O SISTEMA DEVE aceitar só a primeira; a segunda recebe erro e a lista atualizada.

**RN-PERF-03 · Ajustes que mexem na ordem ou no histórico**
QUANDO a recepção dar ou tirar prioridade, informar risco alto no balcão, anular falta ou registrar período de contingência, O SISTEMA DEVE exigir motivo, gravar auditoria e levar o ajuste ao relatório do gestor, por usuário.
*Decisões: AD-023.*

**RN-PERF-04 · Quem cadastra quem**
QUANDO alguém cadastrar ou mudar a equipe do painel, O SISTEMA DEVE aceitar só se: o ator tem Gestão SMS (cadastra qualquer pessoa); ou o ator é Gerente da UBS e todas as ocupações e funções da pessoa ficam nas unidades que ele gerencia, sem função de gestão (só "Agendar"). Ninguém concede o que não pode conceder. O mesmo vale para mudar as atribuições de quem já existe: antes e depois da mudança.

**RN-PERF-05 · Classificação de risco**
A classificação de risco é ato privativo do enfermeiro (Resolução Cofen 661/2021). O técnico de enfermagem pode chamar na estação de triagem para o acolhimento e a aferição de sinais vitais, mas não confirma o nível de risco.

## Matriz

<!-- gerado: permissoes -->
| Ação | Paciente | Gestão SMS | Regulação SMS | Gerente da UBS | Agendar | Recepção | Enfermeiro | Técnico de enfermagem | Atendimento |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Criar unidades e regras do município |  | ✓ |  |  |  |  |  |  |  |
| Cadastrar a equipe no painel: ocupação, funções e permissões (RN-PERF-04) |  | ✓ |  | ✓ (da própria unidade, sem função de gestão) |  |  |  |  |  |
| Ver relatório de ajustes por usuário (RN-PERF-03) |  | ✓ |  |  |  |  |  |  |  |
| Exportar CSV das métricas do piloto (RNF-MET-01) |  | ✓ |  |  |  |  |  |  |  |
| Configurar serviços, sessões, estações; parear e revogar TV |  |  |  | ✓ |  |  |  |  |  |
| Abrir, cancelar, encerrar sessão; mudar visibilidade |  |  |  | ✓ |  |  |  |  |  |
| Imprimir a lista do dia, uso interno (RN-CONT-01) |  |  |  | ✓ |  | ✓ |  |  |  |
| Criar entrada; escolher data quando remanejado de sessão pública | ✓ (própria ou de quem marca) |  |  |  | ✓ (remarcar por quem não tem app) | ✓ |  |  |  |
| Cancelar; "Outra data" ou "Desistir" quando remanejado; check-in; "Vou sair" | ✓ (própria ou de quem marca) |  |  |  |  |  |  |  |  |
| Validar requisição |  |  |  |  | ✓ |  |  |  |  |
| Alocar; confirmar ou recusar em nome do paciente |  |  |  |  | ✓ |  |  |  |  |
| Lançar paciente de serviço regulado, inclusive no dia; remover lançamento não chamado (RN-ENC-06) |  |  | ✓ |  | ✓ |  |  |  |  |
| Confirmar nível de risco |  |  |  |  |  |  | ✓ |  |  |
| Incluir paciente no balcão; marcar presença |  |  |  |  |  | ✓ |  |  |  |
| Verificar conta; conferir pessoa atendida; validar pré-cadastro; marcar presença na mesma ação (RN-FILA-05) |  |  |  |  |  | ✓ |  |  |  |
| Redefinir acesso com documento conferido (RN-ID-01) |  |  |  |  |  | ✓ |  |  |  |
| Conferir ou tirar prioridade legal |  |  |  |  |  | ✓ |  |  |  |
| Dar prioridade legal, só na inclusão pelo balcão ou na 1ª presença de paciente sem app (RN-RISCO-04) |  |  |  |  |  | ✓ |  |  |  |
| "Não conferiu" (identidade não confere) (RN-FILA-05) |  |  |  |  |  | ✓ |  |  |  |
| Bloquear conta usurpada (RN-ID-03) |  |  |  |  |  | ✓ |  |  |  |
| Anular falta por 3 pulos, com motivo (RN-FALTA-02) |  |  |  |  |  | ✓ |  |  |  |
| Registrar período de contingência e atendidos na volta (RN-CONT-02) |  |  |  |  |  | ✓ |  |  |  |
| Ver documentos (foto do documento, Cartão SUS) | ✓ (próprios) |  |  |  | ✓ | ✓ |  |  |  |
| Ver respostas do questionário | ✓ (próprias) |  |  |  | ✓ | ✓ | ✓ | ✓ |  |
| Ver resposta sobre pensamentos de tirar a própria vida (RN-RISCO-06) | ✓ (própria) |  |  |  | ✓ | só ao aplicar no balcão | ✓ | ✓ |  |
| Chamar, rechamar, pular, finalizar |  |  |  |  |  |  | ✓ | ✓ (acolhimento na triagem) | ✓ (atendimento) |
<!-- /gerado -->

# Permissões

Perfis são acumuláveis e concedidos por unidade ou município ([modelo](../modelo/spec.md#atores-e-perfis)). Quem precisa de mais de uma coluna recebe mais de um perfil. A matriz lista as ações sensíveis; as demais ações de cada perfil estão nas regras.

**RN-PERF-01 · Escopo**
O acesso a respostas do questionário e a documentos segue a matriz abaixo, sempre restrito à unidade do perfil.

**RN-PERF-02 · Concorrência na alocação**
QUANDO dois agendadores tentarem alocar a mesma vaga, O SISTEMA DEVE aceitar só a primeira; a segunda recebe erro e a lista atualizada.

**RN-PERF-03 · Ajustes que mexem na ordem ou no histórico**
QUANDO a recepção dar ou tirar prioridade, informar risco alto no balcão, anular falta ou registrar período de contingência, O SISTEMA DEVE exigir motivo, gravar auditoria e levar o ajuste ao relatório do gestor, por usuário.
*Decisões: AD-023.*

## Matriz

| Ação | Paciente | Gestor | Admin | Agendador | Recepção | Triagem | Profissional |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Criar unidades, regras do município e usuários do painel |  | ✓ |  |  |  |  |  |
| Ver relatório de ajustes por usuário (RN-PERF-03) |  | ✓ |  |  |  |  |  |
| Exportar CSV das métricas do piloto (RNF-MET-01) |  | ✓ |  |  |  |  |  |
| Configurar serviços, sessões, estações; parear e revogar TV |  |  | ✓ |  |  |  |  |
| Abrir, cancelar, encerrar sessão; mudar visibilidade |  |  | ✓ |  |  |  |  |
| Imprimir a lista do dia, uso interno (RN-CONT-01) |  |  | ✓ |  | ✓ |  |  |
| Criar entrada; escolher data quando remanejado de sessão pública | ✓ (própria ou de quem marca) |  |  | ✓ (remarcar por quem não tem app) | ✓ |  |  |
| Cancelar; "Outra data" ou "Desistir" quando remanejado; check-in; "Vou sair" | ✓ (própria ou de quem marca) |  |  |  |  |  |  |
| Validar requisição |  |  |  | ✓ |  |  |  |
| Alocar; confirmar ou recusar em nome do paciente |  |  |  | ✓ |  |  |  |
| Lançar paciente de serviço regulado, inclusive no dia; remover lançamento não chamado (RN-ENC-06) |  |  |  | ✓ |  |  |  |
| Confirmar nível de risco |  |  |  | ✓ (na alocação ou lançamento) |  | ✓ |  |
| Incluir paciente no balcão; marcar presença |  |  |  |  | ✓ |  |  |
| Verificar conta; conferir pessoa atendida; validar pré-cadastro |  |  |  |  | ✓ | ✓ (na chamada) | ✓ (na chamada) |
| Redefinir acesso com documento conferido (RN-ID-01) |  |  |  |  | ✓ |  |  |
| Conferir ou tirar prioridade legal |  |  |  |  | ✓ | ✓ (na chamada) | ✓ (na chamada) |
| Dar prioridade legal, só na inclusão pelo balcão ou na 1ª presença de paciente sem app (RN-RISCO-04) |  |  |  |  | ✓ |  |  |
| "Não conferiu" (identidade não confere) (RN-CHAM-04) |  |  |  |  | ✓ | ✓ | ✓ |
| Bloquear conta usurpada (RN-ID-03) |  |  |  |  | ✓ |  |  |
| Anular falta por 3 pulos, com motivo (RN-FALTA-02) |  |  |  |  | ✓ |  |  |
| Registrar período de contingência e atendidos na volta (RN-CONT-02) |  |  |  |  | ✓ |  |  |
| Ver documentos (foto do documento, Cartão SUS) | ✓ (próprios) |  |  | ✓ | ✓ |  |  |
| Ver respostas do questionário | ✓ (próprias) |  |  | ✓ | ✓ | ✓ |  |
| Ver resposta sobre pensamentos de tirar a própria vida (RN-RISCO-06) | ✓ (própria) |  |  | ✓ | só ao aplicar no balcão | ✓ |  |
| Chamar, rechamar, pular, finalizar |  |  |  |  |  | ✓ (triagem) | ✓ (atendimento) |

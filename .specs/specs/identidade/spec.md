# Identidade, conta e pré-cadastro

O paciente tem **uma conta central** (CPF + senha), válida em qualquer município. A confiança na identidade é por nível: a conta nasce não verificada e é verificada quando alguém confere o documento com foto. O pré-cadastro é feito **uma vez por unidade**. Discovery: [discovery-identidade](../../features/mvp-filas/discovery-identidade.md).

## Conta e login

**RN-ID-01 · Login e recuperação**
O SISTEMA DEVE autenticar com CPF + senha, validando o CPF pelos dígitos verificadores, sem SMS nem segundo fator no MVP. O e-mail é obrigatório na conta. QUANDO o paciente pedir recuperação de senha, O SISTEMA DEVE enviar um código ao e-mail cadastrado; como alternativa, a recepção confere o documento e redefine o acesso.
*Decisões: AD-019.*

**RN-ID-02 · Um CPF, uma conta**
QUANDO alguém tentar criar conta com um CPF já usado, O SISTEMA DEVE recusar e orientar a procurar a recepção para contestar.

**RN-ID-03 · Usurpação**
A recepção PODE vincular a identidade à pessoa presencialmente (documento com foto) e bloquear uma conta usurpada. Conta bloqueada não loga.

**RN-ID-04 · Senha**
O SISTEMA DEVE exigir política mínima de senha, guardá-la com hash forte e bloquear temporariamente após tentativas seguidas de erro.

**RN-ID-05 · Nível de confiança**
A conta nasce **não verificada** e já pode entrar na lista de espera e se inscrever em sessão pública; o agendador vê "identidade não verificada" na ficha. QUANDO a recepção, ou o profissional na chamada, conferir o documento com foto, O SISTEMA DEVE marcar a conta como **verificada** para todas as unidades e para sempre, registrando quem verificou, quando e por qual método (presencial; gov.br depois do piloto, opcional por município).
*Decisões: AD-017, AD-050.*
- *Dado* Ana com conta não verificada e presente com pendência, *quando* o profissional a chama e confere o documento, *então* a conta fica verificada e a pendência some nas próximas idas a qualquer unidade.

**RN-ID-06 · Falta sem identidade comprovada**
QUANDO uma falta for de conta não verificada, O SISTEMA NÃO DEVE registrá-la no CPF. QUANDO for de pessoa atendida ainda não conferida na unidade, O SISTEMA DEVE registrá-la no responsável que marcou, se a conta dele for verificada (senão, em ninguém). Exceção: paciente lançado de serviço regulado leva a falta na própria pessoa local, pelo CPF, porque o CPF veio da regulação.
*Decisões: AD-017, AD-040.*
- *Dado* João (verificado) que marcou para "outra pessoa" com o CPF de um vizinho nunca conferido, *quando* ninguém comparece e a vez passa, *então* a falta vai para João, não para o vizinho.
- *Dado* Seu José lançado pela regulação, sem app, *quando* não comparece, *então* a falta fica na pessoa local dele, pelo CPF.

**RN-ID-07 · Robôs**
O SISTEMA DEVE limitar tentativas e exigir captcha na inscrição em sessão pública.
*Decisões: AD-017.*

## Pré-cadastro na unidade

**RN-PRE-01 · Dados**
QUANDO a unidade exigir pré-cadastro, O SISTEMA DEVE pedir: nome completo, data de nascimento, telefone, endereço, número do Cartão SUS, foto de **documento com foto** e foto do **Cartão SUS**.

**RN-PRE-02 · ID de atendimento**
O SISTEMA DEVE gerar um **ID de atendimento** de 6 caracteres, também em QR.

**RN-PRE-03 · Validação**
QUANDO o paciente mostrar o ID e o documento, a recepção (ou o profissional na chamada) confere a pessoa e O SISTEMA DEVE marcar o cadastro como **validado**.
*Decisões: AD-050.*

**RN-PRE-04 · Validade**
O cadastro validado vale para todas as próximas idas àquela unidade, até ser revogado.

**RN-PRE-05 · Uma unidade por vez (transferência)**
QUANDO o município ativar "uma unidade por vez" e o cadastro for validado numa unidade nova, O SISTEMA DEVE desativar o da antiga, arquivar as entradas dela e avisar o paciente para se inscrever de novo na nova unidade, com data nova. Não há fluxo próprio de transferência. Se o paciente tiver alocação ou consulta confirmada na unidade antiga, a validação na nova só é liberada depois dessa sessão ou se ele cancelar.

**RN-PRE-06 · Sem app**
Quem não tem app faz o pré-cadastro na recepção, que preenche os dados e fotografa os documentos.

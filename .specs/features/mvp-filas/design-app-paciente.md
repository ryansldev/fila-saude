# Design: app do paciente (1ª rodada)

2026-11-10 · status: **aprovado; 1ª versão do protótipo publicada**. Primeira superfície do design antes do código (decisão do usuário: design → backend). Próximas, em ciclos próprios: painel da recepção, estação, TV.

## Objetivo

Desenhar em **alta fidelidade e clicável** as telas do app do paciente que o **D9** testa e a **fase 3** constrói, para validar com pacientes (metade 60+) e com a recepção antes de escrever o front.

**Sucesso:** no D9, pelo menos 4 de 5 pacientes completam sozinhos a inscrição, a leitura da posição e o "vou sair"/volta, e todos entendem o "saia de casa" e o "sua vez"; o design vira a referência exata do front da fase 3.

**Ferramenta:** artefato "Design" no claude.ai (link privado que abre no celular, comentários na tela) com um design system salvo para as próximas superfícies. Este documento guarda as decisões e o link.

## 1. Direção visual e design system

- **Base:** a landing (`apps/web/app/globals.css`): fonte Nunito; títulos em minúsculas; azul primário (`primary-500`) com cinzas azulados e fundo branco; vermelho, amarelo e verde só para estado; raio de ~10 px; cards brancos com borda suave.
- **Mascote:** só sobre fundo branco (o jaleco é transparente); em fundo azul usa-se o logo de coração.
- **Para 60+ e Android de entrada** (RNF-ACE-01, RNF-DES-03): corpo de 18 px respeitando a fonte do sistema; informação principal grande; um assunto e um botão principal por tela (altura mínima de 56 px, largura total, no rodapé); contraste AA no mínimo; cor nunca é o único sinal; linguagem do dia a dia (sem "elegível", "sessão", "etapa"); sem animações pesadas.

## 2. Mapa de telas

Duas abas fixas: **Minha fila** (principal) e **Unidades**. Perfil e ajuda no topo.

| # | Tela | Regras |
| --- | --- | --- |
| 1 | Boas-vindas (mascote) | — |
| 2 | Criar conta: CPF, senha, e-mail, um campo por vez | RN-ID-01, RN-ID-02, RN-ID-04 |
| 3 | Avisos: por que o push importa, depois a permissão | tv-e-avisos (onboarding) |
| 4 | Entrar e esqueci a senha (código por e-mail ou recepção) | RN-ID-01 |
| 4b | **Pré-cadastro na unidade** (padrão ligado, AD-053): dados (nome, nascimento, telefone, endereço, Cartão SUS), foto do documento com foto, foto do Cartão SUS, e o ID de atendimento com QR; aparece antes da 1ª inscrição numa unidade que exige | RN-PRE-01..04, AD-053 |
| 5 | Unidades próximas: lista primeiro, mapa depois | RN-AG-01 |
| 6 | Agenda da unidade (serviço regulado mostra "marcado pela regulação") | RN-AG-01, RN-ENC-05 |
| 7 | Para quem é? | RN-LE-05 |
| 8 | Questionário, uma pergunta por tela; emergência → "ligue 192"; autolesão → CVV e SAMU; prioridade → aviso de conferência | RN-RISCO-01..04, RN-RISCO-06 |
| 9 | Confirmação: inscrito, na reserva, ou recusas (já está na lista; só por agendamento) | RN-PUB-01, RN-PUB-02, RN-LE-02 |
| 10 | Minha fila, antes do dia: data, unidade, "não vou poder ir" | RN-CANC-01..03 |
| 11 | No dia, em casa: posição e tempo; "aguardando início" sem estação | RN-ETA-01..04 |
| 12 | "Saia de casa agora" e "venha agora" | RN-ETA-03, RN-ORD-02 |
| 13 | "Estou na unidade" → câmera para o QR da TV | RN-PRES-01 |
| 14 | Presente: posição real; "vou sair" | RN-ETA-01b, RN-PRES-02 |
| 14b | Check-in recusado: "passe na recepção para confirmar seus documentos · você ainda não entrou na fila da unidade"; aviso antes da chegada ("na sua primeira ida, passe na recepção antes de ler o QR") nas telas 11 e 12 | RN-FILA-05, AD-054 |
| 15 | "Sua vez!" em tela cheia: senha e destino | RN-CHAM-01 |
| 16 | Pulado; saiu da fila no 3º pulo | RN-CHAM-03 |
| 17 | Atendido / fim | — |
| 18 | Sistema indisponível; modo manual; sem internet | RN-CONT-04, RN-SES-05 |

O protótipo liga as telas na ordem do fluxo do D9 e tem um menu oculto do moderador para pular direto a qualquer estado.

**Fica para a 2ª rodada** (antes da fase 5): lista de espera de sessão privada, confirmação de alocação, requisição com foto, remanejado ("outra data", "desistir", escolher data), "ainda precisa?".

## 3. Conteúdo e regras de tela

- **Privacidade** (INV-06, RN-AG-02): nenhum dado de outro paciente; os únicos números de terceiros são os contadores da TV. Para outra pessoa, mostra o primeiro nome dela ("fila da Ana").
- **Posição e tempo:** o número domina; o tempo é apoio com "~"; sem estimativa, diz por quê; 1º remoto vê "venha agora"; com triagem, duas linhas (triagem e previsão da consulta).
- **Textos-chave** (provisórios; o da prioridade passa pelo jurídico no D5):
  - "**hora de sair de casa** · faltam cerca de 30 min para a sua vez"
  - "**venha agora** · o atendimento está te esperando"
  - "**passe na recepção** para confirmar seus documentos · leve um documento com foto"
  - "**é a sua vez!** · senha C-012 · consultório 3"
  - "**você foi chamado e não apareceu** · se ainda estiver aqui, avise na recepção"
  - "**você saiu da fila de hoje** · para outro dia, faça uma nova inscrição"
  - "a sua prioridade será **conferida na unidade com documento**. Declarar o que não é verdade pode ser crime."
- **Confirmação** só em ações com efeito ruim, dizendo o efeito ("Não vou poder ir? **Você perde esta vaga.**"); "vou sair" não pede.
- **Push** com o mesmo texto da tela, sem dado de saúde (RN-NOT-01).

## 4. Validação no D9

- **Roteiro** (paciente sozinho com o celular): (1) se inscrever na sessão de terça; (2) dizer a posição e quanto falta; (3) reagir ao "saia de casa"; (4) fazer o check-in com um QR impresso; (5) sair e voltar; (6) ser chamado.
- **Quem:** 5 a 8 pacientes, metade com 60+, e 2 ou 3 da recepção (check-in recusado e "sua vez").
- **Anotar por tarefa:** conseguiu sozinho? Onde travou? O que entendeu do texto (nas palavras da pessoa)?
- **Critério:** 4 de 5 completam sozinhos as tarefas 1, 2 e 5, e todos entendem o "saia de casa" e o "sua vez". Abaixo disso, ajusta-se o design antes da fase 3; achados que mexem em regra viram decisões em `decisions.md`.

## Links

- Design system: https://claude.ai/artifact/EsNjLWD3jRKx68Zti2HDP1 (cores, tipografia, espaçamento, raios, logo, mascote; componentes Botao, CartaoPosicao, FaixaAviso)
- Protótipo clicável: https://claude.ai/artifact/VyccUij1Pr5GCaTcrwgGdP (uma tela de celular interativa com as 18 telas e suas variações; menu do moderador no ponto do canto superior esquerdo)

Os dois são privados: para o sócio ou para o teste, compartilhar pelo menu Share de cada um.

# Design: painel da recepção (1ª rodada)

2026-11-10 · status: **aprovado; 1ª versão do protótipo publicada**. Segunda superfície do design antes do código. Mesmo design system do [app do paciente](design-app-paciente.md). Agendador, admin e gestor ficam para a 2ª rodada do painel; depois, estação e TV.

## Objetivo

Desenhar em alta fidelidade e clicável a tela de trabalho da recepção que o **D9** testa e as fases 3 e 7 constroem (T3.6, T7.1–T7.4).

**Sucesso:** no D9, 2 de 3 recepcionistas fazem cada tarefa (conferir, recusar, incluir no balcão, marcar presença sem app) em menos de 1 minuto, sem ajuda.

## Contexto (suposições; o D4 confirma)

- Desktop com Chrome, monitor de 1366×768, às vezes compartilhado.
- A recepcionista atende gente na frente e o telefone ao mesmo tempo: acha a pessoa em segundos e resolve em 1 ou 2 cliques.
- Não é especialista em tecnologia: mesma linguagem do app, sem jargão; tudo funciona só com teclado (Tab e Enter).

## Estrutura

Uma tela principal, **"fila de hoje"**, e painéis laterais por cima dela (sem trocar de página).

| Área | O que mostra | Regras |
| --- | --- | --- |
| Topo | Unidade e data; busca por nome, CPF ou senha; "incluir no balcão"; "imprimir lista do dia" | RN-CONT-01 |
| **Precisam de você agora** | Quem teve o check-in recusado por pendência, por ordem de tentativa e tempo de espera ("há 12 min"); tipo da pendência; "conferir" | RN-FILA-05, RN-LE-06, RN-RISCO-04 |
| **Fila de hoje**, por serviço | Presentes e a caminho: senha, primeiro nome, prioridade, estado (presente, remoto, chamado, pulado 1 ou 2, atendido); selo "sem app" com "marcar presença" | RN-PRES-03, RN-CHAM-03 |

A recepção vê nomes (é equipe da unidade), nunca as respostas do questionário; a da autolesão, só enquanto aplica o questionário no balcão (RN-RISCO-06).

| Painel | O que faz | Regras |
| --- | --- | --- |
| Conferir | Pré-cadastro: as fotos do documento e do Cartão SUS lado a lado com os dados e o ID de atendimento, para comparar com a pessoa e o documento físico. Conta nova: documento físico × dados da conta em destaque. Botões "confere e marcar presença" · "não conferiu" (motivo obrigatório) · "prioridade não confere" (marca presença sem a prioridade) | RN-FILA-05, RN-PRE-03, AD-053, AD-054 |
| Incluir no balcão | Pessoa local (nome, nascimento, CPF) → serviço e sessão de hoje → questionário com o paciente, prioridade com o documento visto → senha grande e "imprimir papel da senha"; serviço regulado bloqueado com orientação | RN-LE-04, RN-FILA-03, RN-RISCO-02, RN-RISCO-04, RN-ENC-05, RN-TV-05 |
| Aguardando remarcação | Remanejados de sessão pública sem app, para remarcar por telefone | RN-REM-05 |
| Contingência | Período, motivo, sinais de vida da TV e das estações, quem foi atendido no papel | RN-CONT-02, RN-CONT-03 |
| Anular falta de 3 pulos | A partir da ficha da pessoa, com motivo | RN-FALTA-02 |

## Estados

- **Vazio:** "ninguém precisa de você agora"; antes da abertura, "a fila de hoje ainda não começou".
- **Muitas pendências:** contador ("6 aguardando conferência"), lista rolável, quem espera há mais tempo no topo.
- **Modo manual / sem sinal:** faixa amarela "TV e estações sem sinal há 3 min · imprima a lista do dia"; na volta, "registrar o que aconteceu na queda" (RN-SES-05, RN-CONT-02).
- **Ajuste registrado:** "registrado · aparece no relatório do gestor" (RN-PERF-03).

## Textos-chave (provisórios)

- "confira se o documento com foto é da pessoa que está na sua frente" → "confere" / "não confere"
- "a pessoa sai da fila de hoje, sem falta. motivo: documento de outra pessoa · não trouxe documento · outro"
- "a prioridade será retirada e a pessoa volta ao lugar normal na fila."
- "esta pessoa entra na fila como presente" → senha grande → "entregue o papel com a senha"
- "este serviço é marcado pela regulação. oriente a pessoa a procurar a regulação ou a UBS de origem."

## Validação no D9

Tarefas: (1) conferir um paciente com pendência; (2) recusar um documento que não confere; (3) incluir um idoso sem app no balcão e entregar a senha; (4) marcar presença de quem não tem app. Critério: cada uma em menos de 1 minuto, sem ajuda, em 2 de 3 recepcionistas.

## Links

- Design system: https://claude.ai/artifact/EsNjLWD3jRKx68Zti2HDP1
- Protótipo clicável: https://claude.ai/artifact/WHGYKwPRZGuuHrqznkdkma (tela 1366×768 interativa; o tweak "situação" alterna entre dia normal, fila vazia e TV/estações sem sinal)

Os links são privados: compartilhar pelo menu Share de cada um.

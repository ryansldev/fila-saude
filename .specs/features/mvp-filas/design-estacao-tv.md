# Design: estação de chamada e TV (1ª rodada)

2026-11-10 · status: **aprovado; 1ª versão do protótipo publicada**. Terceira e quarta superfícies do design antes do código. Mesmo design system do [app](design-app-paciente.md) e do [painel da recepção](design-painel-recepcao.md).

## Estação de chamada

**Contexto:** o profissional está com o prontuário aberto; a estação é uma mini-janela flutuante (~360×300 px) por cima dele (RN-EST-02), ou tela cheia em tablet ou celular (RN-EST-04).

| Parte | O que mostra | Regras |
| --- | --- | --- |
| Topo | "consultório 3 · clínico geral" e o sinal de online | RN-EST-01, RN-EST-05 |
| Ninguém chamado | "próximo: C-014" e "chamar próximo" grande; fila vazia: "ninguém presente agora · 3 a caminho" | RN-CHAM-01, RN-EST-03 |
| Chamado | Senha grande, primeiro nome, contador "chamado há 2:40"; aos 5:00, "tolerância esgotada" em amarelo, sem pular sozinho | RN-CHAM-03, AD-006 |
| Chamado com pendência | Faixa "conferir documento / prioridade / pré-cadastro" com "confere", "não conferiu" e "prioridade não confere" | RN-CHAM-04, AD-050 |
| Botões | "chamar próximo" (fecha como atendido) · "rechamar" · "não compareceu" (diz qual pulo) · "finalizar" | RN-CHAM-02, RN-CHAM-03 |
| Triagem | Mais "confirmar risco": nível sugerido, com opção de trocar | RN-TRI-03 |

Uma estação com chamado não fecha (RN-EST-05).

## TV da sala de espera

**Contexto:** tela de 1920×1080, fundo `primary-900`, logo de coração (o mascote nunca vai em fundo azul). Só senhas, nunca nomes (RN-TV-05).

| Área | O que mostra | Regras |
| --- | --- | --- |
| Chamando agora | Senha enorme e destino ("C-012 → consultório 3"), em destaque pelo tempo da unidade (10 s), com som; chamadas simultâneas em fila de anúncios | RN-TV-04, RN-TV-07 |
| Últimas chamadas | As 4 anteriores, senha e destino | RN-TV-03 |
| Serviços | "clínico · 5 aguardando · +3 a caminho" (só números) | RN-TV-03, INV-06 |
| QR de entrada | Grande, "leia ao chegar", troca a cada 30 s | RN-PRES-01 |

**Estados:** "toque para iniciar o painel" (libera o som, RN-TV-04); pareamento com o código de 6 dígitos (RN-TV-01, RN-TV-02); "reconectando…" sem mostrar fila velha (RN-TV-06); "atendimento ainda não começou" sem estação aberta.

## Links

- Design system: https://claude.ai/artifact/EsNjLWD3jRKx68Zti2HDP1
- Protótipo: https://claude.ai/artifact/ATDzJBcttH2rRWaMzdzWmC (dois artboards interativos: a mini-janela da estação, com o tweak "triagem" e o contador acelerado; e a TV, com "simular chamada" e o tweak "estado" para pareamento, reconectando e atendimento não iniciado)

Os links são privados: compartilhar pelo menu Share.

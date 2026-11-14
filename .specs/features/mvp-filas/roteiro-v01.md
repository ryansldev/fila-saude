# Roteiro da v0.1

Como rodar a v0.1 local e apresentá-la, tela a tela. Cada fatia acrescenta o seu trecho.

## Preparar

```bash
npm install
npm run dev:seed      # apaga e recria o município "exemplo"; imprime logins e sessões
npm run dev           # API em :3333, painel em http://exemplo.localhost:3000
EXPO_PUBLIC_API_URL=http://<ip-da-maquina>:3333 npm run dev:mobile   # app no celular (Expo Go)
```

Senha de todos: `exemplo123`. O seed cria a sessão pública **Curativos** começando na hora cheia de agora (4 h), na "Sala de procedimentos", com Ana e Bruno já inscritos.

## Fatia 1 — Pública básica

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | Paciente | App | Entrar com a Carla (CPF `39053344705`) ou criar conta; escolher "Município Exemplo" | Tela "Olá, Carla" com a Odontologia aguardando |
| 2 | Paciente | App → Agenda | Tocar em "Curativos", "Para mim", responder (problema novo, leve; gestante) | Aviso de que a prioridade é conferida; inscrição confirmada |
| 3 | Paciente | App | Marcar um sinal de alarme numa nova tentativa | Tela "Procure atendimento agora" com o botão 192; não entra na fila |
| 4 | Gerente | Painel → Fila do dia | Entrar como `gerente`, escolher a sessão de Curativos, "Abrir sessão" | Senhas V-001.. remotas; no app, a senha e "Venha agora"/posição |
| 5 | Recepção | Painel → QR de entrada | Entrar como `recepcao` e deixar a tela do QR aberta no monitor | QR que muda a cada 30 s |
| 6 | Paciente | Câmera do celular ou app → "Cheguei" | Ler o QR | 1ª ida (conta não verificada): "passe na recepção para confirmar seus documentos" |
| 7 | Recepção | Painel → Fila do dia | "Conferir documentos e marcar presença" em quem aparece com pendência | "Na unidade"; a conta fica verificada e nas próximas idas o QR basta |
| 8 | Enfermeira | Painel → Estação | Entrar como `enfermeira`, escolher "Sala de procedimentos", "Chamar próximo" | Senha e nome grandes, cronômetro; no app, "É a sua vez! Vá para Sala de procedimentos" |
| 9 | Enfermeira | Estação | Rechamar, Finalizar, Chamar próximo, Não compareceu | Pulado volta à fila; sem ninguém, "Ninguém aguardando na unidade" |
| 10 | Gerente | Fila do dia | "Encerrar sessão" | Atendidos ficam; quem não foi chamado vira remanejado; no app, "Sua vez não chegou hoje" |

**Executado em 2026-11-12** por HTTP (script com as mesmas rotas do app e do painel): passos 1, 2, 4–10 conferidos (QR lido pelo link que a tela gera). Falta o clique no navegador e no celular (Expo Go); o app foi empacotado com `expo export` e passou no `expo-doctor`.

## Fatia 2 — Na unidade

Para o push chegar no celular é preciso um projeto EAS e um build de desenvolvimento (ver G6 em [decisoes-para-revisar](decisoes-para-revisar.md#fatia-2-da-v01-2026-11-13)); sem isso, o resto da fatia funciona e o aviso fica registrado como `sem_dispositivo`.

| # | Quem | Onde | O que fazer | O que se vê |
| --- | --- | --- | --- | --- |
| 1 | TV | Navegador da TV (ou outra aba) | Abrir `http://exemplo.localhost:3000/tv` | Fundo azul com um código de 6 dígitos |
| 2 | Gerente | Painel → TVs | Escolher a UBS Centro, digitar o código, "Parear" | A TV troca para "iniciar painel"; no painel, a TV aparece "online" |
| 3 | TV | /tv | Tocar "iniciar painel" | Tela da sala de espera: "atendimento ainda não começou" até abrir a sessão |
| 4 | Gerente | Painel → Fila do dia | Abrir a sessão de Curativos | A TV mostra "curativos · N aguardando · +M a caminho" e o QR de entrada |
| 5 | Paciente | Câmera do celular | Ler o QR da TV | O mesmo check-in da fatia 1 |
| 6 | Enfermeira | Painel → Estação | "Chamar próximo" duas vezes seguidas (ou chamar e rechamar) | A TV toca dois tons e mostra cada senha em destaque por 10 s, uma depois da outra; depois descem para "últimas chamadas"; nunca aparece nome |
| 7 | Paciente | App → Minha fila | Presente na unidade, tocar "vou sair um pouco" | Volta a "pode esperar em casa" com a mesma posição; ao voltar, lê o QR de novo |
| 8 | Paciente | Celular (push) | Esperar a vez | "hora de sair de casa", "venha agora", "é a sua vez! senha V-001" e, se pulado, "chamamos a senha… e você não apareceu" |
| 9 | Gerente | Painel → TVs | "Revogar" | A TV volta para um código novo |

**Executado em 2026-11-13** por HTTP contra `npm run dev` (mesmas rotas do painel e da TV): passos 1–4 e 6 conferidos, com a rechamada anunciada de novo e sem nomes na tela; a varredura gravou o "sua vez" e marcou `sem_dispositivo`. `next build` do painel ok com `/tv` e `/tvs`. Falta o clique no navegador (som e fila de anúncios) e o push num celular com build de desenvolvimento.

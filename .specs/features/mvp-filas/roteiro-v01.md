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
| 5 | Recepção | Painel → Fila do dia | Entrar como `recepcao`, "Conferir e marcar presença" em cada um | Situação "Na unidade"; prioridade marcada |
| 6 | Enfermeira | Painel → Estação | Entrar como `enfermeira`, escolher "Sala de procedimentos", "Chamar próximo" | Senha e nome grandes, cronômetro; no app, "É a sua vez! Vá para Sala de procedimentos" |
| 7 | Enfermeira | Estação | Rechamar, Finalizar, Chamar próximo, Não compareceu | Pulado volta à fila; sem ninguém, "Ninguém aguardando na unidade" |
| 8 | Gerente | Fila do dia | "Encerrar sessão" | Atendidos ficam; quem não foi chamado vira remanejado; no app, "Sua vez não chegou hoje" |

**Executado em 2026-11-12** por HTTP (script com as mesmas rotas do app e do painel): passos 1, 2, 4–8 conferidos. Falta o clique no navegador e no celular (Expo Go); o app foi empacotado com `expo export` e passou no `expo-doctor`.

# Fila do dia: a unidade inteira, com busca

> Desenho combinado na conversa de 2026-11-16 (segunda tela da revisão de UI, depois do Agendamento). Protótipo em `.superpowers/brainstorm/` (fora do git). Base: [design.md](design.md) (design system).

## Por quê

A Fila do dia é a tela da **recepção no balcão**. Hoje ela mostra uma sessão por vez, escolhida num menu suspenso cru ("09:00–13:00 · Curativos · Aberta"). Com duas sessões abertas, o que está acontecendo na outra fica escondido. As informações das sessões não ficam claras, os quatro quadros grandes de contagem gastam a primeira dobra com zeros, não há busca para achar quem está no balcão, e as linhas repetem texto ("Atendimento") sem dizer há quanto tempo a pessoa espera.

**Regra nova do design system** (vale daqui para a frente, em todas as telas): **nada de "Info · Info · Info"**. Escolha entre poucas coisas com várias informações (sessão, serviço, estação) é um **cartão ou pílula de escolha** com ícone, título, selo de estado e números com rótulo. O menu suspenso fica para listas longas e simples (fuso, dia).

## Objetivos

1. **A unidade inteira numa fila só**, de todas as sessões de hoje, agrupada por situação, com o serviço em cada linha.
2. **Busca** por nome, senha ou CPF, para achar quem está no balcão sem rolar.
3. **Filtros por serviço em pílulas** com ícone, contagem e estado ("Todas · 6", "Clínico geral · 4", "Odontologia · abre às 13:00").
4. **Tempo de espera** em cada linha: chamado há quanto tempo e em que sala; na unidade há quanto tempo.
5. Abrir e encerrar sessão (gerente) **fora do caminho da recepção**.

## Não objetivos

- Ícone próprio por serviço (todos usam o mesmo ícone por enquanto; um campo de ícone no serviço fica para depois).
- Rever as outras telas (Estação, Sessões…): seguem na varredura, uma por vez.
- Busca no servidor por CPF completo.

## Antiobjetivos

- Esconder o que está acontecendo atrás de um filtro: "Todas" é o padrão.
- Expor o CPF inteiro na tela para a busca funcionar.
- A recepção tropeçar em "Encerrar sessão".

## Abordagens consideradas

**Tela** (escolhida: C): (A) cartões das sessões em linha e a fila da escolhida embaixo; (B) cartões numa coluna à esquerda e a fila à direita (como o Agendamento); **(C) a unidade inteira com busca, cartões como filtros**. C foi escolhida por você ("100%"): é a que serve ao balcão, onde quem chega pode ser de qualquer serviço.

**Dados** (escolhida: A): **(A) uma rota nova, `GET /v1/panel/units/:id/today-queue`**, que devolve as sessões de hoje com os números e todas as pessoas de uma vez; (B) o painel juntar `/hoje` e a fila de cada sessão aberta (2 a 4 consultas a cada 3 s, números às vezes desencontrados). A: uma consulta só, números coerentes, tela leve.

## O desenho

```
Fila do dia                                        [🔍 Buscar nome, senha ou CPF      ]
UBS Centro
[Todas · 6] [🩺 Clínico geral · 4] [🩺 Curativos · 2] [🩺 Odontologia · abre às 13:00]
┌ (só com um serviço escolhido e permissão de gerente) ● Aberta · 2 de 10 vagas   [Encerrar] ┐
┌ ⚠ Esperando a recepção · 1 ────────────────────────────────────────────────────────┐
│ C-004  Pedro Alves   Clínico geral · documento a conferir   [Não confere] [Confere] │
├ 📣 Chamado agora · 1 ───────────────────────────────────────────────────────────────┤
│ C-001  Ana Souza     Clínico geral · Triagem 1 · há 2 min                           │
├ 🪑 Na unidade · 1 ──────────────────────────────────────────────────────────────────┤
│ C-002  Carla Dias    Clínico geral · esperando a triagem há 12 min                  │
├ 🏠 A caminho · 3 ───────────────────────────────────────────────────────────────────┤
│ C-003  Bruno Lima    Clínico geral · em casa                    [Marcar presença]   │
│ V-002  Ana Souza [prioridade]  Curativos · em casa              [Marcar presença]   │
└ ✓ Atendidos e encerrados · 0 (recolhido) ───────────────────────────────────────────┘
```

- **Topo:** título, unidade (o seletor de unidade só aparece para quem tem mais de uma) e a **busca** à direita.
- **Pílulas de serviço** (componente novo do kit, `Filtros`): "Todas" e uma por sessão de hoje, com ícone, nome e o total de pessoas na fila; sessão ainda planejada mostra "abre às HH:MM"; encerrada, "encerrada". O filtro escolhido fica lembrado no navegador.
- **Faixa da sessão** (só com um serviço escolhido): selo de estado, vagas ocupadas, reserva e, para quem pode, "Abrir sessão" ou "Encerrar sessão" (com a confirmação de hoje).
- **A fila**, numa lista com grupos na ordem de hoje (esperando a recepção, chamado agora, na unidade, a caminho, atendidos e encerrados), cada grupo com **ícone e contagem** no título e "Atendidos e encerrados" recolhido. Grupo vazio não aparece. Dentro do grupo, pela ordem de hoje (senha), só que de todas as sessões.
- **Cada linha:** senha em destaque, nome, selo de prioridade, e uma linha de contexto montada por situação (serviço; sala e tempo quando chamado; etapa e tempo quando na unidade; "em casa" quando a caminho; a pendência quando espera a recepção). As ações de presença ficam como hoje, com os botões do kit.
- **Busca:** filtra a lista na hora (sem ir à API), ignorando maiúsculas e acentos; casa nome, senha (com ou sem hífen) e o CPF: com 11 dígitos digitados, compara os 6 do meio com o CPF mascarado que a API já manda. Sem resultado: "Ninguém com '…' na fila de hoje."
- **Some:** os quatro quadros grandes de contagem (os números vão para as pílulas e os títulos dos grupos) e a frase longa do cabeçalho.

## Mudanças por camada

- **Domínio:** `ItemFila.presenteDesde: number | null`, gravado ao ficar presente (check-in, presença pela recepção, volta da triagem para a fila do atendimento já presente) e apagado ao voltar a remoto. Dia antigo sem o campo vale `null`.
- **API:** `GET /v1/panel/units/:unitId/today-queue`, para quem é da equipe da unidade (a mesma regra da fila da sessão, F1): `{ agora, sessoes: [{ id, servico: { id, nome }, inicio, fim, estado, vagas, ocupadas, reserva, contagens: { naFila, naUnidade, aCaminho, chamados, atendidos } }], itens: [ItemDaFila + { sessaoId, servico, desde: iso | null, estacao: string | null }] }`. `desde` = hora da chamada (chamado) ou `presenteDesde` (na unidade).
- **Painel:** a página reescrita; componentes novos do kit `Filtros` (pílulas de escolha) e `Busca` (campo com ícone); funções puras em `lib/queue.ts` (busca, linha de contexto, tempo de espera, rótulo da pílula).

## Restrições

- TDD em toda task; modo rápido da v0.1.
- Design system: botões do kit, nenhum `<button>` fora de `components/ui/` (a trava continua valendo), sem "Info · Info · Info" em seletor.
- Painel em Next 16 com mudanças incompatíveis: ler `node_modules/next/dist/docs/` antes de mexer em padrões do Next.
- A consulta continua a cada 3 s (PD-33, tempo real por consulta até o WebSocket).

## Decisões minhas, para revisar

- **Faixa da sessão só com um serviço escolhido**, para a recepção não tropeçar em "Encerrar".
- **CPF pelos 6 dígitos do meio**, sem mandar o CPF inteiro ao painel.
- **Filtro lembrado no navegador**, como a unidade.
- **`presenteDesde` no domínio**, porque hoje não há como saber há quanto tempo a pessoa está na unidade.
- **Mesmo ícone para todos os serviços** por enquanto.

## Fica para quem constrói

- Os ícones exatos (lucide) de cada grupo e da pílula.
- O texto dos estados vazios.
- Onde mais o `presenteDesde` precisa ser gravado, seguindo as transições para "presente" do contrato de item.

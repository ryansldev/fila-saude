# App: o mapa da aba "unidades"

> Desenho combinado na conversa de 2026-11-16. Protótipo em `.superpowers/brainstorm/` (fora do git): `mapa-estilos.html` (opção B, "azul suave"). Base: [design.md](design.md) e as cores de `packages/design/tokens.ts`.

## Por quê

O mapa é o Google Maps padrão: colorido, cheio de comércios e ícones, com os pinos do sistema. Não parece o Fila Saúde, que é branco, azul e cinzas suaves.

## Objetivo

Um mapa limpo, majoritariamente branco e azul, com cinzas suaves, onde os pinos das unidades são o que mais aparece, sem perder as referências para a pessoa se localizar (nomes de ruas, bairros e estações de metrô).

## Não objetivos

- Mudar a lista de unidades, o "como chegar" ou a API.
- O mapa do iPhone: o Apple Maps não aceita estilo de cores e continua como está (ver "Depois").

## Abordagens consideradas

- **(A) Estilo próprio no Google Maps do Android e pinos nossos.** Funciona já no Expo Go, sem chave nem custo. **Escolhida** (sua escolha, "segue recomendação").
- (B) O mesmo, com o Google Maps também no iPhone: pede chave do Google e build próprio (EAS). Fica para junto do G6.
- (C) Mapa próprio (MapLibre): build próprio e serviço de mapas pago. Exagero para a v0.1.
- **Cores:** entre "branco e cinza", **"azul suave"** e "azul do app", **azul suave**, com as estações de metrô (sua escolha). Branco e cinza perde contraste no sol; azul do app apaga os pinos azuis e o ponto de "você está aqui".

## O desenho

### O mapa (Android)

- **Terra:** `#f5f8f9`; uso do solo `#eff4f6`; praças e parques `#e7f1ef`; água `#c9e2f3`; prédios `#e9eff2`.
- **Ruas:** brancas com contorno `#e1e8ea`; avenidas e vias expressas em azul-claro `#dcecf8` com contorno `#bcd8ef`.
- **Nomes:** de bairros em `#6a7f92`; de ruas em `#8ea0ae`, com contorno da cor da terra.
- **Some:** comércios e outros pontos de interesse, ônibus, limites administrativos e ícones das vias.
- **Fica:** as **estações de metrô e trem**, com nome e ícone em azul-acinzentado.

### Os pinos (Android e iPhone)

- Quadrado de cantos arredondados (34 px, cantos 12) com o ícone de prédio branco, borda branca de 2 px e **relevo embaixo** (borda inferior mais escura) e uma pontinha.
- **Verde** (`verde`, relevo `verdeSombra`) com atendimento aberto; **azul** (`action`, relevo `acaoSombra`) sem.
- **A escolhida** cresce (42 px) e mostra o nome numa pílula branca com borda `linha` acima do pino. Tocar no mapa fora dos pinos tira a escolha (como hoje).
- O ponto de "você está aqui" continua o do sistema.

### O que fica para quem constrói

- Gerar o estilo do Google (JSON de `customMapStyle`) a partir dos tokens, num arquivo de `src/lib`, com teste.
- Pinos como `Marker` com filhos; `tracksViewChanges` desligado depois de desenhar, para não pesar no Android.

## Depois

- iPhone com o mesmo mapa: Google Maps no iOS, com chave e build próprio (junto do G6).

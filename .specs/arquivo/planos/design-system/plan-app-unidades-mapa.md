# App: o mapa da aba "unidades" — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** o mapa do Android no estilo "azul suave" (branco, azul e cinzas suaves, com as estações de metrô) e pinos próprios com relevo nas duas plataformas. **Architecture:** o estilo do Google (`customMapStyle`) e a aparência dos pinos são funções puras em `src/lib/mapa.ts`, a partir dos tokens; `mapa.native.tsx` só as usa. **Tech Stack:** Expo/React Native, `react-native-maps` 1.29, Vitest (só funções puras). **Spec:** [app-unidades-mapa.md](../../../features/design-system/app-unidades-mapa.md).

## Global Constraints

- TDD na lógica (`src/lib`); nenhum `<Pressable` fora de `src/components/ui.tsx` (o pino é um `Marker` com filhos, sem `Pressable`); cores só dos tokens (`COR` de `@fila-saude/design`) ou as fixadas no spec; textos em minúsculas.

## Review Focus

1. **Estação de metrô sumir junto com os pontos de interesse:** o estilo esconde `poi` mas mantém `transit.station.rail` visível. → Task 1, teste.
2. **Ônibus aparecer:** `transit.station.bus` e `transit.line` escondidos. → Task 1, teste.
3. **Pino escolhido sem nome ou com o tamanho errado:** `aparenciaDoPino(aberto, true)` dá 42 px e `nome: true`. → Task 1, teste.
4. **Pino que não troca de cor ao escolher** (o Android guarda o desenho com `tracksViewChanges` desligado): a `key` do `Marker` muda com a escolha (já é assim hoje). → Task 2, olhar no celular.
5. **iPhone:** `customMapStyle` é ignorado no Apple Maps, sem erro; os pinos novos aparecem. → sem iPhone aqui; anotar no roteiro.

---

### Task 1: estilo e pinos (`src/lib/mapa.ts`, teste `test/mapa.test.ts`)

**Interfaces:**
- `ESTILO_DO_MAPA: { featureType?: string; elementType?: string; stylers: object[] }[]` — o "azul suave" do spec (terra `#f5f8f9`, uso do solo `#eff4f6`, parques `#e7f1ef`, água `#c9e2f3`, prédios `#e9eff2`, ruas `#ffffff` com contorno `#e1e8ea`, avenidas e vias expressas `#dcecf8` com contorno `#bcd8ef`, bairros `#6a7f92`, ruas `#8ea0ae`); `poi`, `transit.station.bus`, `transit.line`, `administrative` (geometria) e `road` `labels.icon` com `visibility: off`; `transit.station.rail` `visibility: on`.
- `aparenciaDoPino(aberto: boolean, escolhido: boolean): { cor: string; relevo: string; tamanho: number; nome: boolean }` — aberto: `COR.verde`/`COR.verdeSombra`; senão `COR.action`/`COR.acaoSombra`; 34 ou 42; `nome` = escolhido.

- [ ] Testes vermelhos: `poi` some; `transit.station.rail` aparece; ônibus somem; terra, água e avenidas com as cores do spec; os quatro casos de `aparenciaDoPino`.
- [ ] Implementar; `npm run test:mobile` verde.

### Task 2: o mapa (`src/components/mapa.native.tsx`, `mapa.tsx`)

- [ ] `MapView` com `customMapStyle={ESTILO_DO_MAPA}`, `showsPointsOfInterest={false}` não é preciso (o estilo cuida).
- [ ] `Marker` com filhos: quadrado (cantos 12, borda branca 2, `borderBottomWidth` 4 na cor do relevo) com `Building2` branco 18 px, a pontinha (triângulo na cor do relevo) e, se `nome`, a pílula branca (borda `COR.linha`, 2 px, inferior 3 px, `FONTE.extra` 12) acima. `anchor={{ x: 0.5, y: 1 }}`; `tracksViewChanges` ligado só no primeiro desenho (estado que desliga após ~300 ms). Sem `title`/`description` (o nome já está na pílula e na lista).
- [ ] `corDoPino` sai dos dois arquivos; o `mapa.tsx` (web) usa `aparenciaDoPino` para as cores.
- [ ] `tsc`, `biome`, `npm run test:mobile`; olhar no Android (Expo Go); decisões, STATE, plano arquivado; commit `feat(mobile): soft blue map style and raised pins on the units tab`.

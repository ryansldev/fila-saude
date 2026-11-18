# Discovery: onde guardar a contagem de tentativas (2026-11-18)

Pergunta (NC5, item a; decidido na AD-063, valores na AD-065): hoje a contagem de senhas erradas (RN-ID-04) e de CPFs informados (RN-ID-07) fica na memória do processo da API. Onde ela deve ficar?

Fontes no fim. É pesquisa de mesa somada à leitura do código; nada foi medido em produção.

## 1. O problema da memória

- **Reiniciar zera tudo.** Cada deploy ou queda da API devolve 5 tentativas a quem estava bloqueado. No piloto isso acontece poucas vezes por semana, então o efeito é pequeno.
- **Mais de uma instância conta em dobro.** Com 2 instâncias atrás de um balanceador, o atacante tem 5 tentativas em cada uma, e o limite de CPFs vira 40 por hora. A [hospedagem](discovery-hospedagem.md) prevê uma instância por VPS no piloto e "mais de uma instância" ao subir de nível.
- **O limitador do better-auth tem o mesmo problema.** Ele também guarda em memória por padrão e só aceita outro lugar com `storage: "database"`, `secondary-storage` ou `customStorage` (código em `better-auth/dist/api/rate-limiter`).

## 2. Opções

| Opção | Como | Prós | Contras |
| --- | --- | --- | --- |
| **Memória (hoje)** | Mapas no processo | Custo zero; já está pronto e testado | Zera ao reiniciar; não serve para mais de uma instância |
| **Tabela no Postgres** | Uma tabela `UNLOGGED` no banco que já existe em cada VPS (o central para o app, o do município para o painel); a contagem e a reserva usam `insert … on conflict do update … returning`, que é atômico | Nenhum serviço novo; serve para várias instâncias; sobrevive a deploy; combina com a PD-07, que descartou Redis; pode servir também ao limitador do better-auth (`customStorage`) | Uma ou duas consultas a mais por login (o login é raro, então a carga é desprezível); `UNLOGGED` perde os dados numa queda do Postgres, o que aqui é aceitável; precisa limpar as linhas vencidas (dá para pendurar na varredura que já existe) |
| **Redis ou Valkey** | Contêiner novo em cada VPS, com `INCR` e TTL | Feito para isso; TTL nativo; rápido | Mais um serviço por VPS para operar, monitorar e atualizar; mais memória na VPS pequena; vai contra a PD-07; é exagero para o volume de logins de um município |

**Sobre `UNLOGGED`:** a tabela não escreve no WAL, então é mais rápida, e não vai para o backup contínuo nem para réplicas. Para contagens de 15 minutos isso é vantagem: o dado não deve sobreviver em backup.

## 3. Privacidade (LGPD)

A chave da contagem tem CPF, login ou IP, que são dados pessoais. Em memória ela some sozinha; numa tabela ela fica no banco. Guardar só o **HMAC** da chave (SHA-256 com um segredo da API), nunca o valor puro, e apagar a linha quando vencer. A contagem funciona igual e o banco não guarda nenhum CPF a mais.

## 4. Recomendação

**Tabela `UNLOGGED` no Postgres de cada VPS, com a chave em HMAC.** É a opção que não quebra com mais de uma instância e não acrescenta serviço, alinhada à PD-07.

Quando fazer:
- No piloto (uma instância por VPS), a memória funciona; a perda num deploy é tolerável.
- O custo de trocar é baixo, perto de um dia: uma tabela, um módulo com a mesma interface de hoje (`reserve`, `fail`, `release`, `reset`, `count`) e a limpeza.
- Vale fazer **junto com a [contagem por IP](discovery-bloqueio-por-ip.md)**, que acrescenta chaves e também precisa dar ao limitador do better-auth um lugar comum.
- **Obrigatório antes** de subir uma segunda instância de qualquer API.

Descartado: Redis. Só faz sentido se outro motivo trouxer Redis para a infraestrutura.

## Fontes

- Código: `node_modules/better-auth/dist/api/rate-limiter/index.mjs` (opções de armazenamento do limitador).
- [pg-ratelimit: desenho com tabela UNLOGGED](https://benjick.js.org/pg-ratelimit/database/)
- [rate-limiter-flexible (suporte a Postgres)](https://www.npmjs.com/package/rate-limiter-flexible)
- [discovery-hospedagem](discovery-hospedagem.md) e PD-07 em [plan.md](plan.md)

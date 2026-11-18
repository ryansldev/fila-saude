# Pré-análise: hospedagem e custo

2026-11-10 · status: **piloto decidido** (PD-12 revista: duas VPS nossas); provedor da VPS, longo prazo e cobrança seguem em aberto (D7, [discovery-preco](discovery-preco.md)).

## Decisão para o MVP e o piloto (revista em 2026-11-10, PD-12)

Objetivo: o mais barato possível para o piloto dar 10–30% de lucro ([discovery-preco](discovery-preco.md)), sem abrir mão de backup, criptografia, isolamento por município e dados no Brasil.

| Peça | Escolha | R$/mês |
| --- | --- | --- |
| VPS central | Contas, catálogo e roteamento; Postgres central; homologação | ~40–80 |
| VPS do município | API em modo de um tenant, Postgres e fotos do município | ~40–80 |
| Backup e fotos | Armazenamento de objetos no Brasil (compatível com S3); backup contínuo criptografado (WAL-G ou pgBackRest) | ~10–20 |
| DNS, e-mail transacional | — | ~5–15 |
| **Total** | | **~100–150** |

- **LGPD:** a prefeitura é a controladora e nós somos os operadores (art. 39); o dado pode ficar na nossa infra com contrato que preveja instruções, segurança, aviso de incidente e devolução ou exclusão ao fim (D5, D7). Dados no Brasil.
- **Criptografia:** fotos criptografadas na aplicação, com chave por município; backups criptografados; disco criptografado se o provedor oferecer.
- **Backup:** contínuo, com restauração para um ponto no tempo testada antes do piloto (T4.3). É a parte que deixamos de ter "pronta" ao sair do banco gerenciado.
- **Na infra da prefeitura depois:** a VPS do município é o mesmo contêiner; muda só de dono. Oferecido como opção de contrato depois do piloto.
- **Provedor:** a escolher entre VPS no Brasil (ex.: Lightsail São Paulo, provedores nacionais), pelo preço e por ter armazenamento de objetos no Brasil.
- **Quando subir de nível:** vários municípios ou SLA em contrato → banco gerenciado, mais de uma instância, ou a VPS na infra da prefeitura.
- **Descartado para o piloto:** EC2 + RDS (R$ 300–410/mês, desenho anterior da PD-12) e Lightsail com banco gerenciado (R$ 165–220): mais caros, sem ganho que compense no piloto.

## Análise original

## Restrições da spec

- Um banco **isolado por município** (RNF-DADOS-01), mais uma camada central (catálogo e conta do paciente).
- O mesmo software roda na nossa nuvem (conta separada) **ou na infraestrutura da prefeitura**.
- Dados armazenados no Brasil (RNF-DADOS-03). A prefeitura é a controladora (LGPD).
- Fotos de documentos criptografadas e cada acesso registrado (RNF-LGPD-03).
- Do clique em "Chamar próximo" até a TV: 3 s (RNF-DES-01). Reconexão automática.
- gov.br, se adotado: callback no domínio gov.br do município (ver [discovery-identidade.md](discovery-identidade.md)).

**Premissa para qualquer provedor:** tudo em contêiner (API e web), Postgres padrão, armazenamento compatível com S3, nada de serviço proprietário no caminho crítico. Assim, trocar de nuvem ou instalar na prefeitura é configuração, não reescrita.

## Opções

| Opção | Prós | Contras |
| --- | --- | --- |
| **AWS sa-east-1 (São Paulo)** | Madura; RDS com Multi-AZ, backups e criptografia por chave (KMS por tenant); S3; o mais pedido em licitação | Região cara (~50% acima da us-east-1); cobrança em dólar |
| **Azure Brazil South / GCP southamerica-east1** | Equivalentes; a Azure tem presença forte no setor público | Mesmo perfil de preço e câmbio |
| **Magalu Cloud** (nacional) | Cobrança em real; narrativa de soberania de dados; tem Postgres gerenciado e S3 compatível | Menos madura; sem preço público encontrado; risco de serviço |
| **Infra da prefeitura** (datacenter municipal, estadual ou empresa pública de TI) | A prefeitura tem controle total dos dados, o que ajuda na venda e na LGPD | Qualidade muito variável; a operação e o suporte ficam caros para nós; vale para municípios grandes |

**Leitura inicial:** começar na **AWS sa-east-1**, com a premissa de portabilidade, e oferecer "na sua infra" como opção comercial para municípios grandes. Reavaliar a Magalu Cloud com uma proposta em mãos.

## Modelo de isolamento (afeta o custo)

| Modelo | Isolamento | Custo marginal por município |
| --- | --- | --- |
| **Instância de banco por município** | Máximo: a prefeitura pode receber a instância ou o snapshot inteiro | Alto (~US$ 50–100/mês) |
| **Banco por município numa instância compartilhada** | Bom: bancos e credenciais separados, chave de criptografia por tenant, mas recursos compartilhados | Baixo (~US$ 5–15/mês) |

Sugestão: **banco por município numa instância compartilhada** para municípios pequenos e médios, e **instância dedicada** para quem contratar (ou exigir em edital). O código é o mesmo; muda só a conexão do tenant.

## Dimensionamento: município médio

Premissa: **100 mil habitantes**, ~20 UBS, ~30 equipes. Para comparar, a maioria dos municípios brasileiros tem menos de 20 mil habitantes.

- Atenção primária: ~2 consultas por habitante por ano → **~800 atendimentos por dia útil**, mais as triagens.
- Pico: algumas dezenas de requisições por segundo (polling e SSE de apps, TVs e estações). É carga pequena: 2 contêineres pequenos sobram.
- Conexões em tempo real: ~20 TVs + ~60 estações + pacientes em fila aberta (centenas). Cabe em SSE numa instância.
- Fotos: pré-cadastro com 2 fotos de ~300 KB × ~40 mil pacientes ao longo do tempo → **~25 GB**.
- Banco: poucos GB por ano.

## Custo estimado (AWS sa-east-1)

> Ordem de grandeza, não orçamento. Preços de referência de terceiros (ex.: RDS db.t4g.micro Postgres ≈ US$ 0,034/h em sa-east-1, o dobro em Multi-AZ). Confirmar na calculadora da AWS. Câmbio assumido: **R$ 5,50/US$**.

**Base compartilhada** (paga uma vez, dividida entre os municípios):

| Item | US$/mês |
| --- | --- |
| API e web: 2–3 contêineres pequenos (Fargate, 0,5 vCPU / 1 GB) | 50–90 |
| Load balancer | 25–35 |
| Banco central (catálogo e contas), db.t4g.small Multi-AZ | 90–110 |
| Logs, métricas e alertas | 15–30 |
| DNS, certificados, e-mail transacional (recuperação de senha) | 5–15 |
| **Total da base** | **~185–280 (R$ 1.000–1.550)** |

**Por município**:

| Item | Banco na instância compartilhada | Instância dedicada (t4g.small Multi-AZ) |
| --- | --- | --- |
| Banco | 5–15 | 90–120 |
| Fotos no S3 (~25 GB) + chave KMS | 2–3 | 2–3 |
| Tráfego de saída | 5–10 | 5–10 |
| **Total por município** | **~12–28 (R$ 65–155)** | **~100–135 (R$ 550–740)** |

**Fixos fora da nuvem:** Apple Developer US$ 99/ano; Google Play US$ 25 (uma vez); Expo EAS no plano gratuito no início (o pago, ~US$ 99/mês, só se o volume de builds pedir). Push pelo Expo: gratuito.

**Cenários (só infraestrutura)**:

| Cenário | US$/mês | R$/mês | R$ por município/mês |
| --- | --- | --- | --- |
| Piloto: 1 município médio, instância dedicada | ~300–400 | ~1.650–2.200 | ~1.650–2.200 |
| 10 municípios, instância compartilhada | ~400–600 | ~2.200–3.300 | ~220–330 |
| 10 municípios, instância dedicada para cada um | ~1.200–1.650 | ~6.600–9.000 | ~660–900 |

**Fora desta conta:**
- Prova de identidade, se a biometria comercial for usada: ~R$ 1–2 por validação, uma vez por paciente. Num município médio com ~15 mil pessoas verificadas por biometria, seriam ~R$ 15–30 mil no início. O gov.br e a validação presencial custam zero.
- Pessoas (suporte e plantão), WAF ou proteção anti-DDoS, e homologação separada da produção (somaria ~30–50% à base).

## Em aberto

1. Provedor: AWS ou nacional (Magalu: pedir proposta).
2. Modelo de isolamento padrão: banco por município numa instância compartilhada, ou instância dedicada.
3. Em quanto tempo oferecer "na infra da prefeitura" e com que suporte.
4. Modelo de cobrança para a prefeitura (por habitante, por unidade ou fixo). Fora do escopo técnico, mas depende destes números. Levantado no D7 (contratação), junto com as exigências de hospedagem do contrato.

## Fontes

- [RDS db.t4g.micro em sa-east-1 (Sparecores)](https://sparecores.com/database/aws/db.t4g.micro) e [Bytebase](https://www.bytebase.com/dbcost/rds/instance/db.t4g.micro/)
- [Preços do AWS Fargate](https://aws.amazon.com/fargate/pricing/)
- [Magalu Cloud: serviços oferecidos](https://startups.com.br/negocios/magazine-luiza-lanca-servico-de-nuvem-proprio-para-atender-pmes/)

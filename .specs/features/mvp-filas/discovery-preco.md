# Discovery: preço e DRE do piloto

2026-11-10 · status: **piloto decidido** (ver "Decidido"); modelo para os próximos municípios no D7. Objetivo do usuário: **10–30% de lucro líquido** na última linha da DRE, já no mês da primeira prefeitura.

## Mercado: quanto se cobra

Pesquisa de mesa; valores públicos de fornecedores e editais, a confirmar.

| Referência | O que é | Valor |
| --- | --- | --- |
| Meu Atendimento Virtual | Senha e painel genéricos (SaaS) | Grátis (1 local) a R$ 39–167/mês |
| Sistemas de Senha | Senha e painel genéricos | A partir de R$ 160/mês (5 usuários) |
| Senha Fácil | Senha + painel de TV com voz, por unidade | R$ 1.500 de implantação + **R$ 99,90/mês por unidade** |
| TiraSenha | Totem + painel físico por assinatura | Entrada + R$ 547/mês por 12 meses |
| São Lourenço da Mata-PE (ETP, 2024) | Gerenciamento de filas nas unidades de saúde, com equipamentos | R$ 48.150 no total |
| Pato Branco-PR (~90 mil hab.) | Gestão de saúde completa (prontuário, nuvem) | ~R$ 34 mil/mês (R$ 407,6 mil/ano) |
| Águas de Chapecó-SC | Sistema de gestão (edital 2025) | Até R$ 623 mil em 12 meses |

**Leitura:**
- Senha e painel genéricos são baratos (R$ 100–550 por unidade/mês). O Fila Saúde faz bem mais: fila remota no app, "saia de casa", prioridade e risco, lista de espera, regulação, contingência. Não deve se posicionar como "sistema de senha".
- Gestão de saúde completa (prontuário) custa dezenas de milhares por mês. Somos uma fração disso e não substituímos o prontuário (constituição: "somos só a fila").
- **Faixa razoável para testar:** algo entre a senha genérica e a gestão completa. Uma âncora é cobrar **R$ 0,04–0,09 por habitante/mês** (10–25% do custo por habitante de Pato Branco), ou **R$ 200–400 por unidade/mês**, sempre com um **piso mensal**.

| Município | Por habitante (R$ 0,04–0,09) | Por unidade (R$ 200–400) |
| --- | --- | --- |
| 20 mil hab., ~5 UBS | R$ 800–1.800 | R$ 1.000–2.000 |
| 50 mil hab., ~12 UBS | R$ 2.000–4.500 | R$ 2.400–4.800 |
| 100 mil hab., ~20 UBS | R$ 4.000–9.000 | R$ 4.000–8.000 |

**Fila remota: quem mais faz** (pesquisa de 2026-11-10):
- **Fila virtual genérica (comércio):** AppFila (R$ 29,90–49,90/mês, aviso por WhatsApp; barbearias e clínicas), FilaRápida, Filazero (cobra por atendimento e escreve para órgãos públicos), Wavetec (internacional, cita governos). Fazem "entrar na fila pelo celular e ser avisado", sem nada de saúde pública.
- **Prefeituras:** iniciativas pontuais, como o Filômetro de Aracaju (lotação das UBS na campanha de síndromes gripais) e o "De Olho na Fila" de São Paulo (vacinação), e a consulta da posição na fila de regulação (ex.: União da Vitória-PR). Nenhuma faz fila remota do atendimento do dia.
- **Lyne** publica conteúdo sobre gestão de filas em UBS; vale verificar se tem produto para o setor.
- **Não achamos** ninguém que junte fila remota do dia, "saia de casa", risco e prioridade legal, lista de espera, regulação e TV para UBS. Esse é o diferencial para justificar um preço acima de "sistema de senha".

**Como contratar o piloto rápido (para o D7, confirmar com o jurídico):**
- **Dispensa por valor** (Lei 14.133, art. 75, II): serviços até ~R$ 62–65 mil/ano (valor atualizado todo ano por decreto) dispensam licitação. Um piloto até ~R$ 5 mil/mês cabe aí.
- **Contrato de solução inovadora** (Marco Legal das Startups, LC 182/2021): teste de até 12 meses, feito para validar produto novo com o poder público.

## DRE: preço mínimo para a margem (metodologia 1)

**Custos mensais sem pessoas** (estimativa):

| Item | R$/mês |
| --- | --- |
| Infra: duas VPS no Brasil + backup (PD-12, ver [hospedagem](discovery-hospedagem.md)) | ~125 |
| Apple Developer (US$ 99/ano) + domínio + e-mail | ~60 |
| Contador | ~400 |
| Reserva (imprevistos, suporte, envio extra de e-mail) | ~140 |
| **Total** | **~725** |

**Impostos (Simples Nacional, confirmar com o contador):** software costuma começar no **Anexo V (15,5%)**. Com folha, incluindo o pró-labore, de pelo menos 28% do faturamento (fator R), vai para o **Anexo III (6%)**. Pagar pró-labore, portanto, **baixa o imposto**.

**Fórmula:** `preço = (custos + pró-labore) ÷ (1 − imposto − margem)`

| Cenário | Imposto | 10% de lucro | 20% de lucro | 30% de lucro |
| --- | --- | --- | --- | --- |
| A. Sem pró-labore | 15,5% | R$ 975 | R$ 1.125 | R$ 1.330 |
| B. Pró-labore de R$ 3.000 | 6% | R$ 4.435 | R$ 5.035 | R$ 5.820 |
| C. Pró-labore de R$ 6.000 (inclui suporte) | 6% | R$ 8.005 | R$ 9.090 | R$ 10.510 |

Nos cenários B e C o fator R fica acima de 28% (o pró-labore é 50–60% do faturamento).

**O que isso quer dizer:**
- **Sem contar o tempo de vocês (A)**, qualquer município acima de ~20 mil habitantes já dá 30% de lucro. Mas é um lucro que não paga ninguém.
- **Contando um pró-labore modesto (B)**, o piloto precisa ser um município de **~50–100 mil habitantes**, ou cobrar um piso de ~R$ 5 mil/mês. Isso ainda cabe na dispensa por valor.
- **Infra não decide a margem:** passar de R$ 400 para R$ 125 muda o preço mínimo em ~R$ 350. O que decide é o preço e o pró-labore.
- **Caixa ≠ lucro:** a prefeitura costuma pagar 30–90 dias depois do serviço. Os primeiros meses precisam de capital de giro para infra, Apple e contador, mesmo com a DRE no azul.

## Decidido (2026-11-10)

- **Piloto num município de ~8 mil habitantes** (o contato que existe hoje), com **mensalidade mínima de R$ 1.500** e taxa de implantação única de R$ 2.000–3.000, por dispensa de valor (confirmar no D7).
- **Sem pró-labore no início:** num contrato desse tamanho o pró-labore custa mais (~R$ 1.600) do que o fator R economiza de imposto (~R$ 140). Os dois sócios recebem por distribuição de lucro. Reavaliar a partir do 2º município.
- Com R$ 1.500 e custos de ~R$ 725, o imposto de 15,5% deixa **~R$ 540/mês de lucro (~36%)**. O piloto prova o produto; a renda vem com os próximos municípios, que só somam a VPS de cada um.

## Decisões em aberto

1. ~~Infra~~: decidida, duas VPS nossas no Brasil (PD-12 revista).
2. **Modelo de preço para os próximos municípios:** por habitante ou por unidade, com piso de R$ 1.500 (D7).
3. Confirmar com o contador: enquadramento (Anexo III ou V), distribuição de lucro e abertura da empresa com dois sócios.

## Fontes

- [Meu Atendimento Virtual: planos](https://meuatendimentovirtual.com.br/planos/), [Sistemas de Senha](https://sistemasdesenha.com.br/), [Senha Fácil](https://senhafacil.app/), [TiraSenha](https://www.tirasenha.com/sistemas-c-impressora-de-senhas/sistemas-c-totem-de-senhas-para-paineis-led/sistema-inteligente-de-atendimento-por-assinatura-terminal-touch-painel-digital-garantia-24-meses-p)
- [ETP de gerenciamento de filas, São Lourenço da Mata-PE](https://transparencia.saolourencodamata.pe.gov.br/uploads/5371/1/licitacao/2024/102/1724179958_etp.pdf)
- [Software de gestão de saúde pública, Pato Branco-PR](https://patobranco.pr.gov.br/wp-content/uploads/2023/04/41-SOFTWARE-GESTAO-DE-SAUDE-PUBLICA.pdf) e [edital 133/2025, Águas de Chapecó-SC](https://aguasdechapeco.sc.gov.br/uploads/sites/347/2025/07/EDITAL-133.2025-PE-133-SISTEMA-GESTAO.pdf)
- [Simples Nacional para software: Anexo III ou V (Agilize)](https://agilize.com.br/artigos/?p=4180) e [tabela 2026](https://agilize.com.br/artigos/?p=498)
- [Filômetro de Aracaju (Infonet)](https://infonet.com.br/noticias/saude/app-permite-que-cidadao-monitore-fila-em-ubss-para-sindromes-gripais/), [Lyne: gestão de filas em UBS](https://lyne.in/pt-BR/blog/gestao-de-filas-em-unidade-basica-de-saude), [Filazero: filas em órgãos públicos](https://filazero.net/blog/gestao-de-filas-em-orgaos-publicos/), [AppFila](https://appfila.online/)
- [Lightsail em São Paulo (AWS, 06/2026)](https://aws.amazon.com/pt/about-aws/whats-new/2026/06/amazon-lightsail-aws-regions/) e [preços do Lightsail (CloudZero)](https://www.cloudzero.com/blog/amazon-lightsail-pricing/)

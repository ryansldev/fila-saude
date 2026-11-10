# Discovery: prova de identidade do paciente

2026-11-10 · status: **decidido** (AD-017). Decisões: níveis de confiança; MVP verifica só pela recepção, no 1º check-in de qualquer sessão (inclusive plantão); conta não verificada se inscreve em sessão pública; gov.br opcional por município, depois do piloto; biometria comercial reavaliada depois do piloto. Segue em aberto só o texto do termo com o jurídico.

## Problema

Login é CPF + senha (RN-ID-01), mas nada prova que quem digita o CPF é o dono dele. Validar os dígitos só garante que o número existe.

**Ameaças concretas**, da mais provável para a menos:

1. **Cambista de vaga.** Alguém cria contas com CPFs alheios (vazados aos milhões) para segurar vagas de sessões públicas e revendê-las. É o maior risco para um produto que distribui vagas escassas.
2. **Usurpação.** Alguém cria a conta com o CPF de outra pessoa antes dela. O titular não consegue mais se cadastrar (RN-ID-02) e precisa ir à recepção contestar (RN-ID-03).
3. **Acesso a dados sensíveis.** Quem entra na conta de outra pessoa vê as respostas do questionário dela, seus documentos e onde ela será atendida (dado de saúde, LGPD art. 11).
4. **Sabotagem.** Alguém cancela a vaga do titular ou toca em "Vou sair" no lugar dele.

O que a spec já tem: **validação presencial** na recepção (pré-cadastro RN-PRE-03, vínculo RN-ID-03). Ela é forte, mas só acontece na primeira ida. Até lá, a conta age como se fosse do titular.

## Opções

| # | Estratégia | Força | Custo | Atrito para o paciente | Observações |
| --- | --- | --- | --- | --- | --- |
| A | **Presencial na recepção** (já na spec) | Alta | Zero (tempo de balcão) | Alto: uma ida à unidade | Só protege depois da ida. Hoje é obrigatória só onde a unidade exige pré-cadastro |
| B | **Login gov.br (Login Único)** exigindo nível **prata ou ouro** | Alta: prata/ouro já passaram por biometria facial (TSE/CNH) ou por banco credenciado | Gratuito para o órgão público | Baixo para quem já tem gov.br prata/ouro; alto para quem não tem | Ver restrições abaixo. É o padrão do governo e o paciente já conhece |
| C | **Biometria facial comercial** (selfie + prova de vida comparada com base oficial): Serpro Datavalid, Unico, idwall, CAF | Alta | Pago por validação. Datavalid: R$ 1,68 por biometria na faixa até 999 consultas (preço de 2022, sem tabela pública atual). Os outros só por proposta | Baixo: uma selfie no app | Contrato com fornecedor; biometria é dado sensível. Como o fornecedor processa, não guardamos o rosto |
| D | **Validação cadastral** (nome + nascimento + nome da mãe batem com o CPF; Datavalid ~R$ 0,80 em 2022) | Baixa: esses dados também vazam | Pago | Baixo | Não resolve o cambista |
| E | **Foto de documento + selfie revisadas por humano** (recepção ou agendador, à distância) | Média: depende do olho humano | Tempo da equipe | Médio | É o pré-cadastro (RN-PRE-01) sem a ida presencial. Não escala no volume de uma sessão pública |

### Restrições do gov.br (Login Único)

- Protocolo OpenID Connect com PKCE. O nível da conta vem no `id_token` (`reliability_info.level`: bronze, silver, gold), com escopo `govbr_confiabilidades`. No celular é obrigatório o navegador nativo; WebView é proibida.
- **Credencial de produção só para sistema em domínio oficial de governo** (gov.br, mil.br, jus.br… Portaria SGD/MGI nº 7.076/2024). Quem pede é o órgão público, com o CNPJ do município. A empresa não consegue pedir em nome próprio.
- **Consequência:** cada prefeitura pede sua credencial e expõe o callback num subdomínio dela (ex.: `fila.<municipio>.<uf>.gov.br`) apontando para a nossa API daquele tenant. A troca do código por token usa `client_secret`, então acontece no backend do tenant, e o app recebe a sessão por deep link. Isso combina com o multi-tenant, mas acrescenta um passo burocrático por município (o prazo informado é de 3 dias depois do pedido).
- Bronze é só CPF autodeclarado e não serve como prova.

## Recomendação (a validar)

**Um "nível de confiança" por conta, em camadas, como o próprio gov.br faz:**

| Nível | Como chega | O que libera |
| --- | --- | --- |
| **Não verificada** | CPF + senha + e-mail confirmado | Ver agenda, entrar na lista de espera de sessão **privada** (o agendador vê "identidade não verificada" e decide; a recepção valida na ida) |
| **Verificada** | gov.br prata/ouro (B), **ou** validação presencial na recepção (A), **ou** biometria comercial (C), se o município contratar | Tudo, inclusive **inscrição em sessão pública** e conferência de prioridade legal declarada |

Por quê:

- **Sessão pública é onde mora o cambista**: não tem agendador filtrando. Exigir conta verificada para se inscrever nela fecha a ameaça 1.
- **gov.br como caminho principal**: gratuito, forte e conhecido. A burocracia por município é a mesma do Conecta/e-SUS, que as prefeituras já conhecem.
- **A recepção como saída para todos** (RNF-ACE-02): quem não tem gov.br prata nem celular com câmera boa se verifica no balcão, com o fluxo que a spec já tem.
- **Biometria comercial como módulo opcional**, contratado pelo município, porque tem custo por validação e exige contrato com fornecedor.
- **Usurpação:** quem prova a identidade (gov.br ou recepção) **retoma** a conta de um CPF já usado. A conta antiga é bloqueada e o caso vai para a auditoria (substitui o "procure a recepção para contestar" da RN-ID-02 quando há gov.br).

## Decisões em aberto

1. **O nível de confiança é o caminho?** Ou o MVP exige verificação para tudo, mais simples e com mais atrito?
2. **Sessão pública exige conta verificada?** Isso fecha o cambista, mas quem nunca foi à unidade e não tem gov.br prata não consegue se inscrever sozinho.
3. **gov.br no MVP ou depois?** Ele depende de cada prefeitura pedir a credencial. Uma opção: o MVP sai com presencial (A) e o gov.br entra antes do piloto.
4. **Biometria comercial entra no MVP?** Recomendação: não. Fica como módulo para depois do piloto.
5. **Jurídico:** a base legal para tratar biometria (se houver a opção C) e o texto do termo (RNF-LGPD-01).

## Fontes

- [Roteiro de integração do Login Único](https://acesso.gov.br/roteiro-tecnico/), [passo a passo](https://acesso.gov.br/roteiro-tecnico/iniciarintegracao.html) e [solicitação de credencial](https://acesso.gov.br/roteiro-tecnico/solicitacaocredencialprocesso.html)
- [e-SUS APS: Login gov.br (pedido pelo CNPJ do município)](https://sisaps.saude.gov.br/sistemas/esusaps/docs/manual/APOIO/Login_GOV.BR/)
- [Níveis bronze, prata e ouro (Canaltech)](https://canaltech.com.br/governo/o-que-sao-os-niveis-prata-e-ouro-no-govbr-211774/)
- [Serpro: nova versão do Datavalid (cobrança por validação)](https://serpro.gov.br/menu/noticias/noticias-2024/nova-versao-do-datavalid); preço de 2022 via [Tecnoblog](https://tecnoblog.net/noticias/mpdft-acusa-serpro-usar-dados-cnh-sem-autorizacao/)
- [Unico: fluxo de biometria](https://developers.unico.io/en/docs/IDunico/Integracao/fluxoBiometria), [CAF](https://www.biometricupdate.com/companies/caf)

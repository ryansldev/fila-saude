# Discovery: encaminhamento e regulação (D6)

2026-11-10 · status: **MVP decidido** (AD-026): dois modos por serviço, **requisição pelo app** (paciente marca de casa com a foto do papel) e **regulado pela central** (agendador lança os pacientes que a regulação mandou, nível 1); integração com a regulação (nível 2 ou 3) depois do piloto, se a secretaria topar. Falta confirmar com a secretaria do piloto (junto com a visita do D4) e obter a especificação da API no DATASUS.

## Problema

O MVP assume que o paciente manda a foto do encaminhamento e o **agendador da unidade** aceita e aloca numa sessão privada (RN-ENC, RN-AL). Em muitos municípios, porém, a consulta com especialista é marcada pela **central de regulação**, não pela unidade: a UBS insere a solicitação num sistema de regulação e o regulador escolhe data e local. Se o piloto funcionar assim, o fluxo "foto + agendador aceita" não existe para especialidades, e o ideal seria o Fila Saúde conversar com o sistema de regulação.

Nem todo município é assim: em muitos, o paciente sai da UBS com um papel de requisição e precisa ir a algum lugar marcar. Para esse caso, o fluxo original (foto pelo app, agendador confere) deixa o paciente marcar de casa. Por isso o MVP tem os dois modos (AD-026).

## O que a pesquisa de mesa achou

- **Dois sistemas federais, gratuitos:** SISREG III e **e-SUS Regulação** (DATASUS). O SISREG **não aceita novas centrais** e está sendo substituído pelo e-SUS Regulação, que hoje cobre o módulo ambulatorial (consultas e exames). Para um produto novo, o alvo provável é o e-SUS Regulação.
- **API do SISREG:** existe, mas o acesso é **restrito às secretarias de saúde**, por causa da sensibilidade dos dados. Um fornecedor só usa por meio da secretaria.
- **API do DATASUS em geral:** pedida no Portal de Serviços do DATASUS por um gestor vinculado ao CNES, informando o sistema solicitante e os IPs públicos; passa por homologação antes da produção. Não achamos a especificação técnica pública da API do e-SUS Regulação.
- **Sistemas próprios:** capitais e estados usam sistemas próprios (ex.: Gercon em Porto Alegre, CROSS em São Paulo). Cada um seria uma integração diferente.
- **Quem solicita:** a APS (médico, e em alguns municípios o enfermeiro) insere a solicitação na regulação. A unidade especializada recebe o paciente já regulado.
- **RNDS:** o e-SUS Regulação e o SISREG já interoperam com a RNDS. A RNDS pode ser um caminho indireto, a investigar.

## Níveis possíveis de integração

| Nível | O que o Fila Saúde faz | Depende de |
| --- | --- | --- |
| 0. Nenhuma | Serviço regulado não usa lista de espera do app; o app só orienta "seu encaminhamento vai para a regulação" | Nada |
| 1. Manual | Quando a regulação marca, a unidade (ou o paciente) registra data e local no app; o paciente recebe lembretes e entra na fila do dia normalmente | Nada externo; um passo manual |
| 2. Leitura | O Fila Saúde consulta a regulação para trazer a marcação automaticamente | API liberada pela secretaria e homologada no DATASUS |
| 3. Ida e volta | Além de ler, o app envia a solicitação ou devolve presença e falta | Idem, com escrita; mais homologação e responsabilidade |

Decisão (AD-026): o modo "regulado pela central" do MVP é o nível 1; o nível 2 é o candidato depois do piloto, se a secretaria liberar. Serviços que o município marca a partir do papel usam a requisição pelo app.

## Perguntas para fechar

1. No município do piloto, quais serviços são **regulados** (central) e quais são marcados a partir do papel de requisição (secretaria ou unidade)? Qual a validade da requisição e quem a confere?
2. Que sistema a central usa: SISREG, e-SUS Regulação ou próprio? Há plano de migrar?
3. A secretaria aceitaria pedir acesso à API para o Fila Saúde? Em que termos (convênio, contrato)?
4. A especificação técnica da API do e-SUS Regulação: obter pelo Portal de Serviços do DATASUS. Leitura e escrita? Autenticação? Ambiente de homologação?
5. Como o paciente fica sabendo hoje da marcação regulada (ligação, SMS, papel na UBS)? É aí que o nível 1 ajuda.
6. A presença e a falta em consulta regulada precisam voltar para a regulação?
7. Na mesma conversa com o DATASUS: dá para consultar o **CADSUS** pelo CPF ou Cartão SUS (nome, nascimento) e reduzir a digitação no pré-cadastro e no balcão? Com que credencial? Fica como melhoria depois do piloto.

## Fontes

- [Ministério da Saúde: sistemas de informação na regulação do acesso](https://www.gov.br/saude/pt-br/composicao/saes/drac/regulacao/regulacao-do-acesso/sistemas-de-informacao)
- [WEB Atendimento SUS: FAQ SISREG (API restrita; SISREG não aceita novas centrais)](https://webatendimento.saude.gov.br/faq/sisreg)
- [CONASEMS: sistemas de informação para a regulação assistencial (PMAE)](https://portal.conasems.org.br/orientacoes-tecnicas/noticias/6362_conasems-em-foco-saude-digital-orientacoes-sobre-sistemas-de-informacao-para-a-regulacao-assistencial-no-contexto-do-pmae)
- [CONASS: apresentação do e-SUS Regulação na CIT (2024)](https://conass.org.br/wp-content/uploads/2024/08/2.1-08.28.24-VF-PPT-CIT-e-SUS-Regulacao.pdf)
- [COSEMS-SC: Manual do e-SUS Regulação v1.0](https://cosemssc.org.br/wp-content/uploads/2024/09/Manual-do-e-SUS-Regulacao-V1.0.pdf)
- [COSEMS-SC: credenciais de acesso no Portal de Serviços do DATASUS](https://cosemssc.org.br/wp-content/uploads/2024/08/Treinamento-Portal-de-Servicos-Solicitacoes-de-Credenciais-de-acesso-2024-SUS_Digi.pdf)
- [SciELO: regulação ambulatorial municipal no Rio de Janeiro](https://www.scielosp.org/article/csc/2017.v22n4/1257-1267/)
- [Manual de regulação ambulatorial (SUBPAV-RJ, 2022)](https://subpav.org/aps/uploads/publico/repositorio/Livro_ManualDeRegucacao_Final.pdf)

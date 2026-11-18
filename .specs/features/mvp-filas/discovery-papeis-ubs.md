# Discovery: quem trabalha na UBS e quem administra (2026-11-12)

Pergunta: os perfis do painel (`gestor`, `admin`, `agendador`, `recepcao`, `triagem`, `profissional`) não batem com a realidade. "Profissional" é ambíguo e "triagem" não é cargo. Quem é quem numa UBS e quem administra a rede?

Fontes no fim. Pesquisa de mesa: falta validar com a UBS do piloto (D4).

## 1. Quem administra

- **Prefeitura → Secretaria Municipal de Saúde (SMS).** O secretário é o gestor municipal do SUS. Cada município define a estrutura da SMS por decreto ou regimento; não há um modelo nacional.
- Dentro da SMS aparecem quase sempre:
  - **Coordenação (ou diretoria) de Atenção Primária**, que cuida das UBS.
  - **Central de regulação**, que agenda consultas e exames especializados, em geral pelo SISREG. Uma vaga regulada não é decidida pela UBS.
  - **Setor de CNES e informação**, que mantém o cadastro dos estabelecimentos e dos profissionais.
- Em alguns municípios uma **Organização Social (OSS)** gere as UBS por contrato. A SMS continua dona da rede.

## 2. Quem trabalha na UBS

| Grupo | Quem | Observação |
| --- | --- | --- |
| Gestão da unidade | **Gerente da UBS** | PNAB 2017: preferencialmente de nível superior, **não integra as equipes**, 40 h, atua com todas as equipes da unidade |
| Equipe de Saúde da Família / Atenção Primária (eSF/eAP) | Médico(a), enfermeiro(a), técnico(a) ou auxiliar de enfermagem, agente comunitário de saúde (ACS); às vezes agente de combate às endemias (ACE) | Núcleo da UBS |
| Saúde bucal (eSB) | Cirurgião(ã)-dentista, técnico(a) ou auxiliar em saúde bucal | |
| Multiprofissional (eMulti, Portaria 635/2023) | Psicólogo(a), fisioterapeuta, nutricionista, assistente social, farmacêutico(a) e outros | Apoia várias equipes |
| Apoio | Recepção / auxiliar administrativo, farmácia (farmacêutico e auxiliar), serviços gerais | A recepção costuma também agendar |

## 3. Como o atendimento de fato flui

1. **Recepção:** identifica a pessoa, localiza o prontuário e agenda.
2. **Acolhimento / escuta qualificada:** feito pelo técnico de enfermagem ou pelo enfermeiro, que aferem sinais vitais (a "pré-consulta").
3. **Classificação de risco:** **ato privativo do enfermeiro** (Resolução Cofen 661/2021). O técnico participa do acolhimento, mas **não classifica risco** (Parecer Cofen 39/2025). A norma pede capacitação no protocolo e cerca de 4 min por classificação.
4. **Consulta:** com médico, enfermeiro, dentista ou profissional da eMulti.

**"Triagem" não é um cargo: é uma etapa.** Quem a faz no SUS é o enfermeiro.

## 4. O CNES já diz quem é o quê, onde

Cada profissional é vinculado ao estabelecimento (código CNES de 7 dígitos) por **CBO**, ou seja, pela ocupação, com carga horária. Um profissional pode ter até 5 CBOs. A produção do SUS é recusada quando o CBO não está no CNES. É a fonte oficial de "o papel direto da pessoa na unidade".

## 5. O que isso muda no Fila Saúde (proposta)

Separar três coisas que hoje estão misturadas nos "perfis":

1. **Ocupação na unidade** (o que a pessoa é, alinhada ao CBO): médico(a), enfermeiro(a), técnico(a) de enfermagem, cirurgião(ã)-dentista, ACS, recepção / auxiliar administrativo, profissional da eMulti (com a especialidade) etc.
2. **Função de gestão** (o que a pessoa administra), que não é ocupação:
   - **Gestão municipal (SMS):** cria unidades, regras e gerentes; vê relatórios.
   - **Regulação (SMS):** lança pacientes de serviço regulado.
   - **Gerente da UBS:** configura serviços, sessões e estações e cadastra a equipe da própria unidade.
3. **Permissões** derivadas da ocupação e da função (a matriz), mais a estação que a pessoa opera no dia.

Como os perfis atuais mapeiam:

| Hoje | Proposta |
| --- | --- |
| `gestor` | Gestão municipal (SMS) |
| `admin` | Gerente da UBS |
| `agendador` | Recepção/administrativo (aloca da lista de espera) e **Regulação (SMS)** para o regulado; a decidir |
| `recepcao` | Recepção / auxiliar administrativo |
| `triagem` | Some. Classificar risco e chamar na estação de triagem: **enfermeiro**. O técnico de enfermagem faz o acolhimento sem classificar |
| `profissional` | A ocupação de quem atende: médico, enfermeiro, dentista, eMulti |

**RBAC na criação de usuário:** quem cadastra quem também passa pela matriz. A SMS cria gerentes e qualquer pessoa. O gerente cadastra só a equipe da própria unidade e não concede função de gestão. Ninguém concede uma permissão que não tem.

## 6. Perguntas para o piloto (D4)

- Quem aloca pacientes da lista de espera na UBS: a recepção, a enfermagem ou o gerente?
- A UBS usa um protocolo de classificação de risco (Manchester ou um protocolo próprio da APS)? Há técnico fazendo acolhimento antes do enfermeiro?
- O município tem OSS? Quem cadastra usuários: a SMS centralmente ou o gerente?
- O setor de CNES consegue exportar os vínculos (CPF, CBO, estabelecimento)? Isso permitiria importar a equipe em vez de digitar.

## Fontes

- PNAB 2017, Portaria GM/MS 2.436/2017: [texto (Campinas)](https://saude.campinas.sp.gov.br/saude/lista_legislacoes/legis_2017/U_PT-MS-GM-2436_210917.pdf); gerente de AB: [FAQ Gerentes de UBS (COSEMS-SC)](https://www.cosemssc.org.br/wp-content/uploads/2023/08/FAQ-Gerentes-de-UBS.pdf), [Rev. Panam. Salud Pública 2018](https://scielosp.org/pdf/rpsp/2018.v42/e175/pt)
- Classificação de risco: [Resolução Cofen 661/2021](https://www.legisweb.com.br/legislacao/?id=410743), [Parecer Cofen 39/2025](https://www.cofen.gov.br/wp-content/uploads/2025/11/Parecer-no-39-2025-CAMARAS-TECNICAS-DE-ENFERMAGEM.pdf)
- eMulti: [Portaria GM/MS 635/2023](https://ses.sp.bvs.br/wp-content/uploads/2023/05/U_PT-MS-GM-635_220523.pdf), [Equipes da APS (SESA-PR)](https://www.saude.pr.gov.br/Pagina/Equipes-da-APS)
- CNES e CBO: [Instrução CNES (Rio)](https://rio.rj.gov.br/dlstatic/10112/12398583/4323905/2021InstrSimp.pdf), [ficha de vinculação (Curitiba)](https://saude.curitiba.pr.gov.br/images/Ficha%20para%20vinculação%20do%20profissional%20a%20um%20estabelecimento.docx), [CFM sobre o CNES](https://portal.cfm.org.br/noticias/nova-ferramenta-possibilita-que-profissionais-de-saude-se-regularizem-junto-ao-cnes/)
- Fluxo na UBS: [POP da Atenção Básica (Aparecida de Goiânia)](https://saude.aparecida.go.gov.br/wp-content/uploads/sites/6/2023/08/POP-ATENCAO-BASICA-.pdf), [POP da recepção (São José dos Campos)](https://sjc.sp.gov.br/transicao/SS/ANEXO%203%20-%20DAS%20-%20DIRETORA%20ALCIONE/DAS%20-%20TRANSI%C3%87%C3%83O/Apresenta%C3%A7%C3%A3o/arquivos/POP%20RECEP%C3%87%C3%83O%20versao1.docx.pdf)
- Estrutura da SMS e regulação: [SMS São Paulo](https://prefeitura.sp.gov.br/web/saude/w/organizacao/quem_e_quem/222383), [Central de Regulação de Caçapava do Sul](https://www.cacapavadosul.rs.gov.br/uploads/edital/21054/5952.pdf), [SISREG III (MS)](https://www.gov.br/saude/pt-br/acesso-a-informacao/gestao-do-sus/programacao-regulacao-controle-e-financiamento-da-mac/publicacoes/sisregiii-geral-2018.pdf)

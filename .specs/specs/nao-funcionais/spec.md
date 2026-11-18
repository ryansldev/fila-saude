# Requisitos não funcionais

A prefeitura é a **dona dos dados (controladora)** e a empresa é a **operadora**. Sintomas, documentos e localização são tratados como dados sensíveis.

## Dados

| Camada | Dono | O que guarda |
| --- | --- | --- |
| Central | Empresa | Catálogo de municípios e unidades (endereço, serviços, sessões públicas), identidade mínima do paciente (CPF, hash da senha, e-mail, telefone, consentimentos, nível de confiança), roteamento para o município |
| Municipal | Prefeitura | Listas de espera, questionários, requisições, cadastros e fotos de documentos, pessoas locais, filas, faltas, eventos de fila, logs de acesso e auditoria |

- **RNF-DADOS-01:** cada município tem um banco **isolado**. O mesmo software roda na nuvem da empresa (conta separada) ou na infraestrutura da prefeitura.
- **RNF-DADOS-02:** a camada central nunca recebe sintomas, documentos ou dados de fila (INV-11).
- **RNF-DADOS-03:** a prefeitura pode exportar todos os seus dados a qualquer momento. Dados armazenados no Brasil.

## LGPD (validar com o jurídico, D5)

- **RNF-LGPD-01:** a base legal provável é execução de política pública e tutela da saúde, e não só consentimento. O termo do app deve refletir isso.
- **RNF-LGPD-02:** Relatório de Impacto à Proteção de Dados (RIPD) antes da primeira implantação.
- **RNF-LGPD-03:** fotos de documentos ficam criptografadas, acessíveis só aos perfis autorizados, e **cada visualização é registrada**.
- **RNF-LGPD-04:** retenção das fotos enquanto o cadastro estiver ativo; prazo de exclusão após inatividade a definir no D5.
- **RNF-LGPD-05:** minimização: o questionário guarda respostas estruturadas, sem texto livre.
- **RNF-LGPD-06:** o paciente pode ver, corrigir e pedir exclusão dos seus dados pelo app, respeitadas as obrigações legais da prefeitura.

## Segurança

- **RNF-SEG-01:** QR de entrada assinado, com validade curta e uso vinculado à conta.
- **RNF-SEG-02:** token da TV revogável; token da estação vinculado ao usuário logado.
- **RNF-SEG-03:** limite de tentativas no login e nas APIs públicas.
- **RNF-SEG-04:** auditoria de toda ação do painel (quem, o quê, quando; motivo, quando exigido).

## Desempenho e confiabilidade

- **RNF-DES-01:** do clique em Chamar próximo até a senha aparecer na TV e o push sair: meta de até 3 s.
- **RNF-DES-02:** TV e app reconectam sozinhos após queda de internet e recuperam o estado atual.
- **RNF-DES-03:** o app funciona em redes lentas e celulares de entrada.

## Acessibilidade e inclusão

- **RNF-ACE-01:** app com textos simples, fonte ajustável, contraste adequado e compatível com leitores de tela.
- **RNF-ACE-02:** todo fluxo do paciente tem equivalente pela recepção para quem não tem app.

## Métricas

- **RNF-MET-01:** os eventos de fila (check-in, "Vou sair", chamada, atendido, pulo, falta) são gravados com horário, sem dado clínico, e o gestor exporta em CSV, por sessão: espera dentro da unidade, % de pacientes pelo app e faltas. Sem dashboard no MVP.
  *Decisões: AD-029, AD-042.*

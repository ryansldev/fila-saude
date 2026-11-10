# Protótipo verification

Verifier independente, 3 rodadas. Todos os findings fechados; proofs atuais em `proofs.md` (46 pass).

| Rodada | Findings | Fix |
| --- | --- | --- |
| 1 (0a2c9df) | Recusa re-sugeria quem recusou; testes fracos em C1, C3, C5, C6, C7, C15; vagas contadas diferente por caminho (C19); texto ETA fora do AC (C10) | 76c1375, fbccee6 |
| 2 (db2e302) | "Vou sair" + volta criava ciclo de bloqueio e travava (C34); C31 não testava ordem de chamada; Build sem `scenarios.js` | d317af0 |
| 3–4 (1108c9b) | Triado que sai perdia a vez por número → AD-010 (C44); presente não-triado sem previsão da consulta (C38); testes fracos C37, C38, C42, C43; roteiro completava passos fora de ordem e TV re-anunciava sem chamada nova (C39); vagas inválidas aceitas (C40); fechar estação com chamado desabilitava "Não compareceu" (C45) | 662499b |

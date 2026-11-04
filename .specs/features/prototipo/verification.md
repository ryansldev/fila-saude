# Protótipo de validação verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 0a2c9df
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `engine.test.js` `classify: alarm sign is emergency` | partly - each alarm alone and "nenhum" are covered; a Tela 1 with autolesão plus another alarm is never tried (checking autolesão first passes every test) |
| C2 | `engine.test.js` `classify: self-harm is urgent with support` | yes |
| C3 | `engine.test.js` `classify: urgent, attention and routine rules` | partly - ages 1, 59 and 60 are tried but age 2 is not, so `age <= 2` passes every test |
| C4 | `engine.test.js` `waitlist: one active entry per service` | yes |
| C5 | `engine.test.js` `waitlist: referral gates allocation` | partly - the rejection notice is asserted but the acceptance notice (AC 6) is not (removing it passes); the blocked allocation asserts only `ok: false`, not `nao_alocavel` |
| C6 | `engine.test.js` `allocation: suggestion order and reasons` | partly - holds the five tiers, but 80+ vs 60-79 is never compared (giving 80+ rank 1 passes) and the faltas alert is tried on one case only (threshold `>= 1` and no 90-day window both pass) |
| C7 | `engine.test.js` `allocation: never exceeds slots` | partly - the slot limit holds; the conflict uses a made-up `version - 1`, so an `allocate` that never bumps `s.version` (the real "outro agendador" flow, AC 4) passes every test |
| C8 | `engine.test.js` `allocation: refusal keeps original date` | no - one waiting entry only; it asserts that the refused entry itself is the top suggestion, so it cannot tell "sugerir o próximo" from re-suggesting the person who just refused |
| C9 | `engine.test.js` `queue: open numbers by original date` | yes |
| C10 | `engine.test.js` `queue: eta and position` | yes |
| C11 | `engine.test.js` `queue: qr current and previous only` | yes |
| C12 | `engine.test.js` `order: RN-ORD-01 protected window` | yes |
| C13 | `engine.test.js` `order: RN-ORD-03 consecutive check-ins` | yes |
| C14 | `engine.test.js` `order: RN-ORD-04 late arrival` | yes - the order alone would also hold through the K=1 window, but the asserted number 4 pins the atraso rule |
| C15 | `engine.test.js` `order: confirmed urgency jumps window` | yes - "venha agora" being only for a remote patient is not asserted (sending it to a present patient passes too) |
| C16 | `engine.test.js` `call: next closes previous and skips remote` | yes |
| C17 | `engine.test.js` `call: three skips` | yes |
| C18 | `engine.test.js` `queue: leave home notice once` | yes - exactly 30 min is covered (`<` fails it) |
| C19 | `engine.test.js` `queue: front desk entry is present` | yes |
| C20 | `engine.test.js` `quiz: none option is exclusive` | yes |
| C21 | `engine.test.js` `agenda: unit shows future sessions with remaining slots` | yes |
| C22 | `engine.test.js` `tv: pairing shows only code until paired and after revoke` | yes |
| C23 | `engine.test.js` `tv: shows only tickets and counters, never names` | yes |
| C24 | `engine.test.js` `privacy: patient view holds only own data` | yes |
| C25 | `engine.test.js` `calllist: pending allocation highlighted after 24 h` | yes - 24 h boundary covered both sides |
| C26 | `engine.test.js` `clock: advancing re-evaluates tolerance` | yes - 4 min / 5 min boundary (`>` fails it) |
| C27 | walk (no automated test) | walk only - `index.html` plus the `.stage` grid `372px minmax(420px,1fr) 380px` (break at `width < 1280px`) and `SCENARIOS` in `app.js` (setup + steps per scenario) plausibly implement it |
| C28 | walk (no automated test) | walk only - `tvHTML` queues announcements, highlights each for `TV_HIGHLIGHT = 10000` ms of real time and calls `beep()` (Web Audio, enabled by "Iniciar painel"), then moves it to "últimas chamadas"; plausible, with no test |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| A refusal re-suggests the patient who just refused as "o próximo" for the same session (PROTO-03 AC 7). Because `allocate` confirms the level, a refused urgente sugerido comes back as "urgente confirmado" at the top, and the Agendador pre-selects them again | scratch `exp2.js`: slots 2, allocate Carlos (novo forte) and Helena, refuse Carlos, and `refuseAllocation(...).next` is Carlos; refuse Helena and next is Carlos again. `app.js` `call-refuse` shows "Próximo sugerido: Carlos" and `agendadorHTML` pre-selects `sug.slice(0, free)`. The walk refused only Ivo, who ranks last | Leave out of `suggest`/`next` for that session the entries that refused it (keeping the original date); make C8 use two or more waiting entries and assert that `next` is a different patient || 76c1375 - C8 |
| C7 does not prove the "outro agendador" conflict: `allocate` could stop bumping `s.version` and every test still passes | Mutation: removing `s.version++` from `allocate` leaves 26/26 green; the test passes `version - 1` instead of reading the version before another allocation | Read the version, allocate through a second caller with that same version, then assert that the first caller gets `conflito` || 76c1375 - C7 |
| Age boundary 2 of the Atenção rule is not tested | Mutation `age < 2` to `age <= 2` leaves 26/26 green; C3 tries ages 1, 59 and 60 only | Assert that novo leve at age 2 is `rotina` (and age 1 is `atencao`) || 76c1375 - C3 |
| "First rule that matches" on Tela 1 is not tested with autolesão plus another alarm | Mutation that checks autolesão before the other alarms leaves 26/26 green; the code is right today (scratch `exp.js`: `["autolesao","dor_peito"]` gives `emergencia`) | Add `classify({alarms:["autolesao","dor_peito"]})` gives `emergencia` to C1 || 76c1375 - C1 |
| Legal priority 80+ before 60-79 (8.3 step 3, RN-RISCO-04) is not tested | Mutation giving 80+ `rank: 1` leaves 26/26 green; C6 compares Dora (82) only against patients with no priority | Add to C6 a 79-year-old and an 80-year-old with the same risk, with the 80-year-old entered later, and assert that the 80-year-old comes first || 76c1375 - C6 |
| The faltas alert threshold and window are not tested | Mutations `>= 2` to `>= 1` and dropping the 90-day filter both leave 26/26 green | Assert no alert with 1 falta, or with 2 when one is older than 90 days || 76c1375 - C6 |
| The referral acceptance notice is not tested (PROTO-02 AC 6, "aceita ou rejeita ... o paciente SHALL ver o aviso") | Mutation removing the `notify` in `acceptReferral` leaves 26/26 green; C5 asserts only the rejection notice | Assert a notification for the patient after `acceptReferral`, and assert `error === "nao_alocavel"` on the blocked allocation || 76c1375, fbccee6 - C5 |
| Slot counting differs by path: a served front-desk patient keeps occupying a slot, but a served list patient frees one (entry goes to `concluida`) | scratch `exp2.js`: slots 2, 1 list + 1 desk; desk served, occupied stays 2; list patient served, occupied drops to 1, so the desk can add another. `occupied` counts desk `q.status !== "saiu"` but list only `alocada/confirmada/na_fila` | Pick one meaning of "vagas" (INV-02 non-final, or total capacity), apply it to both paths, and test it in C19 || 76c1375 - C19 |
| Browser rule with no test: the ETA text deviates from AC 2 for position 1 | `app.js` `etaText`: `position === 1` gives "você é o próximo" with no "~X min", also for a remote patient who cannot be called yet; AC 2 fixes "você é o Nº · ~X min" | Move the text into the engine (or a pure helper) and test it, or align it with AC 2 || 76c1375 - C10 |
| "Venha agora" for remote only is not pinned | Mutation notifying on every urgent confirmation (present too) leaves 26/26 green | In C15, confirm urgency for a present patient and assert that no "Venha agora" is sent || 76c1375 - C15 |

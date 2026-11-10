# prototipo proofs

**HEAD**: e9afbba
**Tree**: clean
**Shell**: /bin/sh
**Result**: 46 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run engine / ✔ classify: alarm sign is emergency` | pass |
| C2 | `run engine / ✔ classify: self-harm is urgent with support` | pass |
| C3 | `run engine / ✔ classify: urgent, attention and routine rules` | pass |
| C4 | `run engine / ✔ waitlist: one active entry per service` | pass |
| C5 | `run engine / ✔ waitlist: referral gates allocation` | pass |
| C6 | `run engine / ✔ allocation: suggestion order and reasons` | pass |
| C7 | `run engine / ✔ allocation: never exceeds slots` | pass |
| C8 | `run engine / ✔ allocation: refusal keeps original date` | pass |
| C9 | `run engine / ✔ queue: open numbers by original date` | pass |
| C10 | `run engine / ✔ queue: eta and position` | pass |
| C11 | `run engine / ✔ queue: qr current and previous only` | pass |
| C12 | `run engine / ✔ order: RN-ORD-01 protected window` | pass |
| C13 | `run engine / ✔ order: RN-ORD-03 consecutive check-ins` | pass |
| C14 | `run engine / ✔ order: RN-ORD-04 late arrival` | pass |
| C15 | `run engine / ✔ order: confirmed urgency jumps window` | pass |
| C16 | `run engine / ✔ call: next closes previous and skips remote` | pass |
| C17 | `run engine / ✔ call: three skips` | pass |
| C18 | `run engine / ✔ queue: leave home notice once` | pass |
| C19 | `run engine / ✔ queue: front desk entry is present` | pass |
| C20 | `run engine / ✔ quiz: none option is exclusive` | pass |
| C21 | `run engine / ✔ agenda: unit shows future sessions with remaining slots` | pass |
| C22 | `run engine / ✔ tv: pairing shows only code until paired and after revoke` | pass |
| C23 | `run engine / ✔ tv: shows only tickets and counters, never names` | pass |
| C24 | `run engine / ✔ privacy: patient view holds only own data` | pass |
| C25 | `run engine / ✔ calllist: pending allocation highlighted after 24 h` | pass |
| C26 | `run engine / ✔ clock: advancing re-evaluates tolerance` | pass |
| C27 | `walk` | pass (Walked) |
| C28 | `walk` | pass (Walked) |
| C29 | `run engine / ✔ eta: present patient sees real call order` | pass |
| C30 | `run engine / ✔ eta: remote first sees come now` | pass |
| C31 | `run engine / ✔ priority: municipal rule switches legal before risk` | pass |
| C32 | `walk` | pass (Walked) |
| C34 | `run engine / ✔ order: leaving and coming back never deadlocks` | pass |
| C35 | `run engine / ✔ call: tolerance never skips on its own` | pass |
| C36 | `run engine / ✔ triage: admin enables triage and creates a station` | pass |
| C37 | `run engine / ✔ triage: two stages with the same ticket` | pass |
| C38 | `run engine / ✔ triage: eta sums both stages` | pass |
| C39 | `walk` | pass (Walked) |
| C40 | `run engine / ✔ flow: admin creates a public or private session` | pass |
| C41 | `run engine / ✔ triage: leave home notice per stage` | pass |
| C42 | `run engine / ✔ presence: time at the unit is tracked` | pass |
| C43 | `run engine / ✔ simulate: others move, protagonist acts alone` | pass |
| C44 | `run engine / ✔ order: coming back loses the turn only if it passed in the order` | pass |
| C45 | `run engine / ✔ station: cannot close while someone is called` | pass |
| C33 | `! grep -rnE "animation/transition/@keyframes" prototype/css` | pass |
| Build | `node --check prototype/js/engine.js && node --check prototype/js/scenarios.js && node --check prototype/js/app` | pass |

## Output

`Run engine` - exit 0

```
✔ triage: eta sums both stages (0.378828ms)
✔ flow: admin creates a public or private session (0.236379ms)
✔ triage: leave home notice per stage (0.470787ms)
✔ presence: time at the unit is tracked (0.236499ms)
✔ simulate: others move, protagonist acts alone (0.866125ms)
✔ order: coming back loses the turn only if it passed in the order (0.175259ms)
✔ station: cannot close while someone is called (0.13712ms)
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 82.015428
```

`! grep -rnE "animation/transition/@keyframes" prototype/css` - exit 0

```
(no output)
```

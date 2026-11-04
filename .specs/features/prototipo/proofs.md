# prototipo proofs

**HEAD**: a3a7a3a
**Tree**: dirty - .agents/.skill-lock.json, .agents/.skill-lock.json.backup, .claude/skills/tlc-spec-driven/.skill-meta.json, .claude/skills/tlc-spec-driven/SKILL.md, .claude/skills/tlc-spec-driven/references/coding-principles.md
**Shell**: /bin/sh
**Result**: 35 pass, 0 fail

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
| C33 | `! grep -rnE "animation/transition/@keyframes" prototype/css` | pass |
| Build | `node --check prototype/js/engine.js && node --check prototype/js/scenarios.js && node --check prototype/js/app` | pass |

## Output

`Run engine` - exit 0

```
✔ privacy: patient view holds only own data (0.294678ms)
✔ calllist: pending allocation highlighted after 24 h (0.190229ms)
✔ clock: advancing re-evaluates tolerance (0.127359ms)
✔ eta: present patient sees real call order (0.248538ms)
✔ eta: remote first sees come now (0.232419ms)
✔ priority: municipal rule switches legal before risk (0.398027ms)
✔ order: leaving and coming back never deadlocks (0.383548ms)
ℹ tests 30
ℹ suites 0
ℹ pass 30
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 73.814395
```

`! grep -rnE "animation/transition/@keyframes" prototype/css` - exit 0

```
(no output)
```

# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - When a record leaves a state, remove every reference other records hold to it in that state.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `queue-rules` · harmful: 0
- features: prototipo
- evidence: verification.md Revision 2 finding 1 (C34) (queue-rules)
- last seen: 2026-11-04T18:49:34Z

### L-002 - Decide precedence and lateness by the real ordering rule, never by a proxy such as the ticket number.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `queue-rules` · harmful: 0
- features: prototipo
- evidence: verification.md Revisions 3 and 4 finding 1 (C44) (queue-rules)
- last seen: 2026-11-04T18:49:34Z

### L-003 - Test a concurrency guard through the real two-writer sequence, not a fabricated stale value.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: prototipo
- evidence: verification.md finding C7 (round 1) (tests)
- last seen: 2026-11-04T18:49:34Z

### L-004 - Test each boundary of a numeric rule on both sides.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: prototipo
- evidence: verification.md finding C3 (round 1) (tests)
- last seen: 2026-11-04T18:49:34Z

### L-005 - Test state accounting on every path that enters and leaves the state.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: prototipo
- evidence: verification.md Revisions 3 and 4 finding 5 (C42) (tests)
- last seen: 2026-11-04T18:49:34Z

### L-006 - A guided step must require the steps before it, or it completes early and strands the flow.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `ui-guide` · harmful: 0
- features: prototipo
- evidence: verification.md Revisions 3 and 4 finding 7 (C39) (ui-guide)
- last seen: 2026-11-04T18:49:34Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_

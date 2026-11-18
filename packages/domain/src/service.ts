// Mudanças de configuração do serviço (RN-ENC-05, RN-ENC-07, RN-TRI-01, AD-038).

import {
  ENTRY_TRANSITIONS,
  type EntryState,
  INACTIVE_ENTRY_STATES,
  type SessionState,
  singleTransition,
  type Transition,
} from "./contracts.ts";
import { failure, ok, type Result } from "./result.ts";

export type ServiceMode = "direct" | "referral" | "regulated";

type ServiceEntry = { id: string; state: EntryState; safeSlot: boolean; sessionOpened: boolean };
type Change = { id: string; for: EntryState; push: boolean };

const INACTIVE = INACTIVE_ENTRY_STATES;

const EVENT_REGULATED = 'Serviço muda para "regulado"';
const EVENT_DIRECT = 'Serviço muda para "livre"';
const SAFE_SLOT_QUALIFIER = "vaga segura";

/** RN-TRI-01: "exige triagem" só muda sem sessão aberta do serviço. */
export function canChangeRequiresTriage(serviceSessions: { state: SessionState }[]): boolean {
  return !serviceSessions.some((s) => s.state === "open");
}

/** RN-ENC-07: entradas que bloqueiam a troca para "regulado" (não finais e não arquivadas). */
export function countActive(entries: { state: EntryState }[]): number {
  return entries.filter((e) => !INACTIVE.includes(e.state)).length;
}

/** A mudança que a linha do contrato manda fazer; `null` se a linha falta ou não muda de estado. */
function rowChange(id: string, row: Transition<EntryState> | null): Change | null {
  if (!row || row.for === "(mesmo)" || row.for === "(não cria)") return null;
  return { id, for: row.for, push: row.effects.includes("Push") };
}

/**
 * Linha do contrato para "Serviço muda para livre" a partir de "aguardando encaminhamento".
 * A linha qualificada "vaga segura" tem a condição "Antes da abertura" (Confirmada, push):
 * vale só com vaga segura e sessão ainda não aberta; senão, a linha sem qualificador.
 */
function rowBecomeFree(e: ServiceEntry): Transition<EntryState> | null {
  const qualified = e.safeSlot && !e.sessionOpened;
  return singleTransition(ENTRY_TRANSITIONS, e.state, EVENT_DIRECT, (t) =>
    qualified ? t.qualifier === SAFE_SLOT_QUALIFIER : t.qualifier === undefined,
  );
}

/**
 * RN-ENC-07 / AD-038: efeitos da troca de modo sobre as entradas do serviço.
 * Não altera as entradas recebidas; devolve as mudanças a aplicar.
 */
export function changeServiceMode(
  de: ServiceMode,
  to: ServiceMode,
  entries: ServiceEntry[],
): Result<{ changes: Change[] }> {
  const changes: Change[] = [];
  if (de === to) return ok({ changes });

  if (to === "regulated") {
    if (countActive(entries) > 0) return failure("regulated_service");
    for (const e of entries) {
      if (e.state !== "archived") continue;
      const change = rowChange(e.id, singleTransition(ENTRY_TRANSITIONS, e.state, EVENT_REGULATED));
      if (!change) return failure("forbidden_transition");
      changes.push(change);
    }
    return ok({ changes });
  }

  if (de === "referral" && to === "direct") {
    for (const e of entries) {
      if (e.state !== "awaiting_referral") continue;
      const change = rowChange(e.id, rowBecomeFree(e));
      if (!change) return failure("forbidden_transition");
      changes.push(change);
    }
  }

  // livre → requisição (AD-038) e saída de "regulado": nada muda.
  return ok({ changes });
}

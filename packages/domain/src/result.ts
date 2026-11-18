export type ErrorCode =
  | "forbidden_transition"
  | "no_slot"
  | "duplicate"
  | "emergency"
  | "regulated_service"
  | "session_closed"
  | "none_eligible"
  | "station_busy"
  | "station_has_call"
  | "no_show_up"
  | "invalid_qr"
  | "referral_pending"
  | "no_permission"
  | "past_deadline"
  | "pending_check";

export type EventKind =
  | "entry_created"
  | "allocated"
  | "confirmed"
  | "refused"
  | "slot_released"
  | "signed_up"
  | "referral_accepted"
  | "in_reserve"
  | "registered"
  | "removed"
  | "ticket_issued"
  | "present"
  | "pending_check"
  | "pending_check_resolved"
  | "not_verified"
  | "priority_removed"
  | "priority_given"
  | "risk_confirmed"
  | "welcomed"
  | "referred_to_emergency"
  | "risk_suggested"
  | "left"
  | "called"
  | "recalled"
  | "showed_up"
  | "attended"
  | "skipped"
  | "left_queue"
  | "no_show"
  | "no_show_voided"
  | "reassigned"
  | "leave_home"
  | "come_now"
  | "scheduler_alert"
  | "call_list"
  | "archived"
  | "still_needs"
  | "reactivated"
  | "cancelled";

export type Event = {
  kind: EventKind;
  entryId?: string;
  itemId?: string;
  stationId?: string;
  sessionId?: string;
  reason?: string;
  data?: Record<string, unknown>;
};

export type Result<E> = { ok: true; state: E; events: Event[] } | { ok: false; error: ErrorCode };

export function ok<E>(state: E, events: Event[] = []): Result<E> {
  return { ok: true, state, events };
}

export function failure(error: ErrorCode): { ok: false; error: ErrorCode } {
  return { ok: false, error };
}

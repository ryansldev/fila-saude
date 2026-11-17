// Configuração de uma sessão (RN-ENC-05, RN-PUB-03, AD-016, AD-038, INV-02).

import type { Stage } from "./queue.ts";
import { failure, ok, type Result } from "./result.ts";
import type { ServiceMode } from "./service.ts";

export type Visibility = "public" | "private";

export type SessionConfig = {
  slots: number | null;
  visibility: Visibility;
  waivesPreRegistration: boolean;
  professional: string | null;
  stations: string[];
};

export type SessionValidation =
  | { ok: true }
  | { ok: false; error: "regulated_service" | "invalid_input"; fields?: Record<string, string> };

/**
 * Valida a configuração da sessão para o serviço. Erros de campo vêm juntos
 * (`invalid_input`); com os campos válidos, serviço regulado só aceita privada.
 */
export function validateSession(
  service: {
    mode: ServiceMode;
    serviceStations: string[];
    /** Com as etapas, exige estação que chame cada etapa do serviço (sem isso ninguém é chamado). */
    requiresTriage?: boolean;
    stages?: Record<string, Stage>;
  },
  c: SessionConfig,
): SessionValidation {
  const fields: Record<string, string> = {};
  if (c.slots !== null && !(Number.isInteger(c.slots) && c.slots >= 1)) {
    fields.slots = "vagas deve ser um inteiro maior ou igual a 1, ou vazio";
  }
  if (c.waivesPreRegistration && c.visibility !== "public") {
    fields.waivesPreRegistration = "a dispensa de pré-cadastro só vale em sessão pública";
  }
  const outside = c.stations.filter((e) => !service.serviceStations.includes(e));
  if (outside.length > 0) {
    fields.stations = "a sessão só pode usar estações que atendem o serviço";
  } else if (new Set(c.stations).size !== c.stations.length) {
    fields.stations = "estação repetida";
  } else if (service.stages) {
    const stages = new Set(c.stations.map((e) => service.stages?.[e]));
    if (!stages.has("care")) fields.stations = "inclua uma estação de atendimento";
    else if (service.requiresTriage && !stages.has("triage"))
      fields.stations = "inclua uma estação de triagem: o serviço exige triagem";
  }
  if (Object.keys(fields).length > 0) return { ok: false, error: "invalid_input", fields };
  if (service.mode === "regulated" && c.visibility === "public") return { ok: false, error: "regulated_service" };
  return { ok: true };
}

/** RN-PUB-03: privada perde a dispensa; pública não é permitida em serviço regulado. */
export function changeVisibility(c: SessionConfig, to: Visibility, mode: ServiceMode): Result<SessionConfig> {
  if (to === "public" && mode === "regulated") return failure("regulated_service");
  if (to === "private") return ok({ ...c, visibility: to, waivesPreRegistration: false });
  return ok({ ...c, visibility: to });
}

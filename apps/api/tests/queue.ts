import type { Answers } from "@fila-saude/domain";
import { signUp } from "infra/queue/sign-up";
import orchestrator from "tests/orchestrator";
import { loggedInUser, municipalityWithUnit, occupation, unitManagerRoles } from "tests/panel";

export const ROUTINE: Answers = { alarms: [], reason: "follow_up", severity: null, conditions: [], groups: [] };

// Município com unidade, admin, enfermeiro, um serviço, duas estações de atendimento e uma sessão pública de hoje.
/** Com `triagem`, o serviço exige triagem e há a estação "Acolhimento" (triagem) além das salas. */
export async function queueScenario(options: { slots?: number; triage?: boolean } = {}) {
  const { slug, manager, unitId } = await municipalityWithUnit();
  const admin = (await loggedInUser(slug, manager, "admin", unitManagerRoles(unitId))).cookie;
  const nurse = (await loggedInUser(slug, manager, "enfermeira", occupation(unitId, "nurse"))).cookie;
  const request = (m: string, c: string, cookie: string, body?: unknown) =>
    orchestrator.panelRequest(slug, m, c, { cookie, ...(body !== undefined ? { body } : {}) });
  const serviceId = (
    await request("POST", `/v1/panel/units/${unitId}/services`, admin, {
      name: "Clínico",
      prefix: "C",
      requiresTriage: options.triage ?? false,
      mode: "direct",
      averageTimeMin: {},
    })
  ).body.id as string;
  const station = async (name: string, stage = "care") =>
    (
      await request("POST", `/v1/panel/units/${unitId}/stations`, admin, {
        name,
        stage,
        services: [serviceId],
      })
    ).body.id as string;
  const e1 = await station("Sala 1");
  const e2 = await station("Sala 2");
  const t1 = options.triage ? await station("Acolhimento", "triage") : null;
  const now = Date.now();
  const s = await request("POST", `/v1/panel/units/${unitId}/sessions`, admin, {
    serviceId,
    // Começou há 1 min: "hoje" no fuso da unidade a qualquer hora (1 h antes falhava depois da meia-noite).
    start: new Date(now - 60_000).toISOString(),
    end: new Date(now + 3 * 3600_000).toISOString(),
    slots: options.slots ?? 20,
    visibility: "public",
    waivesPreRegistration: false,
    professional: null,
    stations: t1 ? [e1, e2, t1] : [e1, e2],
  });
  if (s.status !== 201) throw new Error(`sessão: ${s.status} ${JSON.stringify(s.body)}`);
  return { slug, manager, unitId, admin, nurse, serviceId, e1, e2, t1, sessionId: s.body.id as string, request };
}

// Inscrição de uma pessoa sem conta pela mesma função da rota do app.
export async function signUpPerson(slug: string, sessionId: string, name: string, answers = ROUTINE) {
  return signUp(orchestrator.municipalityDatabase(slug), sessionId, {
    person: { name, birthDate: "1990-05-05", cpf: orchestrator.generateCpf(), patientId: null },
    guardianPatientId: null,
    answers,
    now: Date.now(),
  });
}

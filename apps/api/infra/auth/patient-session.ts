import type { FastifyInstance, FastifyRequest } from "fastify";
import { authCentral } from "infra/auth/central";
import { ApiError } from "infra/errors";

// PD-34: o formato que o verificador do JWT (PD-17) vai devolver.
export type AuthenticatedPatient = { patientId: string; cpf: string; verified: boolean };

declare module "fastify" {
  interface FastifyRequest {
    patient: AuthenticatedPatient | null;
  }
  interface FastifyInstance {
    requirePatient: (req: FastifyRequest) => Promise<void>;
  }
}

export async function sessionPatient(headers: Headers): Promise<AuthenticatedPatient | null> {
  const session = await authCentral.api.getSession({ headers }).catch(() => null);
  if (!session) return null;
  const u = session.user as { id: string; cpf: string; verifiedAt?: Date | null };
  return { patientId: u.id, cpf: u.cpf, verified: Boolean(u.verifiedAt) };
}

function headers(req: FastifyRequest): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) h.append(k, item);
  }
  return h;
}

// PD-33: guard da sessão do paciente da central nas rotas do município.
export function patientPlugin(app: FastifyInstance) {
  app.decorateRequest("patient", null);
  app.decorate("requirePatient", async (req: FastifyRequest) => {
    const p = await sessionPatient(headers(req));
    if (!p) throw new ApiError(401, "not_authenticated");
    req.patient = p;
  });
}

// Depois do `requireTenant` (o hook do plugin do tenant, nas rotas `municipalities/:slug`) e do
// `requirePatient` (no `preValidation` da rota): o tenant e o paciente da requisição.
export function patientOf(req: FastifyRequest) {
  if (!req.tenant || !req.patient) throw new ApiError(401, "not_authenticated");
  return { db: req.tenant.db, patient: req.patient };
}

// Depois de `requirePatient`, nas rotas da central (sem município).
export function requestPatient(req: FastifyRequest): AuthenticatedPatient {
  if (!req.patient) throw new ApiError(401, "not_authenticated");
  return req.patient;
}

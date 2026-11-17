import type { FastifyInstance } from "fastify";
import { authCentral } from "infra/auth/central";
import { buildAuth } from "infra/auth/fastify";

// PD-15 / AD-017: auth do paciente na central, no host raiz e sem tenant (`/v1/auth/*`).
export default async function (app: FastifyInstance) {
  buildAuth(app, "", () => authCentral);
}

import { okSchema } from "@fila-saude/schemas/queue";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requestPatient } from "infra/auth/patient-session";
import database from "infra/database";
import { pushDevice } from "infra/database/central/schema/push";
import { apiErrors, PATIENT, PATIENT_ERRORS, TAGS } from "infra/openapi/schemas";
import z from "zod";

const entry = z.object({ token: z.string().min(10).max(300) });

// T3.8: o app registra o token de push do aparelho na conta (central; vale para todos os municípios).
// O mesmo aparelho logado em outra conta passa a avisar só a conta nova.
export default async function (app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const schema = (summary: string) => ({
    tags: [TAGS.patient],
    summary,
    security: PATIENT,
    body: entry,
    response: { 200: okSchema, ...apiErrors(PATIENT_ERRORS, { 400: ["invalid_input"] }) },
  });

  typed.put(
    "/",
    { preValidation: [app.requirePatient], schema: schema("Registrar o aparelho para avisos") },
    async (req) => {
      const { patientId } = requestPatient(req);
      const { token } = req.body;
      await database
        .insert(pushDevice)
        .values({ patientId, token })
        .onConflictDoUpdate({ target: pushDevice.token, set: { patientId, updatedAt: new Date() } });
      return { ok: true as const };
    },
  );

  // Ao sair da conta, o aparelho deixa de receber os avisos dela (aparelho compartilhado).
  typed.delete(
    "/",
    { preValidation: [app.requirePatient], schema: schema("Parar os avisos neste aparelho") },
    async (req) => {
      const { patientId } = requestPatient(req);
      const { token } = req.body;
      await database.delete(pushDevice).where(and(eq(pushDevice.token, token), eq(pushDevice.patientId, patientId)));
      return { ok: true as const };
    },
  );
}

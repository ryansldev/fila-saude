import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requestPatient } from "infra/auth/patient-session";
import database from "infra/database";
import { pushDevice } from "infra/database/central/schema/push";
import { validate } from "infra/errors";
import z from "zod";

const entry = z.object({ token: z.string().min(10).max(300) });

// T3.8: o app registra o token de push do aparelho na conta (central; vale para todos os municípios).
// O mesmo aparelho logado em outra conta passa a avisar só a conta nova.
export default async function (app: FastifyInstance) {
  app.put("/", { preHandler: [app.requirePatient] }, async (req) => {
    const { patientId } = requestPatient(req);
    const { token } = validate(entry, req.body);
    await database
      .insert(pushDevice)
      .values({ patientId, token })
      .onConflictDoUpdate({ target: pushDevice.token, set: { patientId, updatedAt: new Date() } });
    return { ok: true };
  });

  // Ao sair da conta, o aparelho deixa de receber os avisos dela (aparelho compartilhado).
  app.delete("/", { preHandler: [app.requirePatient] }, async (req) => {
    const { patientId } = requestPatient(req);
    const { token } = validate(entry, req.body);
    await database.delete(pushDevice).where(and(eq(pushDevice.token, token), eq(pushDevice.patientId, patientId)));
    return { ok: true };
  });
}

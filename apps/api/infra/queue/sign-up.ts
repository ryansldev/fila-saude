import { randomUUID } from "node:crypto";
import { type Answers, type Entry, INACTIVE_ENTRY_STATES, signUpPublic } from "@fila-saude/domain";
import { eq } from "drizzle-orm";
import { service } from "infra/database/municipal/schema/service";
import { ApiError } from "infra/errors";
import { inSession, unitConfig } from "./day";
import { attendedPerson, type InformedPerson, insertEntry, personByCpf, serviceActiveEntries } from "./entries";

export type CmdSignUp = {
  person: InformedPerson;
  guardianPatientId: string | null;
  answers: Answers;
  now: number;
  /** RN-ID-07: quantas pessoas a conta responsável inscreve por sessão (o app manda; o balcão não). */
  limitPerAccount?: number;
};

// RN-PUB-01/02 (T3.3): inscrição na sessão pública; aberta → direto na fila; lotada → reserva (S2).
export async function signUp(db: Parameters<typeof inSession>[0], sessionId: string, cmd: CmdSignUp): Promise<Entry> {
  return inSession(db, sessionId, async (c) => {
    if (c.row.state !== "planned" && c.row.state !== "open") throw new ApiError(409, "session_closed");
    // Passou do fim: ninguém mais seria atendido nela, mesmo que ninguém tenha encerrado.
    if (c.row.end.getTime() <= cmd.now)
      throw new ApiError(409, "session_closed", undefined, "Este atendimento já terminou.");
    if (!c.rowService.active) throw new ApiError(404, "not_found");
    // INV-01 / L-003: a trava do serviço (depois da da sessão) põe em fila as inscrições do mesmo serviço
    // em sessões diferentes e na lista de espera; sem ela a mesma pessoa entraria duas vezes.
    await c.tx.select({ id: service.id }).from(service).where(eq(service.id, c.service.id)).for("update");
    const { limitPerAccount: limit, guardianPatientId: guardian } = cmd;
    if (limit !== undefined && guardian !== null) {
      // Contado sob a trava da sessão: dois pedidos ao mesmo tempo não passam juntos do limite.
      const mine = c.entries.filter((e) => e.guardianId === guardian && !INACTIVE_ENTRY_STATES.includes(e.state));
      if (mine.length >= limit)
        throw new ApiError(
          409,
          "limit_per_account",
          undefined,
          `Uma conta inscreve até ${limit} pessoas por atendimento. Para mais, procure a recepção.`,
        );
    }
    await personByCpf(c.tx, cmd.person);
    const r = signUpPublic(
      c.session,
      c.day,
      {
        service: c.service,
        person: { name: cmd.person.name, birthDate: cmd.person.birthDate, cpf: cmd.person.cpf },
        answers: cmd.answers,
        id: randomUUID(),
        activeEntries: await serviceActiveEntries(c.tx, c.service.id),
        guardianId: cmd.guardianPatientId,
        acceptedPhoto: false,
      },
      cmd.now,
      c.day?.config ?? unitConfig(c.rowUnit),
    );
    if (!r.ok) throw new ApiError(409, r.error);
    const { id } = await attendedPerson(c.tx, cmd.person);
    await insertEntry(c.tx, r.state.entry, id, cmd.person.relationship ?? null);
    return { day: r.state.day, session: r.state.session, result: r.state.entry };
  });
}

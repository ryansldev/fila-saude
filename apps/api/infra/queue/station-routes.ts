import {
  commandBodySchema,
  type StationCommand,
  stationCommandSchema,
  stationOperationSchema,
} from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { validate } from "infra/errors";
import { CONFLICT_CODES, idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { commandInStation, OPERATE } from "./station";

const SUMMARY: Record<StationCommand, string> = {
  call: "Chamar o próximo",
  recall: "Chamar de novo",
  finish: "Finalizar o atendimento",
  "no-show": "Não compareceu",
  "showed-up": "Compareceu",
  "undo-showed-up": "Desfazer o compareceu",
};

// Uma rota por comando da estação (T3.7), todas com a mesma casca.
export function commandRoute(command: string) {
  const cmd = validate(stationCommandSchema, command);
  const schema = panelSchema({
    summary: SUMMARY[cmd],
    params: idParams("stationId"),
    // Sem corpo, o Fastify entrega `null`: o comando vale com as opções padrão.
    body: commandBodySchema.nullable(),
    response: { 200: stationOperationSchema },
    // A triagem fecha o chamado com a cor do risco: sem ela, 422 `classify_risk`.
    errors: { 404: ["not_found"], 409: CONFLICT_CODES, 422: ["classify_risk"] },
  });
  return async (app: FastifyInstance) => {
    app
      .withTypeProvider<ZodTypeProvider>()
      .post("/", { config: { action: OPERATE }, schema }, async (req) =>
        commandInStation(await panelContext(req), req.params.stationId, cmd, req.body ?? {}),
      );
  };
}

import { commandBodySchema, stationCommandSchema, stationOperationSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { commandInStation, OPERATE } from "./station";

// Uma rota por comando da estação (T3.7), todas com a mesma casca.
export function commandRoute(command: string) {
  const cmd = validate(stationCommandSchema, command);
  return async (app: FastifyInstance) => {
    app.post("/", { config: { action: OPERATE } }, async (req) =>
      validate(
        stationOperationSchema,
        await commandInStation(
          await panelContext(req),
          pathId(req, "stationId"),
          cmd,
          validate(commandBodySchema, req.body ?? {}),
        ),
      ),
    );
  };
}

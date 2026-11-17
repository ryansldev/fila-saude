import type { FastifyInstance } from "fastify";
import { CONFIGURE, pathId } from "infra/config/common";
import { panelContext } from "infra/panel/action";
import { revokeTv } from "infra/tv/tv";

// RN-TV-01: revogada, a TV volta à tela de pareamento.
export default async function (app: FastifyInstance) {
  app.delete("/", { config: { action: CONFIGURE } }, async (req) =>
    revokeTv(await panelContext(req), pathId(req, "tvId")),
  );
}

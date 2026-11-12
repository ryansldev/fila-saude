import type { FastifyInstance } from "fastify";

// PD-19 / PD-33: rota só de teste do guard do paciente numa rota do município.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.exigirTenant, app.exigirPaciente] }, async (req) => req.paciente);
}

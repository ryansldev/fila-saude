import type { FastifyInstance, FastifyRequest } from "fastify";
import { authCentral } from "infra/auth/central";
import { ErroApi } from "infra/erros";

// PD-34: o formato que o verificador do JWT (PD-17) vai devolver.
export type PacienteAutenticado = { pacienteId: string; cpf: string; verificado: boolean };

declare module "fastify" {
  interface FastifyRequest {
    paciente: PacienteAutenticado | null;
  }
  interface FastifyInstance {
    exigirPaciente: (req: FastifyRequest) => Promise<void>;
  }
}

export async function pacienteDaSessao(headers: Headers): Promise<PacienteAutenticado | null> {
  const sessao = await authCentral.api.getSession({ headers }).catch(() => null);
  if (!sessao) return null;
  const u = sessao.user as { id: string; cpf: string; verificadoEm?: Date | null };
  return { pacienteId: u.id, cpf: u.cpf, verificado: Boolean(u.verificadoEm) };
}

function cabecalhos(req: FastifyRequest): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) h.append(k, item);
  }
  return h;
}

// PD-33: guard da sessão do paciente da central nas rotas do município.
export function pluginDoPaciente(app: FastifyInstance) {
  app.decorateRequest("paciente", null);
  app.decorate("exigirPaciente", async (req: FastifyRequest) => {
    const p = await pacienteDaSessao(cabecalhos(req));
    if (!p) throw new ErroApi(401, "nao_autenticado");
    req.paciente = p;
  });
}

// Depois de `exigirTenant` e `exigirPaciente`: o tenant e o paciente da requisição.
export function doPaciente(req: FastifyRequest) {
  if (!req.tenant || !req.paciente) throw new ErroApi(401, "nao_autenticado");
  return { db: req.tenant.db, paciente: req.paciente };
}

// Depois de `exigirPaciente`, nas rotas da central (sem município).
export function pacienteDaRequisicao(req: FastifyRequest): PacienteAutenticado {
  if (!req.paciente) throw new ErroApi(401, "nao_autenticado");
  return req.paciente;
}

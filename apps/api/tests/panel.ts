import type { Assignments, Occupation, Role } from "@fila-saude/domain";
import orchestrator from "tests/orchestrator";

// Atribuições prontas para os testes (RN-PERF-04).
export const sms = (): Assignments => ({ unitLinks: [], roles: [{ role: "sms_management", unitId: null }] });
export const unitManagerRoles = (unitId: string): Assignments => ({
  unitLinks: [],
  roles: [{ role: "unit_manager", unitId }],
});
export const occupation = (unitId: string, o: Occupation, ...roles: Role[]): Assignments => ({
  unitLinks: [{ unitId, occupation: o }],
  roles: roles.map((role) => ({ role, unitId })),
});

export const UNIT = {
  name: "UBS Centro",
  kind: "ubs",
  address: { postalCode: "01001-000", street: "Praça da Sé", number: "100", complement: null, neighborhood: "Sé" },
  cnes: null,
  lat: -23.5,
  lng: -46.6,
  timeZone: "America/Sao_Paulo",
  time: { "1": [{ opens: "07:00", closes: "17:00" }] },
};

// Município com gestor logado e uma unidade criada pela rota.
export async function municipalityWithUnit() {
  const { slug } = await orchestrator.createMunicipality();
  const manager = await orchestrator.loginManager(slug);
  const r = await orchestrator.panelRequest(slug, "POST", "/v1/panel/units", { cookie: manager, body: UNIT });
  if (r.status !== 201) throw new Error(`unidade: ${r.status} ${JSON.stringify(r.body)}`);
  return { slug, manager, unitId: r.body.id as string };
}

// Usuário criado pelo gestor pela rota e já logado.
export async function loggedInUser(slug: string, manager: string, login: string, assignments: Assignments) {
  const password = "senha-forte-1";
  const r = await orchestrator.panelRequest(slug, "POST", "/v1/panel/users", {
    cookie: manager,
    body: { login, name: login, password, ...assignments },
  });
  if (r.status !== 201) throw new Error(`usuário ${login}: ${r.status} ${JSON.stringify(r.body)}`);
  return { id: r.body.id as string, cookie: await orchestrator.loginStaff(slug, login, password) };
}

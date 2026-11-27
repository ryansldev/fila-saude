import {
  type Answers,
  type Assignments,
  type Entry,
  instantToLocal,
  localToInstant,
  OCCUPATIONS,
  type Occupation,
  ROLES,
  type Role,
} from "@fila-saude/domain";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { authCentral } from "infra/auth/central";
import { createService } from "infra/config/services";
import { createSession } from "infra/config/sessions";
import { createStation } from "infra/config/stations";
import { createUnit } from "infra/config/units";
import { createUser } from "infra/config/users";
import type { Db } from "infra/database";
import { patient } from "infra/database/central/schema/auth";
import { schemaMunicipal, type TenantDb } from "infra/database/tenants";
import env from "infra/env";
import { type ActionContext, runAction, userContext } from "infra/panel/action";
import { panelOrigin } from "infra/panel/origin";
import { type InformedPerson, joinWaitlist } from "infra/queue/entries";
import { allocateSession } from "infra/queue/scheduling";
import { signUp } from "infra/queue/sign-up";
import { createTenant } from "infra/tenant/create";
import { dropTenant } from "infra/tenant/drop";
import { databaseForSlug } from "infra/tenant/slug";
import { Pool } from "pg";

export const EXAMPLE_PASSWORD = "exemplo123";
const TIME_ZONE = "America/Sao_Paulo";

export type ExampleSummary = {
  panel: string;
  users: { id: string; role: string; login: string; password: string }[];
  patients: { name: string; cpf: string; password: string }[];
  sessions: { service: string; visibility: "public" | "private"; localStart: string }[];
};

const PATIENTS = [
  { name: "Ana Souza", cpf: "52998224725", birthDate: "1958-04-02", email: "ana.souza@exemplo.com.br", groups: [] },
  { name: "Bruno Lima", cpf: "11144477735", birthDate: "1992-08-15", email: "bruno.lima@exemplo.com.br", groups: [] },
  {
    name: "Carla Dias",
    cpf: "39053344705",
    birthDate: "1996-01-20",
    email: "carla.dias@exemplo.com.br",
    groups: ["pregnant"],
  },
] as const;

export const EXAMPLE_CPFS = PATIENTS.map((p) => p.cpf);

const answers = (groups: readonly string[]): Answers =>
  ({ alarms: [], reason: "follow_up", severity: null, conditions: [], groups }) as unknown as Answers;

// "Amanhã" = dia seguinte ao de `agora` no fuso da unidade; `dias` à frente, para outras datas.
function tomorrow(now: number, hour: string, days = 1): { instant: number; local: string } {
  const today = instantToLocal(now, TIME_ZONE).slice(0, 10);
  const [a, m, d] = today.split("-").map(Number) as [number, number, number];
  const day = new Date(Date.UTC(a, m - 1, d + days)).toISOString().slice(0, 10);
  const local = `${day}T${hour}`;
  return { instant: localToInstant(local, TIME_ZONE), local };
}

// Hora cheia de `agora` no fuso da unidade (sessão "de agora" da fatia 1).
function fullHour(now: number): { instant: number; local: string } {
  const local = `${instantToLocal(now, TIME_ZONE).slice(0, 13)}:00`;
  return { instant: localToInstant(local, TIME_ZONE), local };
}

// PD-40: cadastro pelo handler real do better-auth central, com o e-mail já confirmado.
async function registerPatient(central: Db, p: (typeof PATIENTS)[number]): Promise<string> {
  const answer = await authCentral.handler(
    new Request(`${env.CENTRAL_URL}/v1/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.CENTRAL_URL },
      body: JSON.stringify({
        cpf: p.cpf,
        name: p.name,
        email: p.email,
        phone: "11987654321",
        birthDate: p.birthDate,
        password: EXAMPLE_PASSWORD,
      }),
    }),
  );
  if (answer.status !== 200) throw new Error(`cadastro de ${p.name}: ${answer.status} ${await answer.text()}`);
  const { user } = (await answer.json()) as { user: { id: string } };
  await central.update(patient).set({ emailVerified: true }).where(eq(patient.id, user.id));
  return user.id;
}

// PD-40 / PD-41: o município de exemplo, cada passo pela função de serviço e por quem faz aquilo no produto
// (a SMS cria a unidade, a regulação e o gerente; o gerente cadastra a equipe e configura a UBS).
export async function seedExample(deps: {
  central: Db;
  template: string;
  now: number;
  slug?: string;
}): Promise<ExampleSummary> {
  const slug = deps.slug ?? "exemplo";
  const { central, template, now } = deps;

  await central.delete(patient).where(inArray(patient.cpf, EXAMPLE_CPFS));
  await dropTenant(slug, { central });
  const { managerId } = await createTenant(
    {
      slug,
      name: "Município Exemplo",
      uf: "SP",
      manager: { login: "gestor", name: "Gestora Exemplo", password: EXAMPLE_PASSWORD },
    },
    { central, template },
  );
  if (!managerId) throw new Error("gestor não criado");

  const pool = new Pool({ connectionString: template.replace("{database}", databaseForSlug(slug)), max: 2 });
  pool.on("error", () => {});
  const db = drizzle(pool, { schema: schemaMunicipal }) as TenantDb;
  try {
    // Como gestor: a unidade e os usuários.
    const asManager = await userContext(db, managerId, now);
    const ubs = await createUnit(asManager, {
      name: "UBS Centro",
      kind: "ubs",
      cnes: null,
      address: {
        postalCode: "01001000",
        street: "Rua das Flores",
        number: "100",
        complement: null,
        neighborhood: "Centro",
      },
      lat: -23.5505,
      lng: -46.6333,
      timeZone: TIME_ZONE,
      time: Object.fromEntries(["1", "2", "3", "4", "5"].map((d) => [d, [{ opens: "07:00", closes: "17:00" }]])),
      config: {},
    });
    // Unidades vizinhas, para o mapa e a lista "perto de você" do app (tela 5); sem sessões.
    const neighbors = [
      {
        name: "UBS Vila Nova",
        kind: "ubs" as const,
        street: "Rua Augusta",
        number: "850",
        neighborhood: "Consolação",
        lat: -23.5531,
        lng: -46.6528,
      },
      {
        name: "UBS Jardim das Flores",
        kind: "ubs" as const,
        street: "Rua Vergueiro",
        number: "1200",
        neighborhood: "Liberdade",
        lat: -23.5647,
        lng: -46.6383,
      },
      {
        name: "Policlínica Sul",
        kind: "polyclinic" as const,
        street: "Avenida Paulista",
        number: "2000",
        neighborhood: "Bela Vista",
        lat: -23.5613,
        lng: -46.6565,
      },
    ];
    for (const v of neighbors) {
      await createUnit(asManager, {
        name: v.name,
        kind: v.kind,
        cnes: null,
        address: {
          postalCode: "01310100",
          street: v.street,
          number: v.number,
          complement: null,
          neighborhood: v.neighborhood,
        },
        lat: v.lat,
        lng: v.lng,
        timeZone: TIME_ZONE,
        time: Object.fromEntries(["1", "2", "3", "4", "5"].map((d) => [d, [{ opens: "07:00", closes: "17:00" }]])),
        config: {},
      });
    }
    const users: ExampleSummary["users"] = [
      { id: managerId, role: ROLES.sms_management.label, login: "gestor", password: EXAMPLE_PASSWORD },
    ];
    const register = async (ctx: ActionContext, login: string, name: string, role: string, a: Assignments) => {
      const u = await createUser(ctx, { login, name, password: EXAMPLE_PASSWORD, ...a });
      users.push({ id: u.id, role, login, password: EXAMPLE_PASSWORD });
      return u.id;
    };
    const only = (role: Role, unitId: string | null): Assignments => ({
      unitLinks: [],
      roles: [{ role, unitId }],
    });
    const occupation = (o: Occupation, ...roles: Role[]): Assignments => ({
      unitLinks: [{ unitId: ubs.id, occupation: o }],
      roles: roles.map((role) => ({ role, unitId: ubs.id })),
    });

    // A SMS cadastra a regulação e o gerente da UBS (RN-PERF-04).
    await register(
      asManager,
      "regulacao",
      "Regulação Exemplo",
      ROLES.sms_regulation.label,
      only("sms_regulation", null),
    );
    const unitManagerId = await register(
      asManager,
      "gerente",
      "Gerente Exemplo",
      ROLES.unit_manager.label,
      only("unit_manager", ubs.id),
    );

    // O gerente cadastra a equipe da própria unidade.
    const asUnitManager = await userContext(db, unitManagerId, now);
    const staff: [string, string, Occupation, Role[]][] = [
      ["recepcao", "Recepção Exemplo", "reception", ["scheduler"]],
      ["enfermeira", "Enfermeira Exemplo", "nurse", []],
      ["tecnica", "Técnica de Enfermagem Exemplo", "nursing_technician", []],
      ["medica", "Médica Exemplo", "physician", []],
      ["dentista", "Dentista Exemplo", "dentist", []],
    ];
    for (const [login, name, o, roles] of staff) {
      const label = [OCCUPATIONS[o].label, ...roles.map((f) => ROLES[f].label)].join(" + ");
      await register(asUnitManager, login, name, label, occupation(o, ...roles));
    }
    const idOf = (login: string) => users.find((u) => u.login === login)?.id as string;

    // Como gerente: serviços, estações e sessões.
    const asAdmin = asUnitManager;
    const general = await createService(asAdmin, ubs.id, {
      name: "Clínico geral",
      prefix: "C",
      requiresTriage: true,
      mode: "direct",
      averageTimeMin: { triage: 5, care: 15 },
    });
    const dental = await createService(asAdmin, ubs.id, {
      name: "Odontologia",
      prefix: "O",
      requiresTriage: false,
      mode: "direct",
      averageTimeMin: { care: 20 },
    });
    const dressings = await createService(asAdmin, ubs.id, {
      name: "Curativos",
      prefix: "V",
      requiresTriage: false,
      mode: "direct",
      averageTimeMin: { care: 10 },
    });
    const triage1 = await createStation(asAdmin, ubs.id, {
      name: "Triagem 1",
      stage: "triage",
      services: [general.id],
    });
    const office1 = await createStation(asAdmin, ubs.id, {
      name: "Consultório 1",
      stage: "care",
      services: [general.id],
    });
    const office2 = await createStation(asAdmin, ubs.id, {
      name: "Consultório 2",
      stage: "care",
      services: [dental.id, general.id],
    });
    const procedures = await createStation(asAdmin, ubs.id, {
      name: "Sala de procedimentos",
      stage: "care",
      services: [dressings.id],
    });
    const morning = { ini: tomorrow(now, "08:00"), end: tomorrow(now, "12:00") };
    // Fatia 1: sessão pública "de agora" (4 h) para abrir no painel e chamar na estação.
    const fromNow = fullHour(now);
    const currentSession = await createSession(asAdmin, ubs.id, {
      serviceId: dressings.id,
      start: new Date(fromNow.instant).toISOString(),
      end: new Date(fromNow.instant + 4 * 3600_000).toISOString(),
      breaks: [],
      slots: 10,
      visibility: "public",
      waivesPreRegistration: false,
      professional: "Enf. Carla",
      stations: [procedures.id],
    });
    // Fatia 3: Clínico geral "de agora" com triagem, para chamar na Triagem 1 e depois no Consultório 1.
    const currentGeneralCare = await createSession(asAdmin, ubs.id, {
      serviceId: general.id,
      start: new Date(fromNow.instant).toISOString(),
      end: new Date(fromNow.instant + 4 * 3600_000).toISOString(),
      breaks: [],
      slots: 10,
      visibility: "public",
      waivesPreRegistration: false,
      professional: "Dra. Helena",
      // Dois consultórios: dá para fechar um e ver a fila seguir no outro (RN-EST-07).
      stations: [triage1.id, office1.id, office2.id],
    });
    const afternoon = { ini: tomorrow(now, "13:00"), end: tomorrow(now, "17:00") };
    // RN-SES-06: Clínico geral de amanhã em duas faixas (08:00 às 12:00 e 13:00 às 17:00), com o almoço no meio.
    await createSession(asAdmin, ubs.id, {
      serviceId: general.id,
      start: new Date(morning.ini.instant).toISOString(),
      end: new Date(afternoon.end.instant).toISOString(),
      breaks: [
        { start: new Date(morning.end.instant).toISOString(), end: new Date(afternoon.ini.instant).toISOString() },
      ],
      slots: 20,
      visibility: "public",
      waivesPreRegistration: false,
      professional: "Dra. Helena",
      stations: [triage1.id, office1.id],
    });
    await createSession(asAdmin, ubs.id, {
      serviceId: dental.id,
      start: new Date(afternoon.ini.instant).toISOString(),
      end: new Date(afternoon.end.instant).toISOString(),
      breaks: [],
      slots: 4,
      visibility: "private",
      waivesPreRegistration: false,
      professional: "Dr. Paulo",
      stations: [office2.id],
    });

    // Fatia 4: outra sessão privada da Odontologia, em 3 dias, para a alocação pendente.
    const after = { ini: tomorrow(now, "13:00", 3), end: tomorrow(now, "17:00", 3) };
    const laterDental = await createSession(asAdmin, ubs.id, {
      serviceId: dental.id,
      start: new Date(after.ini.instant).toISOString(),
      end: new Date(after.end.instant).toISOString(),
      breaks: [],
      slots: 4,
      visibility: "private",
      waivesPreRegistration: false,
      professional: "Dr. Paulo",
      stations: [office2.id],
    });

    // Pacientes: cadastro na central e entrada na lista pelo caminho do app (sem auditoria).
    // Fatia 4: Carla com problema novo forte na Odontologia (urgente sugerido: o alerta do agendador).
    const accounts = new Map<string, string>();
    let brunoInDental = "";
    for (const p of PATIENTS) {
      const patientId = await registerPatient(central, p);
      accounts.set(p.cpf, patientId);
      const person: InformedPerson = { name: p.name, birthDate: p.birthDate, cpf: p.cpf, patientId };
      const r = await joinWaitlist(db, {
        serviceId: dental.id,
        person,
        guardianPatientId: patientId,
        answers: {
          ...answers(p.groups),
          ...(p.cpf === PATIENTS[2].cpf ? { reason: "new", severity: "severe" } : {}),
        } as Answers,
        now,
      });
      if (!r.ok) throw new Error(`entrada de ${p.name}: ${r.error}`);
      if (p.cpf === PATIENTS[1].cpf) brunoInDental = r.state.id;
    }

    // Ana e Bruno se inscrevem na sessão de agora pelo caminho do app (sem auditoria).
    for (const p of PATIENTS.slice(0, 2)) {
      const patientId = accounts.get(p.cpf) as string;
      await signUp(db, currentSession.id, {
        person: { name: p.name, birthDate: p.birthDate, cpf: p.cpf, patientId },
        guardianPatientId: patientId,
        answers: answers(p.groups),
        now,
      });
    }

    // Fatia 3: os três no Clínico de agora, cada um com um risco sugerido (a triagem confirma).
    const complaints: Record<string, Partial<Answers>> = {
      [PATIENTS[0].cpf]: {},
      [PATIENTS[1].cpf]: { reason: "new", severity: "severe" },
      [PATIENTS[2].cpf]: { reason: "new", severity: "mild" },
    };
    for (const p of PATIENTS) {
      const patientId = accounts.get(p.cpf) as string;
      await signUp(db, currentGeneralCare.id, {
        person: { name: p.name, birthDate: p.birthDate, cpf: p.cpf, patientId },
        guardianPatientId: patientId,
        answers: { ...answers(p.groups), ...complaints[p.cpf] } as Answers,
        now,
      });
    }

    // Como recepção: a pessoa sem app.
    const asReception = await userContext(db, idOf("recepcao"), now);
    await runAction<Entry>(
      asReception,
      { action: "create_entry", target: { kind: "entry", id: (e) => e.id }, unitId: ubs.id },
      async (tx) => {
        const r = await joinWaitlist(tx, {
          serviceId: dental.id,
          person: { name: "José Pereira", birthDate: "1975-06-30", cpf: null, patientId: null },
          guardianPatientId: null,
          answers: answers([]),
          now,
        });
        if (!r.ok) throw new Error(`entrada de José: ${r.error}`);
        return r.state;
      },
    );

    // Fatia 4: a recepção (que agenda) alocou Bruno há 30 h e ele não respondeu: destacado na lista de ligação.
    await allocateSession(await userContext(db, idOf("recepcao"), now - 30 * 3600_000), laterDental.id, brunoInDental);

    return {
      panel: `${panelOrigin(slug)}/login`,
      users,
      patients: PATIENTS.map((p) => ({ name: p.name, cpf: p.cpf, password: EXAMPLE_PASSWORD })),
      sessions: [
        { service: dressings.name, visibility: "public", localStart: fromNow.local },
        { service: `${general.name} (com triagem)`, visibility: "public", localStart: fromNow.local },
        { service: general.name, visibility: "public", localStart: morning.ini.local },
        { service: dental.name, visibility: "private", localStart: afternoon.ini.local },
        { service: dental.name, visibility: "private", localStart: after.ini.local },
      ],
    };
  } finally {
    await pool.end();
  }
}

import { errorSchema } from "@fila-saude/schemas/errors";
import { UUID_PATTERN } from "infra/config/common";
import z from "zod";

// DOC4: grupos da referência da API, por quem usa a rota.
export const TAGS = {
  municipality: "Município",
  patient: "Paciente",
  panel: "Painel",
  tv: "TV",
  system: "Sistema",
} as const;

// PD-15: o município no caminho (`/v1/municipalities/:slug/…`); o `requireTenant` entra sozinho
// nessas rotas (hook do plugin do tenant).
export const slugParams = z.object({ slug: z.string().describe("Município (ex.: exemplo)") });

// Id no caminho: o mesmo formato do `pathId` (id inválido responde 404, ver `compilers.ts`).
export const idSchema = z.string().regex(UUID_PATTERN).describe("uuid");

type ErrorCodes = Partial<Record<400 | 401 | 403 | 404 | 409 | 429 | 503, readonly string[]>>;

// PD-22: respostas de erro da rota, com os códigos possíveis em cada status (os mapas se somam).
export function apiErrors(...maps: ErrorCodes[]): Record<string, typeof errorSchema> {
  const byStatus = new Map<string, string[]>();
  for (const map of maps) {
    for (const [status, codes] of Object.entries(map))
      byStatus.set(status, [...(byStatus.get(status) ?? []), ...codes]);
  }
  return Object.fromEntries([...byStatus].map(([status, codes]) => [status, errorSchema.describe(codes.join(", "))]));
}

// PD-15: erros do `requireTenant`.
export const TENANT_ERRORS: ErrorCodes = { 400: ["municipality_mismatch"], 404: ["unknown_municipality"] };

// Id malformado no caminho.
export const PATH_ID_ERRORS: ErrorCodes = { 404: ["not_found (id malformado)"] };

// PD-33: a sessão do paciente (cookie no navegador, bearer no app nativo).
export const PATIENT = [{ patientBearer: [] }, { patientCookie: [] }];

// Os mapas abaixo são `ErrorCodes`: a rota soma todos numa chamada só de `apiErrors` (duas chamadas
// espalhadas na mesma `response` apagariam os códigos do mesmo status).
export const PATIENT_ERRORS: ErrorCodes = { 401: ["not_authenticated"] };

// Rotas do paciente dentro do município.
export const PATIENT_IN_MUNICIPALITY_ERRORS: ErrorCodes[] = [TENANT_ERRORS, PATIENT_ERRORS];

// Comandos do paciente sobre uma entrada (`entries/:entryId/…`).
export const entryParams = slugParams.extend({ entryId: idSchema });
export const ENTRY_COMMAND_ERRORS: ErrorCodes[] = [
  ...PATIENT_IN_MUNICIPALITY_ERRORS,
  { 404: ["not_found"], 409: ["forbidden_transition", "…códigos do domínio"] },
];

// Inscrição e lista de espera pelo app (a pessoa por CPF tem limite, AD-065).
export const sessionParams = slugParams.extend({ sessionId: idSchema });
export const SIGN_UP_ERRORS: ErrorCodes[] = [
  ...PATIENT_IN_MUNICIPALITY_ERRORS,
  {
    400: ["invalid_input"],
    404: ["not_found"],
    409: ["duplicate", "…códigos do domínio"],
    429: ["cpf_lookup_limit"],
  },
];

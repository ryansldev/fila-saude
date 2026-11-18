import { ERROR_CODES } from "@fila-saude/domain";
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

// Id no caminho (uuid sem conferir a versão); malformado responde 404 (ver `compilers.ts`).
export const idSchema = z.string().regex(UUID_PATTERN).describe("uuid");

type ErrorCodes = Partial<Record<400 | 401 | 403 | 404 | 409 | 429 | 503, readonly string[]>>;

// PD-22: o corpo de erro, um componente só na referência (`#/components/schemas/ApiError`).
const apiErrorSchema = errorSchema.meta({ id: "ApiError" });

// PD-22: respostas de erro da rota, com os códigos possíveis em cada status (os mapas se somam).
export function apiErrors(...maps: ErrorCodes[]) {
  const byStatus = new Map<string, string[]>();
  for (const map of maps) {
    for (const [status, codes] of Object.entries(map))
      byStatus.set(status, [...(byStatus.get(status) ?? []), ...codes]);
  }
  return Object.fromEntries(
    [...byStatus].map(([status, codes]) => [
      status,
      { description: codes.join(", "), content: { "application/json": { schema: apiErrorSchema } } },
    ]),
  );
}

// PD-22: recusas do domínio (`Result` com erro) viram 409 com o código.
export const DOMAIN_CONFLICT = ERROR_CODES;

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
  { 404: ["not_found"], 409: DOMAIN_CONFLICT },
];

// Inscrição e lista de espera pelo app (a pessoa por CPF tem limite, AD-065).
export const sessionParams = slugParams.extend({ sessionId: idSchema });
export const SIGN_UP_ERRORS: ErrorCodes[] = [
  ...PATIENT_IN_MUNICIPALITY_ERRORS,
  {
    400: ["invalid_input"],
    404: ["not_found"],
    409: DOMAIN_CONFLICT,
    429: ["cpf_lookup_limit"],
  },
];

// T1.9: a sessão do painel (cookie `fila-painel`).
export const PANEL = [{ panelCookie: [] }];

// O login do painel (hook no `preValidation`, `infra/panel/guard.ts`) e a permissão da ação (PD-41).
const PANEL_ERRORS: ErrorCodes = { 401: ["not_authenticated"], 403: ["no_permission"] };

// Ids no caminho do painel (`units/:unitId`, `sessions/:sessionId`…).
export function idParams<const K extends string>(...names: K[]) {
  return z.object(Object.fromEntries(names.map((n) => [n, idSchema])) as Record<K, typeof idSchema>);
}

type PanelRoute = {
  summary: string;
  params?: z.ZodType;
  querystring?: z.ZodType;
  body?: z.ZodType;
  response: Record<number, z.ZodType>;
  errors?: ErrorCodes;
};

// Schema de uma rota do painel: tag, segurança e os erros comuns (município, login, permissão, id
// malformado e entrada inválida) somados aos da rota.
export function panelSchema<const S extends PanelRoute>(route: S) {
  const { errors, response, ...rest } = route;
  const input = route.body || route.querystring ? { 400: ["invalid_input"] } : {};
  return {
    ...rest,
    tags: [TAGS.panel],
    security: PANEL,
    response: {
      ...response,
      ...apiErrors(TENANT_ERRORS, PANEL_ERRORS, route.params ? PATH_ID_ERRORS : {}, input, errors ?? {}),
    } as S["response"],
  } as Omit<S, "errors">;
}

// Resposta sem corpo (204).
export const NO_CONTENT = z.null().describe("Sem corpo");

// RN-TV-02: o token que a TV ganha ao se registrar (Authorization: Bearer).
export const TV = [{ tvBearer: [] }];

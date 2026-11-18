import z from "zod";

// Discovery-papeis-ubs / RN-PERF-04. Listas iguais às do domínio (`equipe.ts`, `permissoes.ts`).
export const occupationSchema = z.enum([
  "physician",
  "nurse",
  "nursing_technician",
  "dentist",
  "oral_health_assistant",
  "community_health_agent",
  "reception",
  "pharmacist",
  "psychologist",
  "physiotherapist",
  "nutritionist",
  "social_worker",
]);
export const roleSchema = z.enum(["sms_management", "sms_regulation", "unit_manager", "scheduler"]);

/** Papéis de permissão do painel (colunas da matriz, sem paciente). */
export const staffRoleSchema = z.enum([
  "sms_management",
  "sms_regulation",
  "unit_manager",
  "scheduler",
  "reception",
  "nurse",
  "nursing_technician",
  "care",
]);

export const unitLinkSchema = z.object({ unitId: z.uuid(), occupation: occupationSchema });
export const scopedRoleSchema = z.object({ role: roleSchema, unitId: z.uuid().nullable() });
export const scopedProfileSchema = z.object({ profile: staffRoleSchema, unitId: z.uuid().nullable() });

export const assignmentsSchema = z.object({
  unitLinks: z.array(unitLinkSchema),
  roles: z.array(scopedRoleSchema),
});

// O plugin username do better-auth só aceita esses caracteres no login: fora deles a conta nasceria
// sem conseguir entrar.
export const loginSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_.]+$/, "use só letras sem acento, números, ponto ou _");

export const staffUserInputSchema = assignmentsSchema.extend({
  login: loginSchema,
  name: z.string().trim().min(1).max(200),
  password: z.string().min(8),
});

export const staffUserSchema = assignmentsSchema.extend({
  id: z.string(),
  login: z.string(),
  name: z.string(),
});

export type Occupation = z.infer<typeof occupationSchema>;
export type StaffRole = z.infer<typeof roleSchema>;
export type ScopedProfile = z.infer<typeof scopedProfileSchema>;
export type AssignmentsInput = z.infer<typeof assignmentsSchema>;
export type StaffUserInput = z.infer<typeof staffUserInputSchema>;
export type StaffUser = z.infer<typeof staffUserSchema>;

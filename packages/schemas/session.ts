import z from "zod";

/** Campos de configuração compartilhados por sessão e série. */
export const sessionConfigFields = {
  slots: z.number().int().min(1).nullable(),
  visibility: z.enum(["public", "private"]),
  waivesPreRegistration: z.boolean(),
  professional: z.string().trim().min(1).nullable(),
  stations: z.array(z.uuid()),
};

export const sessionInputSchema = z
  .object({
    serviceId: z.uuid(),
    start: z.iso.datetime(),
    end: z.iso.datetime(),
    ...sessionConfigFields,
  })
  .refine((s) => Date.parse(s.end) > Date.parse(s.start), { message: "fim deve ser depois do início", path: ["end"] });

export type SessionInput = z.infer<typeof sessionInputSchema>;

export const sessionStateSchema = z.enum(["planned", "open", "closed", "cancelled"]);

// Edição: horário e configuração; `versao` é a trava otimista (PD-37).
export const sessionEditSchema = z
  .object({
    start: z.iso.datetime(),
    end: z.iso.datetime(),
    slots: sessionConfigFields.slots,
    professional: sessionConfigFields.professional,
    stations: sessionConfigFields.stations,
  })
  .partial()
  .extend({ version: z.number().int().min(0) });

// RN-PUB-03.
export const visibilityInputSchema = z.object({
  visibility: sessionConfigFields.visibility,
  waivesPreRegistration: z.boolean().optional(),
  version: z.number().int().min(0),
});

export const sessionSchema = z.object({
  id: z.uuid(),
  serviceId: z.uuid(),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  taken: z.number().int().min(0),
  state: sessionStateSchema,
  version: z.number().int().min(0),
  ...sessionConfigFields,
});

export type SessionEdit = z.infer<typeof sessionEditSchema>;
export type VisibilityInput = z.infer<typeof visibilityInputSchema>;
export type Session = z.infer<typeof sessionSchema>;

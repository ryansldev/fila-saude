import z from "zod";

export const serviceModeSchema = z.enum(["direct", "referral", "regulated"]);

export const serviceInputSchema = z.object({
  name: z.string().trim().min(1),
  prefix: z.string().regex(/^[A-Z]{1,3}$/, "1 a 3 letras maiúsculas"),
  requiresTriage: z.boolean(),
  mode: serviceModeSchema,
  averageTimeMin: z.object({
    triage: z.number().int().min(1).optional(),
    care: z.number().int().min(1).optional(),
  }),
});

export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const serviceEditSchema = serviceInputSchema.partial();

export const serviceSchema = serviceInputSchema.extend({
  id: z.uuid(),
  unitId: z.uuid(),
  active: z.boolean(),
});

export type ServiceEdit = z.infer<typeof serviceEditSchema>;
export type Service = z.infer<typeof serviceSchema>;

import z from "zod";

export const StatusSchema = z.object({
  updated_at: z.string(),
  dependencies: z.object({
    database: z.object({
      version: z.string(),
      connections: z.object({
        max: z.number(),
        total: z.number(),
        idle: z.number(),
        waiting: z.number(),
      }),
    }),
  }),
});

export type Status = z.infer<typeof StatusSchema>;

import z from "zod";

export const statusSchema = z.object({
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

export type StatusSchema = z.infer<typeof statusSchema>;

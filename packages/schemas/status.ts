import z from "zod";

export const statusSchema = z.object({
  updated_at: z.string(),
  dependencies: z.object({
    database: z.object({
      version: z.string(),
      max_connections: z.number(),
      opened_connections: z.number(),
    }),
  }),
});

export type StatusSchema = z.infer<typeof statusSchema>;

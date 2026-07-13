import { z } from "zod";

export const errorResponseSchema = z.object({
  message: z.string(),
  status: z.number(),
  error: z.string(),
});

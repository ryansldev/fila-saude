import { z } from "zod";

export const ErrorResponseSchema = z.object({
  message: z.string(),
  status: z.number(),
  error: z.string(),
});

import { z } from "zod";

export const signUpRequestSchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
  rememberMe: z.boolean().default(false),
  callbackUrl: z.string().optional(),
});

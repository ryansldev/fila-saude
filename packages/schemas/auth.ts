import { z } from "zod";

export const signUpRequestSchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
  rememberMe: z.boolean().default(false),
  callbackURL: z.string().optional(),
});

export const signUpResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    email: z.email(),
    name: z.string(),
    id: z.string(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
    email_verified: z.boolean().default(false),
    image: z.string().nullish(),
  }),
});

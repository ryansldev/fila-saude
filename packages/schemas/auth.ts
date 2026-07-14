import { z } from "zod";

const userSchema = z.object({
  email: z.email(),
  name: z.string(),
  id: z.string(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  email_verified: z.boolean().default(false),
  image: z.string().nullish(),
});

export const sessionSchema = z.object({
  expires_at: z.iso.datetime(),
  token: z.string(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  ip_address: z.string().nullish(),
  user_agent: z.string().nullish(),
  user_id: z.string(),
  id: z.string(),
});

export const signUpRequestSchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
  rememberMe: z.boolean().default(false),
  callbackURL: z.string().optional(),
});

export const signUpResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
});

export const signInRequestSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export const signInResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
});

export const getSessionResponseSchema = z
  .object({
    session: sessionSchema,
    user: userSchema,
  })
  .nullable();

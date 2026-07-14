import { z } from "zod";

const UserSchema = z.object({
  email: z.email(),
  name: z.string(),
  id: z.string(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  email_verified: z.boolean().default(false),
  image: z.string().nullish(),
});

export const SessionSchema = z.object({
  expires_at: z.iso.datetime(),
  token: z.string(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  ip_address: z.string().nullish(),
  user_agent: z.string().nullish(),
  user_id: z.string(),
  id: z.string(),
});

export const SignUpRequestSchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
  rememberMe: z.boolean().default(false),
  callbackURL: z.string().optional(),
});

export const SignUpResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
});

export const SignInRequestSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export const SignInResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
  redirect: z.boolean(),
  url: z.string().optional(),
});

export const GetSessionResponseSchema = z
  .object({
    session: SessionSchema,
    user: UserSchema,
  })
  .nullable();

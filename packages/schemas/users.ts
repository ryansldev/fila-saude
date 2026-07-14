import z from "zod";

export const UpdateUserRequestSchema = z.object({
  name: z.string().optional(),
  image: z.string().optional(),
});

export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

export const UpdateUserResponseSchema = z.object({
  status: z.boolean(),
});

export type UpdateUserResponse = z.infer<typeof UpdateUserResponseSchema>;

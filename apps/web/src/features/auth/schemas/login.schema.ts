import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email({
    error: 'Enter a valid email address',
  }),

  password: z
    .string()
    .min(1, {
      error: 'Password is required',
    })
    .max(128, {
      error: 'Password is too long',
    }),
});

export type LoginFormValues =
  z.infer<typeof loginSchema>;
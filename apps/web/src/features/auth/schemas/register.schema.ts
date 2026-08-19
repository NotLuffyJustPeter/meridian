import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, {
        error:
          'Name must contain at least 2 characters',
      })
      .max(80, {
        error:
          'Name cannot exceed 80 characters',
      }),

    email: z.email({
      error: 'Enter a valid email address',
    }),

    password: z
      .string()
      .min(8, {
        error:
          'Password must contain at least 8 characters',
      })
      .max(128, {
        error:
          'Password cannot exceed 128 characters',
      }),

    confirmPassword: z
      .string()
      .min(1, {
        error:
          'Please confirm your password',
      }),
  })
  .refine(
    (values) =>
      values.password ===
      values.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    },
  );

export type RegisterFormValues =
  z.infer<typeof registerSchema>;
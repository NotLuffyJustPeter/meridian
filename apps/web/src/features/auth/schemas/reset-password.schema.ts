import {
  z,
} from 'zod';

export const resetPasswordSchema =
  z
    .object({
      password:
        z
          .string()
          .min(8, {
            error:
              'Use at least 8 characters',
          })
          .max(128, {
            error:
              'Password is too long',
          }),

      confirmPassword:
        z
          .string()
          .min(1, {
            error:
              'Confirm your password',
          }),
    })
    .refine(
      (values) =>
        values.password ===
        values.confirmPassword,
      {
        path: [
          'confirmPassword',
        ],
        message:
          'Passwords do not match',
      },
    );

export type ResetPasswordFormValues =
  z.infer<
    typeof resetPasswordSchema
  >;

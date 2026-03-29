import { z } from 'zod';

export const EmailGuard = z.object({
  to: z.string().email('invalid email address'),
  subject: z.string().min(1, 'subject cannot be empty'),
  body: z.string().min(1, 'body cannot be empty').max(100_000, 'body exceeds 100KB limit'),
});

export const TelegramGuard = z.object({
  chatId: z.number().int('chatId must be an integer'),
  text: z.string().min(1, 'text cannot be empty').max(4096, 'text exceeds Telegram 4096 char limit'),
});

export const SpecialistOutputGuard = z.object({
  output: z.string()
    .min(10, 'specialist output too short to be valid')
    .max(50_000, 'specialist output exceeds 50KB limit'),
});

export type EmailGuardInput = z.infer<typeof EmailGuard>;
export type TelegramGuardInput = z.infer<typeof TelegramGuard>;
export type SpecialistOutputGuardInput = z.infer<typeof SpecialistOutputGuard>;

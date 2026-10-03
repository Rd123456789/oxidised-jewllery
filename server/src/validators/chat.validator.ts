import { z } from 'zod';

/**
 * Chat is public, so the limits are tight: a long message is not a question a shopper types, and
 * accepting one would only waste a catalog query. History is capped because the bot reads it for
 * context, not as a transcript to replay.
 */
export const chatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Ask a question')
    .max(280, 'That message is too long'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(600),
      }),
    )
    .max(20)
    .optional()
    .default([]),
});

export type ChatInputDto = z.infer<typeof chatSchema>;
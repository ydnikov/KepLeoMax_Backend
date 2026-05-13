import { z } from 'zod';

export const getMessagesByChatIdSchema = z.object({
    query: z.object({
        chatId: z.coerce.number().int().positive(),
        limit: z.coerce.number().int().positive().default(100),
        cursor: z.coerce.number().int().positive().optional(),
    }),
});
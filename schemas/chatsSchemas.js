import { z } from 'zod';

export const getChatSchema = z.object({
    params: z.object({
        chatId: z.string().min(1)
    })
});

export const getChatsSchema = z.object({});

export const getChatWithUserSchema = z.object({
    query: z.object({
        userId: z.coerce.number().int().positive()
    })
});
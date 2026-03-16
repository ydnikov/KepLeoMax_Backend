import { z } from 'zod';

export const getChatSchema = z.object({
    query: z.object({
        chatId: z.coerce.number().int().positive()
    })
});

export const getChatsSchema = z.object({});

export const getChatWithUserSchema = z.object({
    query: z.object({
        userId: z.coerce.number().int().positive()
    })
});
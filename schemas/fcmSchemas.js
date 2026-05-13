import { z } from 'zod';

export const addFCMTokenSchema = z.object({
    query: z.object({
        token: z.string()
    })
});

export const deleteFCMTokenSchema = z.object({
    query: z.object({
        token: z.string()
    })
});
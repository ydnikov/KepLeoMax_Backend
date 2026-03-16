import { z } from 'zod';

export const getUserSchema = z.object({
    query: z.object({
        userId: z.coerce.number().int().positive()
    })
});
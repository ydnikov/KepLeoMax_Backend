import { z } from 'zod';

export const declineCallSchema = z.object({ 
    query: z.object({
        otherUserId: z.coerce.number().int().positive()
    }) 
});
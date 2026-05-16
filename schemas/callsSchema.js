import { z } from 'zod';

export const callStatusSchema = z.object({ 
    query: z.object({
        call_id: z.string()
    }) 
});

export const acceptCallSchema = z.object({ 
    query: z.object({
        call_id: z.string()
    }) 
});

export const startCallSchema = z.object({ 
    query: z.object({
        other_user_id: z.coerce.number().int().positive()
    }) 
});

export const declineCallSchema = z.object({ 
    query: z.object({
        call_id: z.string(),
        fcm_token: z.string().nullish()
    }) 
});
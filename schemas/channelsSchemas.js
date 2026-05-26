import { z } from 'zod';

export const newChannelSchema = z.object({ 
    body: z.object({
        name: z.string().min(3),
        image_url: z.string().nullish(),
        descirption: z.string().max(200).nullish(),
        tag: z.string().max(32)
    }) 
});

export const editChannelSchema = z.object({ 
    query: z.object({
        channel_id: z.coerce.number().int().positive()
    }),
    body: z.object({
        name: z.string().min(3),
        image_url: z.string().nullish(),
        descirption: z.string().max(200).nullish(),
        tag: z.string().max(32)
    }) 
});

export const subsCountSchema = z.object({ 
    query: z.object({
        channel_id: z.coerce.number().int().positive(),
    }) 
});

export const subsSchema = z.object({ 
    query: z.object({
        channel_id: z.coerce.number().int().positive(),
        limit: z.coerce.number().int().positive().default(10),
        cursor: z.coerce.number().int().positive().default(-1),
    }) 
});

export const subsribeOnChannelSchema = z.object({ 
    query: z.object({
        channel_id: z.coerce.number().int().positive(),
    }) 
});

export const unsubsribeFromChannelSchema = z.object({ 
    query: z.object({
        channel_id: z.coerce.number().int().positive(),
    }) 
});
import { z } from 'zod';

export const editProfileSchema = z.object({
    body: z.object({
        username: z.string().min(3).max(50),
        description: z.string().max(200).default(''),
        profile_image: z.string().nullable().optional(),
        update_image: z.boolean().default(false),
    })
});

export const getProfileSchema = z.object({
    query: z.object({
        userId: z.coerce.number().int().positive()
    })
});

export const searchUserSchema = z.object({
    query: z.object({
        search: z.string(),
        limit: z.coerce.number().int().default(10),
        cursor: z.coerce.number().int().optional(),
    })
});
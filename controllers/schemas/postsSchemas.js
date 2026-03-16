import { z } from 'zod';

export const createNewPostSchema = z.object({
    body: z.object({
        content: z.string().min(0).max(4000),
        images: z.array(z.string()),
    })
});

export const updatePostSchema = z.object({
    query: z.object({
        postId: z.coerce.number().int().positive(),
    }),
    body: z.object({
        content: z.string().min(0).max(4000),
        images: z.array(z.string()),
    })
});

export const getPostsByUserIdSchema = z.object({
    query: z.object({
        userId: z.coerce.number().int().positive(),
        limit: z.coerce.number().int().positive().default(100),
        cursor: z.coerce.number().int().positive().optional(),
    })
});

export const getPostsSchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().positive().default(100),
        cursor: z.coerce.number().int().positive().optional(),
    })
});

export const deletePostSchema = z.object({
    query: z.object({
        postId: z.coerce.number().int().positive(),
    })
});
import { z } from 'zod';

export const createNewUserSchema = z.object({
    body: z.object({
        email: z.string().min(5).max(100),
        password: z.string().min(6).max(100),
    })
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().min(5).max(100),
        password: z.string().min(6).max(100),
    })
});

export const refreshTokenSchema = z.object({
    body: z.object({
        refresh_token: z.string(),
    })
});

export const logoutSchema = z.object({
    body: z.object({
        refresh_token: z.string().optional(),
    })
});
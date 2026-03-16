import { z } from 'zod';

export const wsMessageSchema = z.object({
    recipient_id: z.number().int().positive(),
    message: z.string().min(1).max(4000),
});

export const wsDeleteMessageSchema = z.object({
    message_id: z.number().int().positive()
});

export const wsReadBeforeTimeSchema = z.object({
    chat_id: z.number().int().positive(),
    time: z.number().int().positive(),
});

export const wsReadAllSchema = z.object({
    chat_id: z.number().int().positive()
});

export const wsActivityDetectedSchema = z.undefined();

export const wsTypingActivitySchema = z.object({
    chat_id: z.number().int().positive()
});

export const wsSubsribeOnOnlineStatusUpdatesSchema = z.object({
    users_ids: z.array(z.number().int().positive())
});

// WebRTC
export const wsSendOfferSchema = z.object({
    to_user_id: z.number().int().positive(),
    offer: z.object({
        sdp: z.string().nullable(),
        type: z.string().nullable(),
    }),
});

export const wsSendAnswerSchema = z.object({
    to_user_id: z.number().int().positive(),
    answer: z.object({
        sdp: z.string().nullable(),
        type: z.string().nullable(),
    }),
});

export const wsSendIceCandidateSchema = z.object({
    to_user_id: z.number().int().positive(),
    candidate: z.object({
        candidate: z.string().nullable(),
        sdpMid: z.string().nullable(),
        sdpMLineIndex: z.number().int().nullable(),
    }),
});

export const wsSendCameraStatusSchema = z.object({
    to_user_id: z.number().int().positive(),
    status: z.enum(['off', 'back', 'front']),
});

export const wsEndCallSchema = z.object({
    to_user_id: z.number().int().positive(),
});
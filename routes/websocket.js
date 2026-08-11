import { rateLimiter } from '../middleware/tokenBucket.js';
import { wsActivityDetectedSchema, wsDeleteMessageSchema, wsMessageSchema, wsReadAllSchema, wsReadBeforeTimeSchema, wsSendAnswerSchema, wsSendCameraStatusSchema, wsSendIceCandidateSchema, wsSendOfferSchema, wsSubsribeOnChatsUpdatesSchema, wsSubsribeOnOnlineStatusUpdatesSchema as wsSubsribeOnOnlineStatusSchema, wsTypingActivitySchema } from '../schemas/websocketSchemas.js';
import { endCallIfExists as endCallIfShould, sendAnswer, sendCameraStatus, sendICECandidate, sendOffer } from '../services/webRTCService.js';
import { changeOnlineStatus as updateOnlineStatus, onDeleteMessage, onMessage, onMessageToAi, onReadAll, onReadBeforeTime, typingActivity, subscribeOnChatsUpdates } from '../services/websocketService.js';

const withValidation = (socket, schema, callback) => (data) => {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = (result.error.issues ?? result.error.errors ?? []).map(error => ({ field: error.path.join('.'), message: error.message }));
        console.error(`ws validation error: ${JSON.stringify(errors)}`);
        return socket.emit('validation_error', {
            errors: errors,
        });
    }
    callback(result.data);
}

const webSocket = (socket) => {
    const userId = socket.userId;
    const fcmToken = socket.handshake.auth.fcm_token;
    const ip = socket.handshake.address;

    if (!userId) {
        socket.emit('auth_error', 401);
        socket.disconnect();
        return;
    }

    console.log(`user ${socket.id} with id ${userId} connected`);
    updateOnlineStatus(true, userId);
    socket.join(userId.toString());

    socket.use(async (_, next) => {
        try {
            await rateLimiter.consume(ip);
            next();
        } catch (rateLimiterRes) {
            socket.emit('error', {
                message: 'Too many requests',
            });
            console.log(`too many requests (ws): ${userId}`);
        }
    });

    socket.on('message', withValidation(socket, wsMessageSchema, (data) => {
        onMessage(data, userId);

        // if (data.recipient_id == process.env.CHAT_BOT_ID) {
        //     onMessageToAi(data, userId);
        // }
    }));

    socket.on('delete_message', withValidation(socket, wsDeleteMessageSchema, (data) =>
        onDeleteMessage(data, userId)
    ));

    socket.on('read_all', withValidation(socket, wsReadAllSchema, (data) =>
        onReadAll(data, userId)
    ));

    socket.on('read_before_time', withValidation(socket, wsReadBeforeTimeSchema, async (data) =>
        onReadBeforeTime(data, userId)
    ));

    socket.on('subscribe_on_online_status_updates', withValidation(socket, wsSubsribeOnOnlineStatusSchema, async (data) => {
        const rooms = data.users_ids.map(id => `${id}_online_status`)
        await socket.join(rooms);
        // console.log(`subscribe_on_online_status_updates: ${data.users_ids}`);
    }));

    socket.on('subscribe_on_chats_updates', withValidation(socket, wsSubsribeOnChatsUpdatesSchema, async (data) => {
        subscribeOnChatsUpdates({ ids: data.ids, socket: socket }, userId);
        // console.log(`subscribe_on_chats_updates: ${data.ids}`);
    }));

    socket.on('activity_detected', withValidation(socket, wsActivityDetectedSchema, (data) =>
        updateOnlineStatus(true, userId)
    ));

    socket.on('typing_activity_detected', withValidation(socket, wsTypingActivitySchema, (data) =>
        typingActivity(data, userId)
    ));

    /// WebRTC
    socket.on('webrtc_send_offer', withValidation(socket, wsSendOfferSchema, (data) =>
        sendOffer(data, userId)
    ));

    socket.on('webrtc_send_answer', withValidation(socket, wsSendAnswerSchema, (data) =>
        sendAnswer(data, userId)
    ));

    socket.on('webrtc_send_ice_candidate', withValidation(socket, wsSendIceCandidateSchema, (data) =>
        sendICECandidate(data, userId)
    ));

    socket.on('webrtc_send_camera_status', withValidation(socket, wsSendCameraStatusSchema, (data) =>
        sendCameraStatus(data, userId)
    ));

    socket.on('disconnect', () => {
        console.log(`user ${socket.id} with id ${userId} disconnected`);
        updateOnlineStatus(false, userId);
        endCallIfShould(userId, fcmToken);
    });
}

export default webSocket;
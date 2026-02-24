import { changeOnlineStatus as updateOnlineStatus, onDeleteMessage, onMessage, onMessageToAi, onReadAll, onReadBeforeTime, typingActivity } from '../services/websocketService.js';

const webSocket = (io, socket) => {
    const userId = socket.userId;

    if (!userId) {
        socket.emit('auth_error', 401);
        socket.disconnect();
        return;
    }

    console.log(`user ${socket.id} with id ${userId} connected`);
    updateOnlineStatus(io, true, userId);

    socket.join(userId.toString());

    socket.on('message', async (data) => {
        onMessage(io, data, userId);

        if (data.recipient_id == process.env.CHAT_BOT_ID) {
            onMessageToAi(io, data, userId);
        }
    }
    );

    socket.on('delete_message', async (data) => {
        onDeleteMessage(io, data, userId);
    });

    socket.on('read_all', async (data) =>
        onReadAll(io, data, userId)
    );

    socket.on('read_before_time', async (data) =>
        onReadBeforeTime(io, data, userId)
    );

    socket.on('subscribe_on_online_status_updates', async (data) => {
        const ids = data.users_ids;

        if (isNaN(ids) && Array.isArray(ids)) {
            for (const id in ids) {
                socket.join(`${id}_online_status`);
            }
        } else if (!isNaN(ids)) {
            socket.join(`${ids}_online_status`);
        }
    });

    socket.on('activity_detected', async (data) => {
        updateOnlineStatus(io, true, userId);
    });

    socket.on('typing_activity_detected', async (data) => {
        typingActivity(io, data, userId);
    });

    socket.on('disconnect', () => {
        console.log(`user ${socket.id} with id ${userId} disconnected`);
        updateOnlineStatus(io, false, userId);
    });
}

export default webSocket;
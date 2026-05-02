import * as chatsModel from '../models/chatsModel.js';
import * as messagesModel from '../models/messagesModel.js';
import * as usersModel from '../models/usersModel.js';
import * as onlinesModel from '../models/onlinesModel.js';
import * as callsModel from '../models/callsModel.js';
import { sendNotification } from '../services/notificationService.js';
import { ask } from './aiService.js';
import convertUserToSend from '../utills/convertUser.js';
import pool from '../db.js';

/// online status
export const changeOnlineStatus = async (io, isOnline, userId) => {
    const result = await onlinesModel.updateOnlineStatus(userId, isOnline);
    console.log('update_online_status userId: ' + userId);

    io.in(`${userId}_online_status`).emit('online_status_update', {
        user_id: userId,
        is_online: result.is_online,
        last_activity_time: result.last_activity_time,
    });
}

export const typingActivity = async (io, data, userId) => {
    const chatId = data.chat_id;
    if (isNaN(chatId)) return;
    const otherUserId = await chatsModel.getOtherUserIdByChatId(userId, chatId);
    if (!otherUserId) return;

    io.in(otherUserId.toString()).emit('typing_activity', {
        chat_id: chatId,
    });
}

/// messages
export const onReadBeforeTime = async (io, data, userId) => {
    const chatId = data.chat_id;
    const beforeTime = data.time;

    const readMessages = await messagesModel.readMessages(chatId, userId, beforeTime);
    if (readMessages.length > 0) {
        // TODO optimize
        const otherUserId = await chatsModel.getOtherUserIdByChatId(userId, chatId);
        sendReadEvents(io, chatId, readMessages[0].sender_id, userId, otherUserId, readMessages.map(obj => obj.id));
    }
}

export const onReadAll = async (io, data, userId) => {
    data.time = Date.now();
    await onReadBeforeTime(io, data, userId);
}

export const onMessageToAi = async (io, data, userId) => {
    const message = data.message;
    if (!message) {
        onError('Event: onMessageToAi, message is missing');
        return;
    }

    /// todo optimize
    const chat = await chatsModel.getChatOfUsers([userId, process.env.CHAT_BOT_ID]);
    var messages;
    if (!chat) {
        messages = [];
    } else {
        messages = (await messagesModel.getAllMessagesByChatId(chat.id, 50, null))
    }
    const answer = await ask(message, messages.reverse());
    const newData = {
        recipient_id: userId,
        message: answer
    };
    onMessage(io, newData, Number(process.env.CHAT_BOT_ID));
}

export const onMessage = async (io, data, userId) => {
    const otherUserId = data.recipient_id;
    const call = data.call;
    const message = call == null ? data.message : JSON.stringify(call);
    const type = data.type;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let chatId;
        let createdChatInfo = null;
        const chat = await chatsModel.getChatOfUsers([userId, otherUserId], client);
        if (!chat) {
            console.log(`creating new chat between ${userId} and ${otherUserId}`);
            chatId = await chatsModel.createNewChat([userId, otherUserId], client);
            createdChatInfo = { chat_id: chatId, users_ids: [userId, otherUserId] };
        } else {
            chatId = chat.id;
        }
        console.log(`chat id: ${chatId}, userId: ${userId}, otherUserId: ${otherUserId}`);
        const callIsMissed = call && !call.start_time && call.end_time;
        /// TODO wtf these 2 lines?
        const messageId = await messagesModel.createNewMessage(chatId, userId, message, type, call != null && !callIsMissed, client);
        const newMessage = await messagesModel.getMessageById(messageId, client);

        newMessage.is_current_user = true;
        newMessage.other_user_id = otherUserId;
        io.in(userId.toString()).emit('new_message', { message: newMessage, created_chat_info: createdChatInfo });
        newMessage.is_current_user = false;
        newMessage.other_user_id = Number(userId);
        io.in(otherUserId.toString()).emit('new_message', { message: newMessage, created_chat_info: createdChatInfo });
        console.log(`new message ${message} emitet to ${userId}, ${otherUserId}`);

        // read messages
        const readMessages = await messagesModel.readMessages(chatId, userId, null, client);
        if (readMessages.length > 0) {
            sendReadEvents(io, chatId, readMessages[0].sender_id, userId, otherUserId, readMessages.map(obj => obj.id));
        }

        // send notification
        if (!call) {
            const user = await usersModel.getUserById(userId, client);
            sendNotification(otherUserId, user.username, newMessage.message, {
                chat_id: chatId.toString(),
                type: 'new',
                ids: JSON.stringify([newMessage.id]),
                other_user: JSON.stringify(convertUserToSend(user))
            });
        } else {
            if (!call.start_time && call.end_time && call.notify_other_user) {
                // send missed call notification
                const user = await usersModel.getUserById(userId, client);
                sendNotification(otherUserId, user.username, 'Missed call', {
                    chat_id: chatId.toString(),
                    type: 'new_missed_call',
                    ids: JSON.stringify([newMessage.id]),
                    other_user: JSON.stringify(convertUserToSend(user))
                });
            }
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export const onDeleteMessage = async (io, data, userId) => {
    const client = await pool.connect();

    try {
        const messageId = data.message_id;
        const messageToDelete = await messagesModel.getMessageById(messageId);
        if (!messageToDelete || messageToDelete.sender_id != userId) return;

        const chatId = messageToDelete.chat_id;
        const otherUserId = await chatsModel.getOtherUserIdByChatId(userId, chatId);
        if (!otherUserId) {
            onError('Event: onDeleteMessage, otherUser is not found');
            return;
        }
        const lastTwoMessages = await messagesModel.getAllMessagesByChatId(chatId, 2);

        await messagesModel.deleteMessageById(messageToDelete.id, client);

        const messageToSend = { ...messageToDelete };
        messageToSend['message'] = '_deleted_';
        if (messageToDelete.id != lastTwoMessages[0].id) {
            messageToSend['is_current_user'] = messageToSend.sender_id == userId;
            io.in([userId.toString()]).emit('deleted_message', {
                chat_id: chatId,
                message: messageToSend,
            });
            messageToSend['is_current_user'] = messageToSend.sender_id == otherUserId;
            io.in([otherUserId.toString()]).emit('deleted_message', {
                chat_id: chatId,
                message: messageToSend,
            });
        } else {
            const newLastMessage = lastTwoMessages[1];
            console.log(`delete_message, newLastMessage: ${newLastMessage}`);
            if (newLastMessage) {
                newLastMessage['is_current_user'] = newLastMessage.sender_id == userId;
            }
            messageToSend['is_current_user'] = messageToSend.sender_id == userId;
            io.in([userId.toString()]).emit('deleted_message', {
                chat_id: chatId,
                message: messageToSend,
                new_last_message: newLastMessage,
                delete_chat: newLastMessage == null
            });
            if (newLastMessage) {
                newLastMessage['is_current_user'] = newLastMessage.sender_id == otherUserId;
            }
            messageToSend['is_current_user'] = messageToSend.sender_id == otherUserId;
            io.in([otherUserId.toString()]).emit('deleted_message', {
                chat_id: chatId,
                message: messageToSend,
                new_last_message: newLastMessage,
                delete_chat: newLastMessage == null
            });

            if (!newLastMessage) {
                // deleted message is the last one from the chat
                await chatsModel.deleteChatById(chatId, client);
            }
        }

        await client.query('COMMIT');

        sendNotification(otherUserId, '', '', {
            chat_id: chatId.toString(),
            type: 'cancel',
            ids: JSON.stringify([messageToDelete.id]),
        });
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

const onError = (message) => {
    console.log(`WSError ${message}`);
}

const sendReadEvents = async (io, chatId, senderId, userId, otherUserId, messagesIds) => {
    io.in([userId.toString()]).emit('read_messages', {
        chat_id: chatId,
        sender_id: senderId,
        is_current_user: senderId == userId,
        messages_ids: messagesIds,
    });
    io.in([otherUserId.toString()]).emit('read_messages', {
        chat_id: chatId,
        sender_id: senderId,
        is_current_user: senderId == otherUserId,
        messages_ids: messagesIds,
    });

    sendNotification(senderId == otherUserId ? userId : otherUserId, '', '', {
        chat_id: chatId.toString(),
        type: 'cancel',
        ids: JSON.stringify(messagesIds),
    });
}
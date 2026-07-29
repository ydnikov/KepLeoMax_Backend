import * as chatsModel from '../models/chatsModel.js';
import * as messagesModel from '../models/messagesModel.js';
import * as usersModel from '../models/usersModel.js';
import * as onlinesModel from '../models/onlinesModel.js';
import * as channelsModel from '../models/channelsModel.js';
import { sendNotification, sendNotificationToTopic } from '../services/notificationService.js';
import { askChatGPT } from './aiService.js';
import convertUserToSend from '../utills/convertUser.js';
import pool from '../db.js';
import { io } from '../server.js';

/// online status
export const changeOnlineStatus = async (isOnline, userId) => {
    const result = await onlinesModel.updateOnlineStatus(userId, isOnline);
    console.log('update_online_status userId: ' + userId);

    io.in(`${userId}_online_status`).emit('online_status_update', {
        user_id: userId,
        is_online: result.is_online,
        last_activity_time: result.last_activity_time,
    });
}

export const typingActivity = async (data, userId) => {
    const chatId = data.chat_id;
    if (isNaN(chatId)) return;
    const otherUserId = await chatsModel.getOtherUserIdByChatId(userId, chatId);
    if (!otherUserId) return;

    io.in(otherUserId.toString()).emit('typing_activity', {
        chat_id: chatId,
    });
}

/// channels
export const onSubscribeOnChannel = async (data, userId) => {
    const channel = data.channel;
    io.in(userId.toString()).emit('subscribe_on_channel', { channel: channel });
}

export const onUnsubscribeFromChannel = async (data, userId) => {
    const channelId = data.channel_id;
    const subsCount = data.subs_count;
    io.in(userId.toString()).emit('unsubscribe_from_channel', { channel_id: channelId, subs_count: subsCount });
}

export const onChatUpdated = async (data, userId) => {
    const newChannel = data.channel;
    io.in(`${newChannel.id}_chat_updates`).emit('channel_edited', { new_channel: newChannel });
}

export const onChannelDeleted = async (data, userId) => {
    const channelId = data.channel_id;
    io.in(`${channelId}_chat_updates`).emit('channel_deleted', { channel_id: channelId });
}

/// messages
export const onReadBeforeTime = async (data, userId) => {
    const chatId = data.chat_id;
    const beforeTime = data.time;

    const chat = chatsModel.getChatById(chatId);
    if (chat.is_channel) {

    } else {
        const readMessages = await messagesModel.readMessages(chatId, userId, beforeTime);
        if (readMessages.length > 0) {
            sendReadEvents(chatId, userId, readMessages.map(r => r.id));
        }
    }
}

export const onReadAll = async (data, userId) => {
    data.time = Date.now();
    await onReadBeforeTime(data, userId);
}

export const onMessageToAi = async (data, userId) => {
    const message = data.message;
    if (!message) {
        onError('Event: onMessageToAi, message is missing');
        return;
    }

    /// TODO optimize
    const chat = await chatsModel.getChatOfUsers(userId, process.env.CHAT_BOT_ID);
    var messages;
    if (!chat) {
        messages = [];
    } else {
        messages = (await messagesModel.getAllMessagesByChatId(chat.id, userId, 50, null))
    }
    const answer = await askChatGPT(message, messages.reverse());
    const newData = {
        recipient_id: userId,
        message: answer
    };
    onMessage(newData, Number(process.env.CHAT_BOT_ID));
}

export const onMessage = async (data, userId) => {
    const otherUserId = data.recipient_id;
    const call = data.call;
    const message = call == null ? data.message : JSON.stringify(call);
    const type = data.type;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let chatId;
        let createdChatInfo = null;
        const chat = await chatsModel.getChatOfUsers(userId, otherUserId, client);
        if (!chat) {
            console.log(`creating new chat between ${userId} and ${otherUserId}`);
            chatId = await chatsModel.createNewChat(userId, otherUserId, client);
            createdChatInfo = { chat_id: chatId, users_ids: [userId, otherUserId] };
        } else {
            chatId = chat.id;
        }
        console.log(`chat id: ${chatId}, userId: ${userId}, otherUserId: ${otherUserId}`);
        const callIsMissed = call && !call.start_time && call.end_time;
        const newMessage = await messagesModel.createNewMessage(chatId, userId, message, type, call != null && !callIsMissed, client);

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
            sendReadEvents(chatId, userId, readMessages);
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
            if (!call.start_time && call.end_time && data.notify_other_user) {
                // send missed call notification
                const user = await usersModel.getUserById(userId, client);
                sendNotification(otherUserId, user.username, 'Missed call', {
                    chat_id: chatId.toString(),
                    type: 'new_missed_call',
                    call_id: call.id.toString(),
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

export const onMessageInChannel = async (data, userId) => {
    const channelId = data.channel_id;
    const message = data.message;

    const channel = await channelsModel.getChannel(channelId);
    if (!channel || channel.owner_id !== userId) return;

    const newMessage = await messagesModel.createNewMessage(channelId, userId, message, 'post');

    io.in(`${channelId}_chat_updates`).emit('new_message', { message: newMessage });

    sendNotificationToTopic(`${channelId}_chat_updates`, channel.channel_name, newMessage.message);
}

export const onDeleteMessage = async (data, userId) => {
    const client = await pool.connect();

    try {
        const messageId = data.message_id;
        const messageToDelete = await messagesModel.getMessageById(messageId, userId, client);
        if (!messageToDelete || messageToDelete.sender_id != userId) return;

        const chatId = messageToDelete.chat_id;
        const otherUserId = await chatsModel.getOtherUserIdByChatId(userId, chatId, client);
        if (!otherUserId) {
            onError('Event: onDeleteMessage, otherUser is not found');
            return;
        }
        const lastTwoMessages = await messagesModel.getAllMessagesByChatId(chatId, userId, 2, null, client);

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

// subscriptions
export const subscribeOnChatsUpdates = async (data, userId) => {
    const socket = data.socket;
    const ids = data.ids;

    const validChatsIds = await chatsModel.validateAvailableChatsForUser(ids, userId);

    const rooms = validChatsIds.map(id => `${id}_chat_updates`);
    await socket.join(rooms);
    
    if (validChatsIds.length !== ids.length) {
        const validSet = new Set(validChatsIds);
        const failedToValidateList = ids.filter(id => !validSet.has(id));
        console.log(`user '${userId}' have done failed attempt to subscribe on inaccessible for them chats: ${failedToValidateList}`);
    }
}

// helpers
const onError = (message) => {
    console.log(`WSError ${message}`);
}

const sendReadEvents = async (chatId, currentUserId, messagesIds) => {
    io.in(`${chatId}_chat_updates`).emit('read_messages', {
        chat_id: chatId,
        messages_ids: messagesIds,
    });

    io.in(currentUserId.toString()).emit('read_messages', {
        chat_id: chatId,
        messages_ids: messagesIds,
        by_current_user: true,
    });

    // io.in([userId.toString()]).emit('read_messages', {
    //     chat_id: chatId,
    //     sender_id: senderId,
    //     is_current_user: senderId == userId,
    //     messages_ids: messagesIds,
    // });
    // io.in([otherUserId.toString()]).emit('read_messages', {
    //     chat_id: chatId,
    //     sender_id: senderId,
    //     is_current_user: senderId == otherUserId,
    //     messages_ids: messagesIds,
    // });

    // sendNotification(senderId == otherUserId ? userId : otherUserId, '', '', {
    //     chat_id: chatId.toString(),
    //     type: 'cancel',
    //     ids: JSON.stringify(messagesIds),
    // });
}
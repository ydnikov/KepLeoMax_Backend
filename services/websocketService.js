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

    // todo optimize? it can be called too often
    const channel = await channelsModel.getChannel(chatId, userId);
    if (channel != null) {
        onError('typing activity in channel');
        return;
    }

    io.in(`${chatId}_chat_updates`).emit('typing_activity', {
        user_id: userId,
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

export const onChatDeleted = async (data, userId) => {
    const chatId = data.chat_id;
    io.in(`${chatId}_chat_updates`).emit('chat_deleted', { chat_id: Number(chatId) });
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

export const onMessage = async (data, userId) => {
    // TODO fix onMessage in all places, (change otherUserId to chatId), now it's done only in websocket.js
    const chatId = data.chat_id;
    const call = data.call;
    const message = call == null ? data.message : JSON.stringify(call);
    const type = data.type;

    const client = await pool.connect();
    var isCommited = false;

    try {
        await client.query('BEGIN');

        let createdChatInfo = null;
        const chat = await chatsModel.getChatById(chatId, client);

        if (!chat) {
            onError(`attempt to write message to not existing chat: ${chatId}`)
            return;
        } else if (chat.is_channel) {
            if (chat.owner_id !== userId) {
                onError(`attempt to write message to channel, when user doesn't have permission, user: ${userId}, channel: ${chat.id}`);
                return;
            }

            const newMessage = await messagesModel.createNewMessage(chat.id, userId, message, 'post');
            io.in(`${chat.id}_chat_updates`).emit('new_message', { message: newMessage });
            return;
        }

        const hasAccessToChat = chat.user_ids.includes(userId);
        if (!hasAccessToChat) {
            onError(`attempt to write message to chat, when user doesn't have permission, user: ${userId}, channel: ${chat.id}`);
            return;
        }

        // if it's a new chat, change its status
        if (chat.temp) {
            const otherUserId = chat.user_ids.filter(id => id !== userId)[0];
            console.log(`change chat.temp to false: ${chatId}`);
            chatsModel.changeTempStatus(chatId, false, client);
            // TODO why not just send the created chat?
            createdChatInfo = { chat_id: chatId, users_ids: [userId, otherUserId] };
        }

        // create new message
        const callIsMissed = call && !call.start_time && call.end_time;
        const newMessage = await messagesModel.createNewMessage(chatId, userId, message, type, call != null && !callIsMissed, client);

        // send ws event
        var rooms;
        if (!createdChatInfo) {
            rooms = io.in(`${chatId}_chat_updates`);
        } else {
            rooms = io.in(createdChatInfo.users_ids.map(id => id.toString()));
        }
        rooms.emit('new_message', { message: newMessage, created_chat_info: createdChatInfo });
        console.log(`new message ${message} emitet to ${chatId}`);

        // read all messages in chat
        const readMessages = await messagesModel.readMessages(chatId, userId, null, client);
        if (readMessages.length > 0) {
            sendReadEvents(chatId, userId, readMessages);
        }

        // send notification
        // if (!call) {
        //     const user = await usersModel.getUserById(userId, client);
        //     sendNotification(otherUserId, user.username, newMessage.message, {
        //         chat_id: chatId.toString(),
        //         type: 'new',
        //         ids: JSON.stringify([newMessage.id]),
        //         other_user: JSON.stringify(convertUserToSend(user))
        //     });
        // } else {
        //     if (!call.start_time && call.end_time && data.notify_other_user) {
        //         // send missed call notification
        //         const user = await usersModel.getUserById(userId, client);
        //         sendNotification(otherUserId, user.username, 'Missed call', {
        //             chat_id: chatId.toString(),
        //             type: 'new_missed_call',
        //             call_id: call.id.toString(),
        //             ids: JSON.stringify([newMessage.id]),
        //             other_user: JSON.stringify(convertUserToSend(user))
        //         });
        //     }
        // }

        await client.query('COMMIT');
        isCommited = true;
    } finally {
        if (!isCommited) {
            await client.query('ROLLBACK');
        }
        client.release();
    }
}

export const onDeleteMessage = async (data, userId) => {
    const messageId = data.message_id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const messageToDelete = await messagesModel.getMessageById(messageId, userId, client);
        if (!messageToDelete || messageToDelete.sender_id != userId) {
            await client.query('ROLLBACK');
            return;
        }

        const chatId = messageToDelete.chat_id;
        const roomName = `${chatId}_chat_updates`;
        const lastTwoMessages = await messagesModel.getAllMessagesByChatId(chatId, userId, 2, null, client);

        await messagesModel.deleteMessageById(messageToDelete.id, client);

        const messageToSend = { ...messageToDelete };
        messageToSend['message'] = '_deleted_';
        if (messageToDelete.id != lastTwoMessages[0].id) {
            io.in(roomName).emit('deleted_message', {
                chat_id: chatId,
                message: messageToSend,
            });
        } else {
            const isChannel = (await channelsModel.getChannel(chatId, userId)) != null;

            const newLastMessage = lastTwoMessages[1];
            console.log(`delete_message, newLastMessage: ${newLastMessage}`);

            const deleteChat = newLastMessage == null && !isChannel;

            io.in(roomName).emit('deleted_message', {
                chat_id: chatId,
                message: messageToSend,
                new_last_message: newLastMessage,
                // when deletedMessage is the last from a channel, chat should not be deleted, but last_message should be
                // set to null. But if server send new_last_message: null, client treats it as there is no need to update
                // last_message. So if it was the last message from a channel, we send new_last_message: null and this field to true
                force_new_last_message: newLastMessage == null && isChannel,
                delete_chat: deleteChat,
            });

            if (deleteChat) {
                // deleted message is the last one from the chat
                await chatsModel.changeTempStatus(chatId, true, client);
            }
        }

        await client.query('COMMIT');
        console.log(`message deleted: ${messageId}, chatId: ${chatId}`);

        // sendNotification(otherUserId, '', '', {
        //     chat_id: chatId.toString(),
        //     type: 'cancel',
        //     ids: JSON.stringify([messageToDelete.id]),
        // });
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export const onMessageToAi = async (data, userId) => {
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
        console.log(`user '${userId}' just did failed attempt to subscribe on inaccessible for them chats: ${failedToValidateList}, all request ids: ${ids}, valid: ${validChatsIds}`);
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
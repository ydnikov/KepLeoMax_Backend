import * as chatsModel from '../models/chatsModel.js';
import * as messagesModel from '../models/messagesModel.js';
import * as usersModel from '../models/usersModel.js';
import * as onlinesModel from '../models/onlinesModel.js';
import { sendNotification } from '../services/notificationService.js';
import { ask } from './aiService.js';
import convertUserToSend from '../utills/convertUser.js';

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
    // TODO validate
    const chatId = data.chat_id;
    const readMessages = await messagesModel.readMessages(chatId, userId, data.time);
    if (readMessages.length > 0) {
        // TODO optimize
        const otherUserId = await chatsModel.getOtherUserIdByChatId(userId, chatId);
        sendReadEvents(io, chatId, readMessages[0].sender_id, userId, otherUserId, readMessages.map(obj => obj.id));
    }
}

export const onReadAll = async (io, data, userId) => {
    data.time = null;
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
    const message = data.message;
    if (isNaN(otherUserId) || !message) {
        onError('Event: onMessage, otherUserId or message is missing');
        return;
    }

    let chatId;
    let createdChatInfo = null;
    const chat = await chatsModel.getChatOfUsers([userId, otherUserId]);
    if (!chat) {
        console.log(`creating new chat between ${userId} and ${otherUserId}`);
        chatId = await chatsModel.createNewChat([userId, otherUserId]);
        createdChatInfo = { chat_id: chatId, users_ids: [userId, otherUserId] };
    } else {
        chatId = chat.id;
    }
    console.log(`chat id: ${chatId}, userId: ${userId}, otherUserId: ${otherUserId}`);
    const messageId = await messagesModel.createNewMessage(chatId, userId, message);
    const newMessage = await messagesModel.getMessageById(messageId);

    newMessage.is_current_user = true;
    newMessage.other_user_id = otherUserId;
    io.in(userId.toString()).emit('new_message', { message: newMessage, created_chat_info: createdChatInfo });
    newMessage.is_current_user = false;
    newMessage.other_user_id = Number(userId);
    io.in(otherUserId.toString()).emit('new_message', { message: newMessage, created_chat_info: createdChatInfo });
    console.log(`new message ${message} emitet to ${userId}, ${otherUserId}`);

    // read messages
    const readMessages = await messagesModel.readMessages(chatId, userId);
    if (readMessages.length > 0) {
        sendReadEvents(io, chatId, readMessages[0].sender_id, userId, otherUserId, readMessages.map(obj => obj.id));
    }

    // send notification
    const user = await usersModel.getUserById(userId);
    sendNotification(otherUserId, user.username, newMessage.message, {
        chat_id: chatId.toString(),
        type: 'new',
        ids: JSON.stringify([newMessage.id]),
        other_user: JSON.stringify(convertUserToSend(user))
    });
}

export const onDeleteMessage = async (io, data, userId) => {
    const messageId = data.message_id;
    if (isNaN(messageId)) {
        onError('Event: onDeleteMessage, int message_id is missing');
        return;
    }
    const messageToDelete = await messagesModel.getMessageById(messageId);
    if (!messageToDelete || messageToDelete.sender_id != userId) return;

    const chatId = messageToDelete.chat_id;
    const otherUserId = await chatsModel.getOtherUserIdByChatId(userId, chatId);
    if (!otherUserId) {
        onError('Event: onDeleteMessage, otherUser is not found');
        return;
    }
    const lastTwoMessages = await messagesModel.getAllMessagesByChatId(chatId, 2);

    await messagesModel.deleteMessageById(messageToDelete.id);

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
            await chatsModel.deleteChatById(chatId);
        }
    }

    sendNotification(otherUserId, '', '', {
        chat_id: chatId.toString(),
        type: 'cancel',
        ids: JSON.stringify([messageToDelete.id]),
    });
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
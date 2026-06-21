import * as chatsModel from '../models/chatsModel.js'
import * as usersModel from '../models/usersModel.js';
import convertUserToSend from '../utills/convertUser.js';
import * as messagesModel from '../models/messagesModel.js'
import * as channelsModel from '../models/channelsModel.js'

// TODO optimize
export const getChat = async (req, res) => {
    const userId = req.userId;
    const chatId = req.params.chatId?.trim();

    // get chat
    const chat = isNaN(Number(chatId)) ? await channelsModel.getChannelByTag(chatId) : await chatsModel.getChatById(chatId);
    if (!chat) {
        return res.status(404).json({ message: `Chat with id ${chatId} was not found` });
    } else if (!chat.is_channel && !(chat.user_ids?.includes(userId) ?? false)) {
        return res.status(403).json({ message: `User has no permission to this chat` });
    }

    const isChannel = chat.is_channel;

    // set other_user OR role
    var otherUser;
    if (!isChannel) {
        otherUser = convertUserToSend(await usersModel.getUserById(chat.user_ids.filter(id => id != userId)[0]), req);
        delete chat.user_ids;
        chat.other_user = otherUser;
    } else {
        chat.role = chat.owner_id === userId ? 'owner' :
            (await channelsModel.isUserSubscribed(userId, chat.id)) ? 'subscriber' : 'none';
        delete chat.owner_id;
    }

    // set last_message
    const lastMessage = (await messagesModel.getAllMessagesByChatId(chat.id, userId, 1, null))[0];

    // set unread_count
    if (lastMessage) {
        if (!isChannel) {
            const senderUser = lastMessage.sender_id === userId ? convertUserToSend(await usersModel.getUserById(lastMessage.sender_id), req) : otherUser;
            lastMessage.user = senderUser;
        } else {
            lastMessage.user = convertUserToSend(await usersModel.getUserById(lastMessage.sender_id), req);
        }

        chat.last_message = lastMessage;
        if (lastMessage.sender_id === userId) {
            chat.unread_count = 0;
        } else {
            chat.unread_count = await messagesModel.getUnreadCount(chat.id, userId);
        }
    } else {
        chat.last_message = null;
        chat.unread_count = 0;
    }

    return res.status(200).json({ data: chat });
}

export const getChats = async (req, res) => {
    const userId = req.userId;

    // get chats
    const chats = await chatsModel.getAllChatsByUserId(userId);

    // TODO optimize
    // set additional values
    for (let i = 0; i < chats.length; i++) {
        // set other_user
        const otherUser = await usersModel.getUserById(chats[i].other_user_id);
        delete chats[i].otherUserId;
        if (otherUser) {
            chats[i].other_user = convertUserToSend(otherUser, req);
        } else {
            chats[i].other_user = null;
        }

        // set last_message
        const lastMessage = (await messagesModel.getAllMessagesByChatId(chats[i].id, userId, 1, null))[0];

        // set unread_count
        if (lastMessage) {
            const user = await usersModel.getUserById(lastMessage.sender_id);
            lastMessage.user = convertUserToSend(user, req);
            chats[i].last_message = lastMessage;
            if (lastMessage.sender_id === userId) {
                chats[i].unread_count = 0;
            } else {
                chats[i].unread_count = await messagesModel.getUnreadCount(chats[i].id, userId);
            }
        } else {
            chats[i].last_message = null;
            chats[i].unread_count = 0;
        }

        // delete channel fields if it's not a channel
        if (!chats[i].is_channel) {
            delete chats[i].owner_id;
            delete chats[i].channel_name;
            delete chats[i].image_url;
            delete chats[i].is_official;
        } else {
            chats[i].role = chats[i].owner_id === userId ? 'owner' : 'subscriber';
            delete chats[i].owner_id;
        }
    }
    chats.sort((a, b) => (b.last_message?.created_at ?? b.created_at ?? 0) - (a.last_message?.created_at ?? a.created_at ?? 0));

    return res.status(200).json({ data: chats });
}

// !!! it doesn't return last_message and unread_count
export const getChatWithUser = async (req, res) => {
    const userId = req.userId;
    const otherUserId = req.query.userId;

    // get chat
    const chat = await chatsModel.getChatOfUsers(userId, otherUserId);
    if (!chat) {
        return res.status(404).json({ message: `chat with user ${otherUserId} not found` });
    } else {
        chat.other_user = convertUserToSend((await usersModel.getUserById(otherUserId)), req);
        chat.unread_count = 0;
        return res.status(200).json({ data: chat });
    }
}
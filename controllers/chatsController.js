import * as chatsModel from '../models/chatsModel.js'
import * as usersModel from '../models/usersModel.js';
import convertUserToSend from '../utills/convertUser.js';
import * as messagesModel from '../models/messagesModel.js'

export const getChat = async (req, res) => {
    const userId = req.userId;
    const chatId = req.query.chatId?.trim();

    // get chat
    const chat = await chatsModel.getChatById(chatId);
    if (!chat) {
        return res.status(404).json({ message: `chat with id ${chatId} not found` });
    } else if (!chat.user_ids.includes(userId)) {
        return res.status(403).json({ message: `user has no permission to this chat` });
    }

    // set other_user
    const otherUser = convertUserToSend(await usersModel.getUserById(chat.user_ids.filter(id => id != userId)[0]), req);
    chat.user_ids = undefined;
    chat.other_user = otherUser;

    // set last_message
    const lastMessage = (await messagesModel.getAllMessagesByChatId(chat.id, 1, null))[0];

    // set unread_count
    if (lastMessage) {
        const senderUser = lastMessage.sender_id === otherUser.id ? otherUser : convertUserToSend(await usersModel.getUserById(lastMessage.sender_id), req);
        lastMessage.user = senderUser;
        chat.last_message = lastMessage;
        if (lastMessage.sender_id === userId) {
            chat.unread_count = 0;
        } else {
            chat.unread_count = await messagesModel.getUnreadCount(chat.id);
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

    // set additional values
    for (let i = 0; i < chats.length; i++) {
        // set other_user
        const otherUser = await usersModel.getUserById(chats[i].other_user_id);
        chats[i].otherUserId = undefined;
        chats[i].other_user = convertUserToSend(otherUser, req);

        // set last_message
        const lastMessage = (await messagesModel.getAllMessagesByChatId(chats[i].id, 1, null))[0];

        // set unread_count
        if (lastMessage) {
            const user = await usersModel.getUserById(lastMessage.sender_id);
            lastMessage.user = convertUserToSend(user, req);
            chats[i].last_message = lastMessage;
            if (lastMessage.sender_id === userId) {
                chats[i].unread_count = 0;
            } else {
                chats[i].unread_count = await messagesModel.getUnreadCount(chats[i].id);
            }
        } else {
            chats[i].last_message = null;
            chats[i].unread_count = 0;
        }
    }
    chats.sort((a, b) => (b.last_message?.created_at ?? 0) - (a.last_message?.created_at ?? 0));

    return res.status(200).json({ data: chats });
}

// !!! it doesn't return last_message and unread_count
export const getChatWithUser = async (req, res) => {
    const userId = req.userId;
    const otherUserId = req.query.userId;

    // get chat
    const chat = await chatsModel.getChatOfUsers([userId, otherUserId]);
    if (!chat) {
        return res.status(404).json({ message: `chat with user ${otherUserId} not found` });
    } else {
        chat.other_user = convertUserToSend((await usersModel.getUserById(otherUserId)), req);
        chat.unread_count = 0;
        return res.status(200).json({ data: chat });
    }
}
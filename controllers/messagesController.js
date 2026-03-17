import * as messagesModel from '../models/messagesModel.js'
import * as chatsModel from '../models/chatsModel.js'

export const getMessagesByChatId = async (req, res) => {
    const userId = req.userId;
    const chatId = req.query.chatId;
    const limit = req.query.limit;
    const cursor = req.query.cursor; // int, messageId

    const chat = await chatsModel.getChatById(chatId);
    if (!chat.user_ids.includes(userId)) {
        return res.sendStatus(403);
    }

    // get messages
    const messages = await messagesModel.getAllMessagesByChatId(chatId, limit, cursor);
    messages.forEach(message => {
        message.is_current_user = message.sender_id === userId;
    });
    
    return res.status(200).json({ data: messages, limit: limit, cursor: cursor });
}
import * as messagesModel from '../models/messagesModel.js'
import * as chatsModel from '../models/chatsModel.js'

export const getMessagesByChatId = async (req, res) => {
    const userId = req.userId;
    const chatId = req.query.chatId?.trim();
    const limit = req.query.limit?.trim() ?? 1000;
    const cursor = req.query.cursor?.trim(); // int, messageId

    // validataions
    if (!chatId) {
        return res.status(400).json({ message: 'chatId param is required' });
    } else if (isNaN(chatId)) {
        return res.status(400).json({ message: 'chatId must be int' });
    } else if (isNaN(limit)) {
        return res.status(400).json({ message: 'limit must be int' });
    } else if (cursor && isNaN(cursor)) {
        return res.status(400).json({ message: 'cursor must be int' });
    }
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
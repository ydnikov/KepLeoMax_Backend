import pool from "../db.js";

export const createNewChat = async (userIds) => {
    let chatId;
    for (const userId of userIds) {
        if (!chatId) {
            const result = await pool.query('INSERT INTO chats (user_id) VALUES ($1) RETURNING chat_id', [userId]);
            chatId = result.rows[0].chat_id;
        } else {
            await pool.query('INSERT INTO chats (user_id, chat_id) VALUES ($1, $2)', [userId, chatId]);
        }
    }
    return chatId;
}

export const getChatById = async (chatId) => {
    const result = await pool.query('SELECT * FROM chats WHERE chat_id = $1', [chatId]);
    if (result.rows.length === 0) {
        return null;
    } else {
        const chat = {
            id: Number(chatId),
            user_ids: result.rows.map(row => row.user_id)
        };
        return chat;
    }
}

// chat must contain only 2 users for this to works correctly
export const getOtherUserIdByChatId = async (userId, chatId) => {
    const result = await pool.query('SELECT * FROM chats WHERE chat_id = $1 AND user_id != $2', [chatId, userId]);
    if (result.rowCount > 1) {
        // chat doesn't contain provided userId
        return null;
    }
    return result.rows[0]?.user_id;
}

// chat must contain only 2 users for this to works correctly
export const getAllChatsByUserId = async (userId) => {
    const result = await pool.query('SELECT t1.*, t2.user_id as other_user_id FROM (SELECT * FROM chats WHERE user_id = $1) AS t1 INNER JOIN chats AS t2 ON t1.chat_id = t2.chat_id', [userId]);
    // do it in query?
    result.rows.forEach(row => {
        row.id = row.chat_id;
        row.chat_id = undefined;
    });
    return result.rows.filter(row => row.other_user_id != userId);
}

// TODO make arguments userId1, userId2 insead of userIds
// userIds length must be 2
export const getChatOfUsers = async (userIds) => {
    const result = await pool.query('SELECT t1.*, t2.* FROM (SELECT * FROM chats WHERE user_id = $1) AS t1 INNER JOIN chats AS t2 ON t2.chat_id = t1.chat_id AND t2.user_id = $2', [userIds[0], userIds[1]]);
    if (result.rows.length === 0) {
        return null;
    } else {
        // TODO id and chat_id are both passed, and they are the same, why?
        result.rows[0].id = result.rows[0].chat_id;
        result.rows[0].user_id = undefined;
        return result.rows[0];
    }
}

export const deleteChatById = async (chatId) => {
    await pool.query('DELETE FROM chats WHERE chat_id = $1', [chatId]);
}
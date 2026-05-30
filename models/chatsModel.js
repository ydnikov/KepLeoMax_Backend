import pool from "../db.js";

export const createNewChat = async (userId1, userId2, client = pool) => {
    const result = await client.query(`
        WITH new_chat AS (
            INSERT INTO chats (user_id) 
            VALUES ($1) 
            RETURNING chat_id
        )
        INSERT INTO chats (user_id, chat_id) SELECT $2, chat_id FROM new_chat
        RETURNING chat_id
    `, [userId1, userId2]);

    return result.rows[0].chat_id;
}

// TODO optimize
export const getChatById = async (chatId) => {
    const channelResult = await pool.query('SELECT * FROM channels WHERE id = $1', [chatId]);
    if (channelResult.rows.length > 0) {
        channelResult.rows[0].is_channel = true;
        return channelResult.rows[0];
    }

    const result = await pool.query('SELECT * FROM chats WHERE chat_id = $1', [chatId]);
    if (result.rows.length === 0) {
        return null;
    } else {
        const chat = {
            id: Number(chatId),
            user_ids: result.rows.map(row => row.user_id),
            is_channel: false
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

export const getAllChatsByUserId = async (userId) => {
    const result = await pool.query(`
        SELECT t1.chat_id as id, t2.user_id as other_user_id, t3.channel_name, t3.owner_id, t3.image_url, t3.is_official, t3.created_at, t3.description, t3.tag
            FROM (SELECT * FROM chats WHERE user_id = $1) AS t1 
        LEFT JOIN chats AS t2 ON t1.chat_id = t2.chat_id AND t2.user_id != $1
        LEFT JOIN channels AS t3 ON t1.chat_id = t3.id
        `, [userId]);
    return result.rows;
}

export const getChatOfUsers = async (userId1, userId2, client = pool) => {
    const result = await client.query('SELECT t1.*, t2.* FROM (SELECT * FROM chats WHERE user_id = $1) AS t1 INNER JOIN chats AS t2 ON t2.chat_id = t1.chat_id AND t2.user_id = $2', [userId1, userId2]);
    if (result.rows.length === 0) {
        return null;
    } else {
        const chat = result.rows[0];
        chat.id = chat.chat_id;
        chat.chat_id = undefined;
        chat.user_id = undefined;
        chat.row_id = undefined;
        return chat;
    }
}

export const deleteChatById = async (chatId, client = pool) => {
    await client.query('DELETE FROM chats WHERE chat_id = $1', [chatId]);
}
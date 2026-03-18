import pool from "../db.js";
import { decrypt, encrypt } from "../services/encryptionService.js";

export const createNewMessage = async (chatId, senderId, message, type, isRead) => {
    const encryptedMessage = encrypt(message);
    const result = await pool.query('INSERT INTO messages (chat_id, sender_id, message, type, is_read, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [chatId, senderId, encryptedMessage, type ?? 'message', isRead ?? false, Date.now()]);
    return result.rows[0].id;
}

export const deleteMessageById = async (messageId) => {
    await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
}

export const getMessageById = async (id) => {
    const result = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
    if (result.rows.length === 0) {
        return null;
    } else {
        result.rows[0].message = decrypt(result.rows[0].message);
        return result.rows[0];
    }
}

export const getAllMessagesByChatId = async (chatId, limit, cursor) => {
    const result = await pool.query('SELECT * FROM messages WHERE chat_id = $1 AND id < $2 ORDER BY created_at DESC LIMIT $3', [chatId, cursor ?? Math.pow(2, 31) - 1, limit]);
    if (result.rows.length == 0) return [];

    let rows;
    // load more messages until first is_read = true
    // limit > 1 cause this method is called for get last message of the chat with the limit 1
    if (!result.rows[result.rows.length - 1].is_read && limit > 1) {
        const result2 = await pool.query(`
            SELECT * FROM messages
            WHERE chat_id = $1 AND id < $2 AND id >= (SELECT id FROM messages WHERE chat_id = $1 AND is_read = TRUE ORDER BY created_at DESC LIMIT 1) 
            ORDER BY created_at DESC
        `, [chatId, result.rows[result.rows.length - 1].id]);
        rows = [...result.rows, ...result2.rows];
    } else {
        rows = result.rows;
    }
    
    for (let i = 0; i < rows.length; i++) {
        rows[i].message = decrypt(rows[i].message);
    }
    return rows;
}

export const setMessageIsRead = async (messageId) => {
    await pool.query('UPDATE messages SET is_read = TRUE WHERE id = $1', [messageId]);
}

export const getUnreadCount = async (chatId) => {
    const result = await pool.query('SELECT COUNT(*) FROM messages WHERE chat_id = $1 AND is_read = FALSE', [chatId]);
    return Number(result.rows[0].count);
}

export const readMessages = async (chatId, currentUser, time) => {
    const result = await pool.query('UPDATE messages SET is_read = TRUE WHERE chat_id = $1 AND sender_id != $2 AND created_at <= $3 AND is_read IS DISTINCT FROM TRUE RETURNING id, sender_id', [chatId, currentUser, time ?? Date.now()]);
    return result.rows;
}
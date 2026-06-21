import pool from "../db.js";
import { decrypt, encrypt } from "../services/encryptionService.js";

// TODO optimize
export const createNewMessage = async (chatId, senderId, message, type, isRead, client = pool) => {
    const encryptedMessage = encrypt(message);
    const result = await client.query('INSERT INTO messages (chat_id, sender_id, message, type, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *', [chatId, senderId, encryptedMessage, type ?? 'message', Date.now()]);

    const newMessage = result.rows[0];
    newMessage.message = message;
    newMessage.is_read = isRead ?? false;
    newMessage.views_count = isRead ? 1 : 0;

    /// TODO it's not working as it should be, user_id can't be sender, sender can't read its own message
    if (isRead) {
        await client.query('INSERT INTO messages_read_statuses (message_id, user_id) VALUES ($1, $2)', [newMessage.id, senderId]);
    }

    return newMessage;
}

export const deleteMessageById = async (messageId, client = pool) => {
    await client.query('DELETE FROM messages WHERE id = $1', [messageId]);
}

export const getMessageById = async (id, userId, client = pool) => {
    const result = await client.query(`
        SELECT m.*, (read_status.message_id IS NOT NULL) AS is_read, 
        (SELECT COUNT(1)::int FROM messages_read_statuses WHERE message_id = $1) AS views_count
        FROM messages AS m 
        LEFT JOIN messages_read_statuses AS read_status ON m.id = read_status.message_id AND read_status.user_id = $2
        WHERE m.id = $1
    `, [id, userId]);
    if (result.rows.length === 0) {
        return null;
    } else {
        result.rows[0].message = decrypt(result.rows[0].message);
        return result.rows[0];
    }
}

export const getAllMessagesByChatId = async (chatId, userId, limit, cursor, client = pool) => {
    const result = await client.query(`
        SELECT m.*, (read_status.message_id IS NOT NULL) AS is_read, COALESCE(views_counter.count::int, 0) AS views_count 
        FROM messages AS m
        LEFT JOIN messages_read_statuses AS read_status ON m.id = read_status.message_id AND read_status.user_id = $2
        LEFT JOIN (
            SELECT message_id, COUNT(1) AS count
            FROM messages_read_statuses
            WHERE message_id IN (
                SELECT id FROM messages
                WHERE chat_id = $1 AND id < $3
                ORDER BY created_at DESC LIMIT $4
            )
            GROUP BY message_id
        ) AS views_counter ON m.id = views_counter.message_id
        WHERE m.chat_id = $1 AND m.id < $3
        ORDER BY m.created_at DESC
        LIMIT $4
    `, [chatId, userId, cursor ?? Math.pow(2, 31) - 1, limit]
    );
    // const result = await pool.query(
    //     'SELECT * FROM messages WHERE chat_id = $1 AND id < $2 ORDER BY created_at DESC LIMIT $3', 
    //     [chatId, cursor ?? Math.pow(2, 31) - 1, limit],
    // );
    if (result.rows.length == 0) return [];

    let rows;
    // TODO fix
    // load more messages until first is_read = true
    // limit > 1 cause this method is called for get last message of the chat with the limit 1 TODO make better
    // if (!result.rows[result.rows.length - 1].is_read && limit > 1) {
    //     const result2 = await client.query(`
    //         SELECT * FROM messages
    //         WHERE chat_id = $1 AND id < $2 AND id >= (SELECT id FROM messages WHERE chat_id = $1 AND is_read = TRUE ORDER BY created_at DESC LIMIT 1) 
    //         ORDER BY created_at DESC
    //     `, [chatId, result.rows[result.rows.length - 1].id]);
    //     rows = [...result.rows, ...result2.rows];
    // } else {
    //     rows = result.rows;
    // }
    rows = result.rows;

    for (let i = 0; i < rows.length; i++) {
        rows[i].message = decrypt(rows[i].message);
    }
    return rows;
}

export const getUnreadCount = async (chatId, userId) => {
    const result = await pool.query(`
        SELECT COUNT(1)::int AS unread_count
        FROM messages AS m
        LEFT JOIN messages_read_statuses AS read_status ON m.id = read_status.message_id AND read_status.user_id = $2
        WHERE m.chat_id = $1 AND m.sender_id != $2 AND read_status.message_id IS NULL
    `, [chatId, userId]);

    return result.rows[0].unread_count;
}

export const readMessages = async (chatId, userId, time, client = pool) => {
    const result = await client.query(`
        WITH unread_messages AS (
            SELECT m.*
            FROM messages AS m
            LEFT JOIN messages_read_statuses AS read_status ON m.id = read_status.message_id AND read_status.user_id = $2
            WHERE m.chat_id = $1 AND m.sender_id != $2 AND m.created_at <= $3 AND read_status.message_id IS NULL
        ),
        inserted_statuses AS (
            INSERT INTO messages_read_statuses (message_id, user_id)
            SELECT id, $2 FROM unread_messages
            ON CONFLICT (message_id, user_id) DO NOTHING
        )
        SELECT id, sender_id, TRUE as is_read FROM unread_messages
    `, [chatId, userId, time]);

    return result.rows;
}

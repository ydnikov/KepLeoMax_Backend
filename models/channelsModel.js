import pool from "../db.js";

export const createNewChannel = async (ownerId, name, description, tag, imageUrl) => {
    const connection = await pool.connect();

    await connection.query('BEGIN');

    try {
        const chatResult = await connection.query('INSERT INTO chats (user_id) VALUES ($1) RETURNING chat_id', [ownerId]);
        const chatId = chatResult.rows[0].chat_id;
        const result = await connection.query('INSERT INTO channels (id, owner_id, channel_name, description, tag, image_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [chatId, ownerId, name, description, tag, imageUrl, Date.now()]);

        await connection.query('COMMIT');

        return result.rows[0];
    } catch (e) {
        await connection.query('ROLLBACK');
        throw e;
    }
}

export const editChannel = async (channelId, userId, name, description, tag, imageUrl) => {
    const result = await pool.query('UPDATE channels SET channel_name = $3, description = $4, tag = $5, image_url = $6 WHERE id = $1 AND owner_id = $2 RETURNING *', [channelId, userId, name, description, tag, imageUrl]);
    if (result.rowCount === 0) {
        const channel = await getChannel(channelId);
        if (!channel) return 404;
        return 403;
    }

    return result.rows[0];
}

export const getChannel = async (channelId) => {
    const result = await pool.query('SELECT * FROM channels WHERE id = $1', [channelId]);
    return result.rows[0];
}

export const getSubscribersCount = async (channelId) => {
    const result = await pool.query('SELECT COUNT(*) FROM chats WHERE chat_id = $1', [channelId]);
    return result.rows[0].count;
}

export const getSubscribers = async (channelId, limit, cursor) => {
    const result = await pool.query(`
        SELECT t2.* 
        FROM (
            SELECT user_id FROM chats WHERE chat_id = $1 AND user_id > $3
            ORDER BY user_id ASC LIMIT $2
        ) AS t1   
        LEFT JOIN users AS t2 ON t1.user_id = t2.id
        `, [channelId, limit, cursor]);
    return result.rows;
}

export const subscribe = async (userId, channelId) => {
    const result = await pool.query(`
        INSERT INTO chats (user_id, chat_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, chat_id) DO NOTHING
        RETURNING 1
    `, [userId, channelId]);
    return result.rowCount === 1;
}

export const unsubscribe = async (userId, channelId) => {
    const result = await pool.query('DELETE FROM chats WHERE user_id = $1 AND chat_id = $2', [userId, channelId]);
    return result.rowCount === 1;
}
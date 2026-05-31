import pool from "../db.js";

/**
client channelModel:
    int id,
    String channel_name,
    String description,
    String? image,
    bool is_official,
    Enum(owner, subscriber, none, keep_current) role,
    String tag,
    int? subs_count

is_channel must be true
NEVER SEND owner_id to the client
*/
export const createNewChannel = async (ownerId, name, description, tag, image) => {
    const result = await pool.query(`
        WITH inserted_chat AS (
            INSERT INTO chats (user_id, created_at) VALUES ($1, $2) RETURNING chat_id
        )
        INSERT INTO channels (id, owner_id, channel_name, description, tag, image, created_at)
            SELECT chat.chat_id, $1, $3, $4, $5, $6, $2 
        FROM inserted_chat AS chat RETURNING *
    `, [ownerId, Date.now(), name, description, tag, image]);


    const channel = result.rows[0];
    channel.is_channel = true;
    channel.subs_count = 1;
    channel.role = 'owner';
    delete channel.owner_id;
    return result.rows[0];
}

export const editChannel = async (channelId, userId, name, description, tag, image) => {
    const args = [channelId, userId, name, description, tag];
    // check !== undefined, cause image can be null and that will be another logic
    if (image !== undefined) args.push(image);
    const result = await pool.query(`
        WITH updated_channel AS (
            UPDATE channels 
            SET channel_name = $3, description = $4, tag = $5${image !== undefined ? ', image = $6' : ' '} 
            WHERE id = $1 AND owner_id = $2 
            RETURNING *
        )
        SELECT channel.*, (
            SELECT COUNT(1)::int FROM chats WHERE chat_id = $1
        ) AS subs_count
        FROM updated_channel AS channel
        `, args);

    if (result.rowCount === 0) {
        const channel = await pool.query('SELECT 1 FROM channels WHERE id = $1', [channelId]);
        if (channel.rowCount === 0) return 404;
        return 403;
    }

    const channel = result.rows[0];
    channel.is_channel = true;
    channel.role = 'owner';
    delete channel.owner_id;
    return channel;
}

// @note doesn't return the role
export const getChannel = async (channelId) => {
    const result = await pool.query('SELECT *, (SELECT COUNT(1)::int FROM chats WHERE chat_id = $1) as subs_count FROM channels WHERE id = $1', [channelId]);

    const channel = result.rows[0];
    if (!channel) return null;

    channel.is_channel = true;
    return channel;
}

// @note doesn't return the role
export const getChannelByTag = async (tag) => {
    const result = await pool.query('SELECT t1.*, (SELECT COUNT(1)::int FROM chats WHERE chat_id = t1.id) as subs_count FROM channels AS t1 WHERE tag = $1', [tag]);

    const channel = result.rows[0];
    if (!channel) return null;

    channel.is_channel = true;
    return channel;
}

export const deleteChannel = async (channelId, userId) => {
    const result = await pool.query(`
        WITH deleted AS (
            DELETE FROM channels WHERE id = $1 AND owner_id = $2 RETURNING id
        )
        DELETE FROM chats WHERE chat_id = (SELECT id FROM deleted) RETURNING *
    `, [channelId, userId]);

    if (result.rowCount === 0) {
        const channelResult = await pool.query('SELECT FROM channels WHERE id = $1', [channelId]);
        if (channelResult.rowCount > 0) return 403;
        return 404;
    }

    return result.rows.map(row => row.user_id);
}

export const checkUserIsOwner = async (channelId, userId) => {
    const result = await pool.query('SELECT owner_id FROM channels WHERE id = $1', [channelId]);
    if (result.rowCount === 0) {
        return 404;
    } else if (result.rows[0].owner_id !== userId) {
        return 403;
    }

    return 200;
}

export const getSubscribersCount = async (channelId) => {
    const result = await pool.query('SELECT COUNT(1)::int FROM chats WHERE chat_id = $1', [channelId]);
    return result.rows[0].count;
}

export const getSubscribers = async (channelId, limit, cursor) => {
    const result = await pool.query(`
        SELECT t2.*, (SELECT COUNT(1)::int FROM chats WHERE chat_id = $1) AS total_count
        FROM (
            SELECT user_id
            FROM chats 
            WHERE chat_id = $1 AND user_id > $3
            ORDER BY user_id ASC
            LIMIT $2
        ) AS t1   
        LEFT JOIN users AS t2 ON t1.user_id = t2.id
        `, [channelId, limit, cursor]);
    return result.rows;
}

export const isUserSubscribed = async (userId, channelId) => {
    const result = await pool.query('SELECT FROM chats WHERE user_id = $1 AND chat_id = $2', [userId, channelId]);
    return result.rowCount > 0;
}

export const subscribe = async (userId, channelId) => {
    const result = await pool.query(`
        INSERT INTO chats (user_id, chat_id, created_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, chat_id) DO NOTHING
        RETURNING 1
    `, [userId, channelId, Date.now()]);
    return result.rowCount === 1;
}

// TODO check that userId is not owner
export const unsubscribe = async (userId, channelId) => {
    const result = await pool.query('DELETE FROM chats WHERE user_id = $1 AND chat_id = $2', [userId, channelId]);
    return result.rowCount === 1;
}
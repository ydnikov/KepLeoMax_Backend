import pool from "../db.js";

export const createNewChat = async (userId1, userId2, temp, client = pool) => {
    const result = await client.query(`
        WITH new_chat AS (
            INSERT INTO chats (user_id, created_at, temp) 
            VALUES ($1, $3, $4) 
            RETURNING chat_id
        )
        INSERT INTO chats (user_id, chat_id, created_at, temp) SELECT $2, chat_id, $3, $4 FROM new_chat
        RETURNING chat_id
    `, [userId1, userId2, Date.now(), temp]);

    return result.rows[0].chat_id;
}

export const changeTempStatus = async (chatId, temp, client = pool) => {
    const createdAt = Date.now();

    await client.query(
        'UPDATE chats SET temp = $2, created_at = CASE WHEN $2 THEN $3 ELSE created_at END WHERE chat_id = $1',
        [chatId, temp, createdAt]);

    return createdAt;
}

// TODO optimize, add isChannel bool? value, if null - unknown status, if not null - will be easier to find what's needed
export const getChatById = async (chatId, client = pool) => {
    const channelResult = await client.query('SELECT * FROM channels WHERE id = $1', [chatId]);
    if (channelResult.rows.length > 0) {
        const channel = channelResult.rows[0];
        channel.is_channel = true;
        
        return channel;
    }

    const result = await client.query('SELECT * FROM chats WHERE chat_id = $1', [chatId]);
    if (result.rows.length === 0) {
        return null;
    } else {
        const chat = {
            id: Number(chatId),
            user_ids: result.rows.map(row => row.user_id),
            created_at: Math.min(...result.rows.map(row => row.created_at)),
            is_channel: false,
            temp: result.rows[0].temp
        };
        return chat;
    }
}

// chat must contain only 2 users for this to works correctly
export const getOtherUserIdByChatId = async (userId, chatId, client = pool) => {
    const result = await client.query('SELECT * FROM chats WHERE chat_id = $1 AND user_id != $2', [chatId, userId]);
    if (result.rowCount > 1) {
        // chat doesn't contain provided userId
        return null;
    }
    return result.rows[0]?.user_id;
}

export const getAllChatsByUserId = async (userId) => {
    const result = await pool.query(`
        SELECT
            DISTINCT ON (t1.chat_id)
            t1.chat_id as id, t1.created_at, t2.user_id as other_user_id, t3.channel_name, t3.owner_id, t3.image, t3.is_official, t3.description, t3.tag, t3.subs_count, t3.channel_created_at
        FROM (SELECT * FROM chats WHERE user_id = $1) AS t1 
        LEFT JOIN chats AS t2 ON t1.chat_id = t2.chat_id AND t2.user_id != $1
        LEFT JOIN channels AS t3 ON t1.chat_id = t3.id
        WHERE t1.temp != TRUE
        `, [userId]);

    result.rows.forEach(chat => {
        chat.is_channel = !!chat.channel_name;
        if (!chat.is_channel) {
            delete chat.channel_name;
            delete chat.owner_id;
            delete chat.image;
            delete chat.is_official;
            delete chat.description;
            delete chat.tag;
            delete chat.channel_created_at;
        }
    });

    return result.rows;
}

export const getChatOfUsers = async (userId1, userId2, client = pool) => {
    const result = await client.query(`
        SELECT * FROM chats
        WHERE user_id = $1 
            AND chat_id IN (
                SELECT c.chat_id FROM chats AS c
                LEFT JOIN channels AS ch ON c.chat_id = ch.id 
                WHERE c.user_id IN ($1, $2) AND ch.id IS NULL
                GROUP BY c.chat_id
                HAVING COUNT(DISTINCT c.user_id) = 2 AND COUNT(1) = 2
            )
    `, [userId1, userId2]);
    if (result.rows.length === 0) {
        return null;
    } else {
        console.log(`finded chats: ${JSON.stringify(result.rows)}`);
        const chat = result.rows[0];
        chat.id = chat.chat_id;
        delete chat.chat_id;
        delete chat.user_id;
        delete chat.row_id;
        return chat;
    }
}

export const deleteChatWithMessages = async (chatId, userId) => {
    const result = await pool.query(`
        WITH checked_access AS (
            SELECT 1 FROM chats 
            WHERE chat_id = $1 AND user_id = $2
        ),
        deleted_chats AS (
            UPDATE chats SET temp = TRUE 
            WHERE chat_id = $1 AND EXISTS (SELECT 1 FROM checked_access)
            RETURNING chat_id
        )
        DELETE FROM messages WHERE chat_id = $1 AND EXISTS (SELECT 1 FROM checked_access)
        RETURNING (SELECT COUNT(*) FROM checked_access) as has_access
    `, [chatId, userId]);

    if (result.rows.length === 0 || result.rows[0].has_access !== 1) {
        return { success: false, code: 403 };
    }

    return { success: true, code: 200 }
}

export const validateAvailableChatsForUser = async (chatIds, userId) => {
    if (chatIds.length === 0) return [];

    const result = await pool.query(`
        SELECT DISTINCT chat_id 
        FROM chats 
        WHERE chat_id = ANY($2) 
            AND (   
                user_id = $1
                OR EXISTS (SELECT 1 FROM channels WHERE channels.id = chats.chat_id)
            )
        `, [userId, chatIds]);

    return result.rows.map(row => row.chat_id);
}
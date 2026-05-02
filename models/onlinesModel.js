import pool from "../db.js";

export const addUser = async (userId, client = pool) => {
    await client.query('INSERT INTO onlines (user_id, is_online, last_activity_time) VALUES ($1, $2, $3)', [userId, false, Date.now()]);
}

// it also updates last_activity_time to Date.now()
export const updateOnlineStatus = async (userId, isOnline, client = pool) => {
    const result = await client.query('UPDATE onlines SET is_online = $2, last_activity_time = $3 WHERE user_id = $1 RETURNING *', [userId, isOnline, Date.now()]);
    if (result.rows[0])
        return result.rows[0];
    else {
        await addUser(userId, client);
        return await updateOnlineStatus(userId, isOnline, client);
    }
}

export const updateLastActivityTime = async (userId, lastActivityTime, client = pool) => {
    const result = await client.query('UPDATE onlines SET last_activity_time = $2 WHERE user_id = $1 RETURNING *', [userId, lastActivityTime]);
    if (result.rows[0])
        return result.rows[0];
    else {
        await addUser(userId, client);
        return await updateLastActivityTime(userId, lastActivityTime, client);
    }
}

export const getByUserId = async (userId) => {
    const result = await pool.query('SELECT * FROM onlines WHERE user_id = $1', [userId])
    return result.rows[0];
}
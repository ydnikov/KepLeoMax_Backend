import pool from "../db.js"

export const addFCMToken = async (userId, token) => {
    await pool.query('INSERT INTO fcm_tokens (user_id, fcm_token) VALUES ($1, $2) ON CONFLICT (fcm_token) DO UPDATE SET user_id = $1', [userId, token]);
}

// @returns {number} HTTP status
export const deleteFCMToken = async (userId, token) => {
    const result = await pool.query('DELETE FROM fcm_tokens WHERE user_id = $1 AND fcm_token = $2', [userId, token]);
    if (result.rowCount === 1) {
        // rowCount can be either 0 or 1, because fcm_token is a unique row
        return 200;
    }

    const tokenRows = await pool.query('SELECT * FROM fcm_tokens WHERE fcm_token = $1', [token]);
    if (tokenRows.rowCount === 0) {
        return 404;
    } else {
        return 403;
    }
}

export const deleteFCMTokenById = async (id) => {
    await pool.query('DELETE FROM fcm_tokens WHERE id = $1', [id]);
}

export const getAllTokensByUserId = async (userId) => {
    return (await pool.query('SELECT * FROM fcm_tokens WHERE user_id = $1', [userId])).rows;
}
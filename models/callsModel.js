import pool from "../db.js";

// base methods
export const insertNewCall = async (callerId, answererId, isMissed = false) => {
    const result = await pool.query('INSERT INTO calls (caller_id, answerer_id, created_at, end_time) VALUES ($1, $2, $3, $4) RETURNING *', [callerId, answererId, Date.now(), isMissed ? Date.now() : null]);
    return result.rows[0];
}

export const getCallById = async (id) => {
    const result = await pool.query('SELECT * FROM CALLS WHERE id = $1', [id]);
    return result.rows[0];
}

// getters by user
export const getActiveOrPendingCallOfUser = async (userId) => {
    const result = await pool.query('SELECT * FROM calls WHERE (caller_id = $1 OR answerer_id = $1) AND end_time IS NULL ORDER BY created_at LIMIT 1', [userId]);
    return result.rows[0];
}

// getters by users
export const getActiveCallOfUsers = async (callerId, answererId) => {
    const result = await pool.query('SELECT * FROM calls WHERE caller_id = $1 AND answerer_id = $2 AND start_time IS NOT NULL AND end_time IS NULL ORDER BY created_at DESC LIMIT 1', [callerId, answererId]);
    return result.rows[0];
}

export const getPendingCallOfUsers = async (callerId, answererId) => {
    const result = await pool.query('SELECT * FROM calls WHERE caller_id = $1 AND answerer_id = $2 AND start_time IS NULL AND end_time IS NULL ORDER BY created_at DESC LIMIT 1', [callerId, answererId]);
    return result.rows[0];
}

export const getLastCallOfUsers = async (userId1, userId2) => {
    const result = await pool.query('SELECT * FROM calls WHERE (caller_id = $1 OR caller_id = $2) AND (answerer_id = $1 OR answerer_id = $2) ORDER BY created_at DESC LIMIT 1', [userId1, userId2]);
    return result.rows[0];
}

// setters
export const setStartTime = async (callId) => {
    const startTime = Date.now();
    await pool.query('UPDATE calls SET start_time = $2 WHERE id = $1', [callId, startTime]);
    return startTime;
}

export const setEndTime = async (callId) => {
    const endTime = Date.now();
    await pool.query('UPDATE calls SET end_time = $2 WHERE id = $1', [callId, endTime]);
    return endTime;
}
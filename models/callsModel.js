import pool from "../db.js";

export const insertNewCall = async (callerId, answererId) => {
    await pool.query('INSERT INTO calls (caller_id, answerer_id, created_at) VALUES ($1, $2, $3)', [callerId, answererId, Date.now()]);
}

export const getActiveCallOfUsers = async (callerId, answererId) => {
    const result = await pool.query('SELECT * FROM calls WHERE caller_id = $1 AND answerer_id = $2 AND start_time IS NOT NULL AND end_time IS NULL ORDER BY created_at DESC LIMIT 1', [callerId, answererId]);
    return result.rows[0];
}

export const getPendingCallOfUsers = async (callerId, answererId) => {
    const result = await pool.query('SELECT * FROM calls WHERE caller_id = $1 AND answerer_id = $2 AND start_time IS NULL AND end_time IS NULL ORDER BY created_at DESC LIMIT 1', [callerId, answererId]);
    return result.rows[0];
}

// export const checkNotEndedCallsOfEachUser = async (userId1, userId2) => {
//     // TODO optimize
//     const result = await pool.query('SELECT * FROM calls WHERE (caller_id = $1 OR answerer_id = $1) OR (caller_id = $2 OR answerer_id = $2) AND end_time IS NULL ORDER BY created_at DESC LIMIT 1', [userId1, userId2]);
//     return result.rowCount > 0;
// }

export const getLastCallOfUsers = async (userId1, userId2) => {
    const result = await pool.query('SELECT * FROM calls WHERE (caller_id = $1 OR caller_id = $2) AND (answerer_id = $1 OR answerer_id = $2) ORDER BY created_at DESC LIMIT 1', [userId1, userId2]);
    return result.rows[0];
}

export const setStartTime = async (callId) => {
    const startTime = Date.now();
    await pool.query('UPDATE calls SET start_time = $2 WHERE id = $1', [callId, startTime]);
    return startTime;
}

export const setEndTimeTime = async (callId) => {
    const endTime = Date.now();
    await pool.query('UPDATE calls SET end_time = $2 WHERE id = $1', [callId, endTime]);
    return endTime;
}
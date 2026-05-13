import pool from "../db.js";

// create
const usernames = ['Cool username', 'Amazing username', 'Wonderful username', 'The best username'];
export const createUser = async (email, hashedPassword, client = pool) => {
    const result = await client.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id", [usernames[Math.floor(Math.random() * usernames.length)], email, hashedPassword]);
    return result.rows[0].id;
}

// update
export const updateUser = async (id, username, profileImage, updateImage, client = pool) => {
    const result = await client.query(`UPDATE users SET username = $1${!updateImage ? '' : ', profile_image = $3'} WHERE id = $2 RETURNING *`, !updateImage ? [username, id] : [username, id, profileImage]);
    return result.rows[0];
}

// read
export const getUserByEmail = async (email) => {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
}

export const getUserById = async (id, client = pool) => {
    const result = await client.query('SELECT * FROM users LEFT JOIN onlines ON users.id = onlines.user_id WHERE users.id = $1', [id]);
    return result.rows[0];
}

export const searchUsers = async (search, currentUserId, limit, cursor) => {
    const result = await pool.query(
        'SELECT * FROM users LEFT JOIN onlines ON users.id = onlines.user_id WHERE (lower(users.username) LIKE lower($1)) AND users.id != $2 AND users.id > $3 ORDER BY id ASC LIMIT $4',
        [`${search}%`, currentUserId, cursor ?? 0, limit],
    );
    return result.rows;
}

export const getUserByRefreshToken = async (refreshToken) => {
    const result = await pool.query(`
        SELECT * FROM users WHERE id = 
            (SELECT user_id FROM refresh_tokens WHERE token = $1)
        `, [refreshToken]);
    return result.rows[0];
}

// validation
export const haveDuplicateWithEmail = async (email) => {
    const duplicates = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    return duplicates.rows.length !== 0;
}

// refresh token
export const addRefreshToken = async (userId, token, client = pool) => {
    await client.query('INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)', [userId, token]);
}

export const delteRefreshToken = async (token, client = pool) => {
    await client.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
}

export const resetRefreshTokensByUserId = async (userId, client = pool) => {
    await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}
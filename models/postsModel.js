import pool from "../db.js";

export const getPostById = async (postId) => {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (result.rows.length === 0) {
        return null;
    } else {
        return result.rows[0];
    }
}

export const getPostsByUserId = async (userId, limit, cursor) => {
    const result = await pool.query('SELECT * FROM posts WHERE user_id = $1 AND id < $3 ORDER BY created_at DESC LIMIT $2', [userId, limit, cursor ?? Math.pow(2, 31) - 1]);
    return result.rows;
}

export const createNewPost = async (userId, content, images) => {
    const result = await pool.query('INSERT INTO posts (user_id, content, images, created_at) VALUES ($1, $2, $3, $4) RETURNING *', [userId, content, images, Date.now()]);
    return result.rows[0];
}

export const updatePost = async (postId, content, images) => {
   const result = await pool.query('UPDATE posts SET content = $1, images = $2, edited_at = $3 WHERE id = $4 RETURNING *', [content, images, Date.now(), postId]);
   return result.rows[0];
}

export const getPosts = async (limit, cursor) => {
    const result = await pool.query('SELECT * FROM posts WHERE id < $2 ORDER BY created_at DESC LIMIT $1', [limit, cursor ?? Math.pow(2, 31) - 1]);
    return result.rows;
}

export const deletePostById = async (id) => {
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
}
import express from 'express';
import errorHandler from './middleware/error.js';
import notFound from './middleware/notFound.js';
import verifyJWT from './middleware/verifyJWT.js';
import verifyWSJWT from './middleware/verifyWSJWT.js';
import cookieParser from 'cookie-parser';
import pool from './db.js';
import { Server } from 'socket.io';

import router from './routes/router.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import profileRouter from './routes/profile.js';
import filesRouter from './routes/files.js';
import postsRouter from './routes/posts.js';
import messagesRouter from './routes/messages.js';
import chatsRouter from './routes/chats.js';
import callsRouter from './routes/calls.js';
import fcmRouter from './routes/fcm.js';
import webSocketRouter from './routes/websocket.js';

const PORT = process.env.PORT;

const app = express();

// logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.protocol}://${req.host}${req.originalUrl}`);
    next();
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRouter);

app.post('/setup', async (req, res) => {
    if (req.body?.key !== process.env.SETUP_KEY) {
        return res.sendStatus(403);
    }

    await pool.query('CREATE DATABASE KLM_db;');
    await pool.query('CREATE TABLE users (id SERIAL PRIMARY KEY, username VARCHAR(50) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, password VARCHAR(100) NOT NULL, profile_image VARCHAR(32))');
    await pool.query('CREATE TABLE profiles (id SERIAL PRIMARY KEY, user_id INT UNIQUE NOT NULL, description VARCHAR(200) NOT NULL)');
    await pool.query('CREATE TABLE onlines (user_id INT PRIMARY KEY, is_online BOOLEAN NOT NULL, last_activity_time BIGINT NOT NULL)');
    
    await pool.query('CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INT NOT NULL, content VARCHAR(4000) NOT NULL, images VARCHAR(32)[] NOT NULL, users_who_liked_ids INT[], created_at BIGINT NOT NULL, edited_at BIGINT)');
    
    await pool.query('CREATE TABLE chats (id SERIAL PRIMARY KEY, user_id INT NOT NULL, chat_id SERIAL NOT NULL)');
    await pool.query("CREATE TABLE messages (id SERIAL PRIMARY KEY, chat_id INT NOT NULL, sender_id INT NOT NULL, message VARCHAR(4000) NOT NULL, type TEXT NOT NULL DEFAULT 'message', is_read BOOLEAN DEFAULT FALSE NOT NULL, created_at BIGINT NOT NULL, edited_at BIGINT)");
    // TODO index?
    await pool.query('CREATE TABLE calls (id SERIAL PRIMARY KEY, caller_id INT NOT NULL, answerer_id INT NOT NULL, start_time BIGINT, end_time BIGINT, created_at BIGINT NOT NULL)');

    await pool.query('CREATE TABLE fcm_tokens (id SERIAL PRIMARY KEY, user_id INT, fcm_token TEXT UNIQUE)');
    await pool.query('CREATE TABLE refresh_tokens (id SERIAL PRIMARY KEY, user_id INT NOT NULL, token TEXT UNIQUE NOT NULL)');

    await pool.query('CREATE INDEX users_email_index ON users (email)');
    await pool.query('CREATE INDEX posts_user_id_index ON posts (user_id)');
    await pool.query('CREATE INDEX chats_user_id_index ON chats (user_id)');
    await pool.query('CREATE INDEX messages_chat_id_index ON messages (chat_id)');

    return res.json({ message: 'tables created' });
});

app.use('/api/files', filesRouter);

app.use(verifyJWT);
app.use('/api/user', userRouter);
app.use('/api/fcmToken', fcmRouter);
app.use('/api', router);
app.use('/api/profile', profileRouter);
app.use('/api/posts', postsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/calls', callsRouter);

// Error handlers
app.use(notFound);
app.use(errorHandler);

// 192.168.0.106 or 0.0.0.0 if runs with docker
const expressServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`)
});

// websocet
// TODO make this export is not the best solution, but it's used in callsController
export const io = new Server(expressServer);

io.use(verifyWSJWT);

io.on('connection', (socket) => webSocketRouter(io, socket));
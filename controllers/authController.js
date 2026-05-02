import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as usersModel from '../models/usersModel.js'
import * as profilesModel from '../models/profilesModel.js';
import * as onlinesModel from '../models/onlinesModel.js';
import convertUserToSend from '../utills/convertUser.js';
import emailValidator from 'email-validator';
import pool from '../db.js';

const accessTokenExpireTime = '1200s'
const refreshTokenExpireTime = '365d'

export const createNewUser = async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    // validations
    if (!emailValidator.validate(email)) {
        res.status(400).json({ message: 'The email is incorrect' });
        return false;
    }

    // check duplicates
    if (await usersModel.haveDuplicateWithEmail(email)) {
        return res.status(409).json({ message: `User with email ${email} is alredy exists` });
    }
    
    // create user
    const client = await pool.connect();
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        await client.query('BEGIN');

        const userId = await usersModel.createUser(email, hashedPassword, client);
        await profilesModel.createUserProfile(userId, client);
        await onlinesModel.addUser(userId, client);
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
    return res.status(201).json({ success: `New user with email ${email} created` });
}

export const login = async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    // validations
    if (!emailValidator.validate(email)) {
        res.status(400).json({ message: 'The email is incorrect' });
        return false;
    }

    // get user
    const foundUser = await usersModel.getUserByEmail(email);
    if (!foundUser) {
        return res.status(404).json({ message: `User with email ${email} not found` });
    }

    // login
    const match = await bcrypt.compare(password, foundUser.password);
    if (match) {
        const accessToken = jwt.sign(
            {
                "UserInfo": {
                    "id": foundUser.id,
                }
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: accessTokenExpireTime }
        );
        const refreshToken = jwt.sign(
            {
                "UserInfo": {
                    "id": foundUser.id,
                }
            },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: refreshTokenExpireTime }
        );

        await usersModel.addRefreshToken(foundUser.id, refreshToken);

        return res.status(200).json({ data: { accessToken: accessToken, refreshToken: refreshToken, user: convertUserToSend(foundUser, { userId: foundUser.id }) } });
    } else {
        return res.status(401).json({ message: 'Password is incorrect' });
    }
}

export const refreshToken = async (req, res) => {
    const refreshToken = req.body.refresh_token;

    // get user
    const foundUser = await usersModel.getUserByRefreshToken(refreshToken);
    if (!foundUser) {
        jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET,
            async (err, decoded) => {
                if (err) return;
                const hackedUser = await usersModel.getUserById(decoded.UserInfo.id);
                if (!hackedUser) return;
                await usersModel.resetRefreshTokensByUserId(hackedUser.id);
            });
        return res.sendStatus(404);
    }

    // verify and refresh
    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        async (err, decoded) => {
            if (err || foundUser.id !== decoded.UserInfo.id) return res.sendStatus(403);
            const newAccessToken = jwt.sign(
                {
                    "UserInfo": {
                        "id": decoded.UserInfo.id,
                    }
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: accessTokenExpireTime }
            );

            return res.status(200).json({ accessToken: newAccessToken });
        }
    );
}

export const logout = async (req, res) => {
    const refreshToken = req.body.refresh_token;

    // validations
    if (!refreshToken) return res.sendStatus(204);

    // get user
    const foundUser = await usersModel.getUserByRefreshToken(refreshToken);
    if (!foundUser) {
        return res.sendStatus(204);
    }

    // delete token
    await usersModel.delteRefreshToken(refreshToken);

    return res.sendStatus(204);
}
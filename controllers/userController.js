import convertUserToSend from "../utills/convertUser.js";
import * as usersModel from '../models/usersModel.js';
import * as fcmModel from '../models/fcmModel.js';

export const getUser = async (req, res) => {
    const userId = req.query.userId?.trim();

    // validations
    if (!userId) {
        return res.status(400).json({ message: 'userId param is required' });
    } else if (isNaN(userId)) {
        return res.status(400).json({ message: 'userId must be int' });
    }

    // get user
    const user = await usersModel.getUserById(userId);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ data: convertUserToSend(user, req) });
}

export const updateUser = async (req, res) => {
    const username = req.body.username?.trim();
    const profileImage = req.body.profileImage?.trim();

    // validations
    if (!username) {
        return res.status(400).json({ message: 'username field is required' });
    }

    // update user
    const updateUser = await usersModel.updateUser(req.userId, username, profileImage);

    res.status(200).json({ data: convertUserToSend(updateUser, req) });
}

export const searchUsers = async (req, res) => {
    const userId = req.userId;
    const search = req.query.search;
    const limit = req.query.limit?.trim() ?? 10;
    const cursor = req.query.cursor?.trim() ?? 0; // int, userId

    // validations
    if (search === undefined) {
        return res.status(400).json({ message: 'search param is required' });
    } else if (isNaN(limit)) {
        return res.status(400).json({ message: 'limit must be int' });
    } else if (cursor && isNaN(cursor)) {
        return res.status(400).json({ message: 'cursor must be int' });
    }

    // get users
    const users = (await usersModel.searchUsers(search, userId, limit, cursor)).map(user => convertUserToSend(user, req));

    res.status(200).json({ data: users, limit: limit, cursor: cursor });
}

export const addFCMToken = async (req, res) => {
    const userId = req.userId;
    const token = req.body.token?.trim();

    // validations
    if (!token) {
        return res.status(400).json({ message: 'token field is required' });
    }

    // add token
    await fcmModel.addFCMToken(userId, token);

    res.sendStatus(200);
}

export const deleteFCMToken = async (req, res) => {
    const token = req.body.token?.trim();

    // validations
    if (!token) {
        return res.status(400).json({ message: 'token field is required' });
    }

    // delete token
    await fcmModel.deleteFCMToken(token);

    res.sendStatus(200);
}
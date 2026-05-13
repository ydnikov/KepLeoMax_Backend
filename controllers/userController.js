import convertUserToSend from "../utills/convertUser.js";
import * as usersModel from '../models/usersModel.js';

export const getUser = async (req, res) => {
    const userId = req.query.userId;

    // get user
    const user = await usersModel.getUserById(userId);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ data: convertUserToSend(user, req) });
}

export const searchUsers = async (req, res) => {
    const userId = req.userId;
    const search = req.query.search;
    const limit = req.query.limit;
    const cursor = req.query.cursor; // int, last loaded userId

    // get users
    const users = (await usersModel.searchUsers(search, userId, limit, cursor)).map(user => convertUserToSend(user, req));

    res.status(200).json({ data: users, limit: limit, cursor: cursor });
}
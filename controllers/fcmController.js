import * as fcmModel from '../models/fcmModel.js';

export const addFCMToken = async (req, res) => {
    const userId = req.userId;
    const token = req.query.token?.trim();

    // validations
    if (!token) {
        return res.status(400).json({ message: 'token field is required' });
    }

    // add token
    await fcmModel.addFCMToken(userId, token);

    res.sendStatus(200);
}

export const deleteFCMToken = async (req, res) => {
    // TODO check user?
    const token = req.query.token?.trim();

    // validations
    if (!token) {
        return res.status(400).json({ message: 'token field is required' });
    }

    // delete token
    await fcmModel.deleteFCMToken(token);

    res.sendStatus(200);
}
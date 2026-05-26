import * as channelsModel from '../models/channelsModel.js';
import convertUserToSend from '../utills/convertUser.js';

export const createNewChannel = async (req, res) => {
    const userId = req.userId;
    const name = req.body.name;
    const description = req.body.description;
    const tag = req.body.tag;
    const imageUrl = req.body.image_url;

    const channel = await channelsModel.createNewChannel(userId, name, description, tag, imageUrl);
    channel.current_user_is_owner = true;

    return res.status(201).json({ message: 'New channel created', data: channel });
}

export const editChannel = async (req, res) => {
    const userId = req.userId;
    const channelId = req.query.channel_id;
    const name = req.body.name;
    const description = req.body.description;
    const tag = req.body.tag;
    const imageUrl = req.body.image_url;

    const result = await channelsModel.editChannel(channelId, userId, name, description, tag, imageUrl);

    if (result === 404 || result === 403) {
        return res.sendStatus(statusCode);
    } else {
        result.current_user_is_owner = true;
        return res.status(200).json({ data: result });
    }
}

export const getSubscribersCount = async (req, res) => {
    const channelId = req.query.channel_id;

    const count = await channelsModel.getSubscribersCount(channelId);

    return res.status(200).json({ count: count });
}

export const getSubscribers = async (req, res) => {
    const userId = req.userId;
    const channelId = req.query.channel_id;
    const limit = req.query.limit ?? 20;
    const cursor = req.query.cursor ?? -1; // last userId

    const channel = await channelsModel.getChannel(channelId);
    if (!channel) {
        return res.sendStatus(404);
    } else if (channel.owner_id !== userId) {
        return res.sendStatus(403);
    }

    const subs = await channelsModel.getSubscribers(channelId, limit, cursor);
    return res.status(200).json({ data: subs.map(u => convertUserToSend(u, req)), limit: limit, cursor: cursor });
}

export const subscribe = async (req, res) => {
    const userId = req.userId;
    const channelId = req.query.channel_id;
    
    const isSuccess = await channelsModel.subscribe(userId, channelId);

    if (isSuccess) {
        return res.sendStatus(204);
    } else {
        return res.sendStatus(409);
    }
}

export const unsubscribe = async (req, res) => {
    const userId = req.userId;
    const channelId = req.query.channel_id;
    
    const isSuccess = await channelsModel.unsubscribe(userId, channelId);

    if (isSuccess) {
        return res.sendStatus(204);
    } else {
        return res.sendStatus(404);
    }
}

import * as channelsModel from '../models/channelsModel.js';
import { onChatUpdated, onSubscribeOnChannel, onUnsubscribeFromChannel } from '../services/websocketService.js';
import convertUserToSend from '../utills/convertUser.js';

export const createNewChannel = async (req, res) => {
    const userId = req.userId;
    const name = req.body.name;
    const description = req.body.description;
    const tag = req.body.tag;
    const image = req.body.image;

    const channel = await channelsModel.createNewChannel(userId, name, description, tag, image);
    channel.role = 'owner';
    channel.subs_count = 1;

    return res.status(201).json({ message: 'New channel created', data: channel });
}

export const editChannel = async (req, res) => {
    const userId = req.userId;
    const channelId = req.query.channel_id;
    const name = req.body.name;
    const description = req.body.description;
    const tag = req.body.tag;
    const image = req.body.image;

    const result = await channelsModel.editChannel(channelId, userId, name, description, tag, image);

    if (result === 404 || result === 403) {
        return res.sendStatus(statusCode);
    } else {
        const channel = result;
        // TODO optimize
        const subsCount = await channelsModel.getSubscribersCount(channelId);
        channel.subs_count = subsCount;
        channel.role = 'keep_current';
        onChatUpdated({ channel: channel });
        channel.role = 'owner';
        return res.status(200).json({ data: channel });
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
        // TODO optimize
        const channel = await channelsModel.getChannel(channelId);
        channel.role = 'subscriber';
        const subsCount = await channelsModel.getSubscribersCount(channelId);
        channel.subs_count = subsCount;
        onSubscribeOnChannel({ channel: channel }, userId);
        return res.sendStatus(204);
    } else {
        return res.sendStatus(409);
    }
}

export const unsubscribe = async (req, res) => {
    const currentUserId = req.userId;
    const deleteUserId = req.query.user_id;
    const channelId = req.query.channel_id;

    if (deleteUserId) {
        const channel = await channelsModel.getChannel(channelId);
        if (channel.owner_id !== currentUserId) {
            return res.sendStatus(403);
        }
    }

    const isSuccess = await channelsModel.unsubscribe(deleteUserId ?? currentUserId, channelId);

    if (isSuccess) {
        // TODO optimize
        const subsCount = await channelsModel.getSubscribersCount(channelId);
        onUnsubscribeFromChannel({ channel_id: Number(channelId), subs_count: subsCount }, deleteUserId ?? currentUserId);
        return res.sendStatus(204);
    } else {
        return res.sendStatus(404);
    }
}

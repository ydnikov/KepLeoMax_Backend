import * as channelsModel from '../models/channelsModel.js';
import { onChatUpdated, onSubscribeOnChannel, onUnsubscribeFromChannel, onChannelDeleted } from '../services/websocketService.js';
import convertUserToSend from '../utills/convertUser.js';

export const createNewChannel = async (req, res) => {
    const userId = req.userId;
    const name = req.body.name;
    const description = req.body.description;
    const tag = req.body.tag;
    const image = req.body.image;

    const channel = await channelsModel.createNewChannel(userId, name, description, tag, image);
    onSubscribeOnChannel({ channel: channel }, userId);

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
        channel.role = 'keep_current';
        onChatUpdated({ channel: channel });
        channel.role = 'owner';
        return res.status(200).json({ data: channel });
    }
}

export const deleteChannel = async (req, res) => {
    const userId = req.userId;
    const channelId = req.query.channel_id;

    const result = await channelsModel.deleteChannel(channelId, userId);

    if (!Array.isArray(result)) {
        return res.sendStatus(result);
    }

    onChannelDeleted({ channel_id: Number(channelId), users_ids: result }, userId);

    return res.sendStatus(204);
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

    const checkResult = await channelsModel.checkUserIsOwner(channelId, userId);
    if (checkResult !== 200) {
        return res.sendStatus(checkResult);
    }

    const subs = await channelsModel.getSubscribers(channelId, limit, cursor);
    return res.status(200).json({ data: subs.map(u => convertUserToSend(u, req)), total_count: subs[0]?.total_count, limit: limit, cursor: cursor });
}

export const subscribe = async (req, res) => {
    const userId = req.userId;
    const channelId = req.query.channel_id;

    const result = await channelsModel.subscribe(userId, channelId);

    if (result === 200) {
        const channel = await channelsModel.getChannel(channelId);
        channel.role = 'subscriber';
        onSubscribeOnChannel({ channel: channel }, userId);
        return res.sendStatus(204);
    } else {
        return res.sendStatus(result);
    }
}

export const unsubscribe = async (req, res) => {
    const currentUserId = req.userId;
    const deleteUserId = req.query.user_id;
    const channelId = req.query.channel_id;

    if (deleteUserId) {
        const checkResult = await channelsModel.checkUserIsOwner(channelId, currentUserId);
        if (checkResult !== 200) {
            return res.sendStatus(checkResult);
        }
    }

    const isSuccess = await channelsModel.unsubscribe(deleteUserId ?? currentUserId, channelId);

    if (isSuccess) {
        const subsCount = await channelsModel.getSubscribersCount(channelId);
        onUnsubscribeFromChannel({ channel_id: Number(channelId), subs_count: subsCount }, deleteUserId ?? currentUserId);
        return res.sendStatus(204);
    } else {
        return res.sendStatus(404);
    }
}

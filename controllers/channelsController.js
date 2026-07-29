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

export const getSubscribers = async (req, res) => {
    const userId = req.userId;
    const channelId = req.query.channel_id;
    const limit = req.query.limit ?? 20;
    const cursor = req.query.cursor ?? -1; // last userId

    const channel = await channelsModel.getChannel(channelId);
    if (!channel || channel.owner_id !== userId) {
        return res.sendStatus(403);
    }

    const subs = await channelsModel.getSubscribers(channelId, limit, cursor);
    return res.status(200).json({ data: subs.map(u => convertUserToSend(u, req)), total_count: channel.subs_count, limit: limit, cursor: cursor });
}

export const subscribe = async (req, res) => {
    const userId = req.userId;
    const channelId = req.query.channel_id;

    const result = await channelsModel.subscribe(userId, channelId);

    if (result == 200 || result == 409) {
        const channel = await channelsModel.getChannel(channelId);
        channel.role = 'subscriber';
        onSubscribeOnChannel({ channel: channel }, userId);
        return res.status(result).json({ data: channel });
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

    const result = await channelsModel.unsubscribe(deleteUserId ?? currentUserId, channelId);

    if (result.success) {
        // TODO optimize getChannel (2 queries)
        const channel = await channelsModel.getChannel(channelId);
        if (result.code !== 409) {
            onUnsubscribeFromChannel({ channel_id: Number(channelId), subs_count: channel.subs_count }, deleteUserId ?? currentUserId);
        }
        channel.role = !!deleteUserId ? 'owner' : 'none';
        return res.status(result.code).json({ data: channel });
    } else {
        return res.sendStatus(result.code);
    }
}

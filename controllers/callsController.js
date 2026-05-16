import { io } from "../server.js";
import { endCall } from "../services/webRTCService.js";
import * as callsModel from '../models/callsModel.js';
import { onMessage } from "../services/websocketService.js";

export const getStatufOfCall = async (req, res) => {
    const userId = req.userId;
    const callId = req.query.call_id;

    const call = await callsModel.getCallById(callId);
    if (!call || (call.caller_id !== userId && call.answerer_id !== userId)) {
        return res.sendStatus(403);
    }

    var status;
    if (call.end_time != null) {
        status = 'ended';
    } else if (call.start_time != null) {
        status = 'active';
    } else {
        status = 'pending';
    }
    return res.status(200).json({ data: { status: status } });
}

export const acceptCall = async (req, res) => {
    const userId = req.userId;
    const callId = req.query.call_id;

    const call = await callsModel.getCallById(callId);
    if (!call || (call.caller_id !== userId && call.answerer_id !== userId)) {
        return res.sendStatus(403);
    }

    if (call.end_time || call.start_time) {
        return res.sendStatus(409);
    }

    await callsModel.setStartTime(callId);
    return res.sendStatus(200);
}

export const newCall = async (req, res) => {
    const userId = req.userId;
    const otherUserId = req.query.other_user_id;

    // TODO optimize 2 queries to 1
    const activeCall = await callsModel.getActiveOrPendingCallOfUser(userId);
    if (activeCall) {
        return res.status(409).json({ message: "You can't have more than 1 active call at once" });
    }

    const otherUserActiveCall = await callsModel.getActiveOrPendingCallOfUser(otherUserId);
    if (otherUserActiveCall) {
        const newCall = await callsModel.insertNewCall(userId, otherUserId, true);
        newCall.notify_other_user = true;
        onMessage(io, { recipient_id: otherUserId, type: 'call', call: newCall }, userId);
        return res.status(409).json({ message: 'User is talking now' });
    }

    const newCall = await callsModel.insertNewCall(userId, otherUserId);
    return res.status(200).json({ data: { call_id: newCall.id.toString() } });
}

export const declineCall = async (req, res) => {
    const userId = req.userId;
    const callId = req.query.call_id;
    const fcmToken = req.query.fcm_token;

    const call = await callsModel.getCallById(callId);
    if (!call || (call.caller_id !== userId && call.answerer_id !== userId)) {
        console.log('Failed attempt to end call');
        return res.status(403);
    }

    console.log(`decline call, userId: ${userId}, callId: ${callId}`);

    await endCall(io, { call: call, fcm_token: fcmToken }, userId);

    return res.sendStatus(200);
}
import * as usersModel from '../models/usersModel.js';
import * as callsModel from '../models/callsModel.js';
import { cancelAllCallNotifcationOnOtherDevices, sendCallNotification, sendNotification } from "./notificationService.js";
import { onMessage } from './websocketService.js';

export const sendOffer = async (io, data, userId) => {
    const offer = data.offer;
    const toUserId = data.to_user_id;

    // const hasActiveCalls = await callsModel.checkNotEndedCallsOfEachUser(userId, toUserId);
    // if (hasActiveCalls) {
    //     io.in([userId.toString()]).emit('webrtc_end_call', {
    //         other_user_id: toUserId,
    //     });
    //     endCall(io, data, userId);
    //     return;
    // }

    const newCall = await callsModel.getPendingCallOfUsers(userId, toUserId);
    if (!newCall) {
        console.log('Try to sendOffer, but there is no pedning call');
        return;
    }

    const user = await usersModel.getUserById(userId);
    sendCallNotification(toUserId, newCall.id, offer, user);
}

export const sendAnswer = async (io, data, userId) => {
    const answer = data.answer;
    const callId = data.call_id;
    const fcmToken = data.fcm_token;

    const call = await callsModel.getCallById(callId);
    if (!call) {
        cancelAllCallNotifcationOnOtherDevices(userId, callId);
        console.log('attempt to sendAnswer, but pendingCall is null');
        return;
    }

    io.in([call.caller_id.toString()]).emit('webrtc_answer', {
        id: call.id.toString(),
        other_user_id: userId,
        answer: answer,
    });
    await callsModel.setStartTime(call.id);
    await cancelAllCallNotifcationOnOtherDevices(userId, call.id, fcmToken);
}

export const sendICECandidate = (io, data, userId) => {
    const candidate = data.candidate;
    const toUserId = data.to_user_id;

    io.in([toUserId.toString()]).emit('webrtc_ice_candidate', {
        other_user_id: userId,
        candidate: candidate,
    });
}

export const sendCameraStatus = (io, data, userId) => {
    const status = data.status;
    const toUserId = data.to_user_id;

    io.in([toUserId.toString()]).emit('webrtc_camera_status', {
        other_user_id: userId,
        status: status,
    });
}

export const endCallIfExists = async (io, userId) => {
    const call = await callsModel.getActiveOrPendingCallOfUser(userId);
    if (!call) return;

    await endCall(io, { call: call }, userId);
}

export const endCall = async (io, data, userId) => {
    const fcmToken = data.fcm_token;
    const call = data.call ?? await callsModel.getCallById(data.call_id);
    const otherUserId = [call.answerer_id, call.caller_id].filter(id => id !== userId);

    console.log(`end call, from: ${userId} to: ${otherUserId}`);
    io.in([otherUserId.toString()]).emit('webrtc_end_call', {
        other_user_id: userId,
    });
    cancelAllCallNotifcationOnOtherDevices(userId, call.id, fcmToken);

    if (call && !call.end_time) {
        const endTime = await callsModel.setEndTimeTime(call.id);
        call.end_time = endTime;

        /// send message
        call.notify_other_user = userId == call.caller_id;
        const newData = {
            recipient_id: call.answerer_id,
            call: call,
            type: 'call',
        };
        onMessage(io, newData, call.caller_id);
    }
}
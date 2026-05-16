import * as usersModel from '../models/usersModel.js';
import * as callsModel from '../models/callsModel.js';
import { cancelAllCallNotifcationOnOtherDevices, sendCallNotification } from "./notificationService.js";
import { onMessage } from './websocketService.js';

export const offersCache = new Map();

export const sendOffer = async (io, data, userId) => {
    const offer = data.offer;
    const callId = data.call_id;

    // call must be created via /calls/newCall endpoint
    const call = await callsModel.getCallById(callId);
    if (!call || call.start_time || call.end_time || call.caller_id !== userId) {
        console.log('Failed attempt to sendOffer: has no permission or there is no pending call');
        return;
    }

    const currentUser = await usersModel.getUserById(userId);
    const otherUserId = call.answerer_id;
    offersCache[callId] = offer;
    sendCallNotification(otherUserId, call.id, currentUser);
}

export const sendAnswer = async (io, data, userId) => {
    const answer = data.answer;
    const callId = data.call_id;

    // call must be accept via /calls/accept endpoint
    const call = await callsModel.getCallById(callId);
    if (!call || !call.start_time || call.end_time || call.answerer_id !== userId) {
        console.log('Failed attempt to sendAnswer: has no permission or there is no pending call');
        return;
    }

    io.in([call.caller_id.toString()]).emit('webrtc_answer', {
        id: call.id.toString(),
        other_user_id: userId, // TODO need this?
        answer: answer,
    });
    await cancelAllCallNotifcationOnOtherDevices(userId, call.id, call.answerer_fcm_token);
}

// TODO optimize? pg call each time
export const sendICECandidate = async (io, data, userId) => {
    const candidate = data.candidate;
    const callId = data.call_id;

    const call = await callsModel.getCallById(callId);
    if (!call || call.end_time || (call.answerer_id !== userId && call.caller_id !== userId)) {
        console.log('Failed attempt to sendICECandidate: has no permission or there is no pending call');
        return;
    }

    const otherUserId = call.answerer_id === userId ? call.caller_id : call.answerer_id;
    io.in([otherUserId.toString()]).emit('webrtc_ice_candidate', {
        call_id: callId,
        candidate: candidate,
    });
}

export const sendCameraStatus = async (io, data, userId) => {
    const status = data.status;
    const callId = data.call_id;

    const call = await callsModel.getCallById(callId);
    if (!call || call.end_time || (call.answerer_id !== userId && call.caller_id !== userId)) {
        console.log('Failed attempt to sendCameraStatus: has no permission or there is no pending call');
        return;
    }

    const otherUserId = call.answerer_id === userId ? call.caller_id : call.answerer_id;
    io.in([otherUserId.toString()]).emit('webrtc_camera_status', {
        call_id: callId,
        status: status,
    });
}

export const endCallIfExists = async (io, userId) => {
    const call = await callsModel.getActiveOrPendingCallOfUser(userId);
    if (!call) {
        console.log('Failed attempt to endCallIfExists');
        return;
    }

    await endCall(io, { call: call }, userId);
}

export const endCall = async (io, data, userId) => {
    const fcmToken = data.fcm_token;
    const call = data.call;
    const otherUserId = call.caller_id !== userId ? call.caller_id : call.answerer_id;

    offersCache.delete(call.id);

    // end call on every currentUser's device
    if (!call.start_time) {
        cancelAllCallNotifcationOnOtherDevices(userId, call.id, fcmToken);
    }

    // end call it db and send message (if call is not ended now)
    if (call.end_time) {
        console.log("Failed attempt to endCall: it's already ended");
        return;
    }

    const endTime = await callsModel.setEndTime(call.id);
    call.end_time = endTime;

    // send ws event
    console.log(`end call, from: ${userId} to: ${otherUserId}`);
    io.in([otherUserId.toString()]).emit('webrtc_end_call', {
        call_id: call.id.toString(),
    });

    // send chat message
    call.notify_other_user = userId === call.caller_id;
    const newData = {
        recipient_id: call.answerer_id,
        call: call,
        type: 'call',
    };
    onMessage(io, newData, call.caller_id);
}
import * as usersModel from '../models/usersModel.js';
import * as callsModel from '../models/callsModel.js';
import { sendNotification } from "./notificationService.js";
import convertUserToSend from "../utills/convertUser.js";
import { onMessage } from './websocketService.js';

export const sendOffer = async (io, data, userId) => {
    console.log(`send_offer`);
    const offer = data.offer; // contains sdp and type
    const toUserId = data.to_user_id;

    // const hasActiveCalls = await callsModel.checkNotEndedCallsOfEachUser(userId, toUserId);
    // if (hasActiveCalls) {
    //     io.in([userId.toString()]).emit('webrtc_end_call', {
    //         other_user_id: toUserId,
    //     });
    //     endCall(io, data, userId);
    //     return;
    // }

    await callsModel.insertNewCall(userId, toUserId);

    const user = await usersModel.getUserById(userId);
    sendNotification(toUserId, '', '', {
        type: 'incoming_call',
        offer_sdp: offer.sdp,
        offer_type: offer.type,
        other_user: JSON.stringify(convertUserToSend(user))
    });
}

export const sendAnswer = async (io, data, userId) => {
    console.log(`send_answer`);
    const answer = data.answer; // contains sdp and type
    const toUserId = data.to_user_id;

    io.in([toUserId.toString()]).emit('webrtc_answer', {
        other_user_id: userId,
        answer: answer,
    });

    const call = await callsModel.getPendingCallOfUsers(toUserId, userId);
    if (!call) {
        data.to_user_id = userId;
        await endCall(io, data, data.to_user_id);
        return;
    }
    await callsModel.setStartTime(call.id);
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

export const endCall = async (io, data, userId) => {
    const toUserId = data.to_user_id;
    console.log(`end call, from: ${userId} to: ${toUserId}`);

    io.in([toUserId.toString()]).emit('webrtc_end_call', {
        other_user_id: userId,
    });

    const call = await callsModel.getLastCallOfUsers(userId, toUserId);
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
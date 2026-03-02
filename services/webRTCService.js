import { sendNotification } from "./notificationService.js";
import * as usersModel from '../models/usersModel.js';
import convertUserToSend from "../utills/convertUser.js";

export const sendOffer = async (io, data, userId) => {
    console.log(`send_offer`);
    const offer = data.offer; // contains sdp and type
    const toUserId = data.to_user_id;

    io.in([toUserId.toString()]).emit('webrtc_offer', {
        other_user_id: userId,
        offer: offer
    });

    const user = await usersModel.getUserById(userId);
    sendNotification(toUserId, '', '', {
        type: 'incoming_call',
        offer_sdp: offer.sdp,
        offer_type: offer.type,
        other_user: JSON.stringify(convertUserToSend(user))
    });
}

export const sendAnswer = (io, data, userId) => {
    console.log(`send_answer`);
    const answer = data.answer; // contains sdp and type
    const toUserId = data.to_user_id;

    io.in([toUserId.toString()]).emit('webrtc_answer', {
        other_user_id: userId,
        answer: answer,
    });
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
    const isCameraOn = data.is_camera_on;
    const toUserId = data.to_user_id;

    io.in([toUserId.toString()]).emit('webrtc_camera_status', {
        other_user_id: userId,
        is_camera_on: isCameraOn,
    });
}

export const endCall = async (io, data, userId) => {
    const toUserId = data.to_user_id;
    const markCallAsMissed = data.mark_call_as_missed;
    console.log(`end call, from: ${userId} to: ${toUserId}`);

    io.in([toUserId.toString()]).emit('webrtc_end_call', {
        other_user_id: userId,
    });

    if (markCallAsMissed) {
        const user = await usersModel.getUserById(userId);
        sendNotification(toUserId, '', '', {
            type: 'end_incoming_call',
            other_user: JSON.stringify(convertUserToSend(user))
        });
    }
}
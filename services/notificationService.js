import admin from 'firebase-admin';
import { getMessaging } from "firebase-admin/messaging";
import * as fcmModel from '../models/fcmModel.js';
import convertUserToSend from '../utills/convertUser.js';

admin.initializeApp({
    credential: admin.credential.cert('./kepleomax-firebase-adminsdk.json')
});

export const cancelAllCallNotifcationOnOtherDevices = async (userId, callId, ignoreToken) => {
    const tokens = (await fcmModel.getAllTokensByUserId(userId));
    if (tokens.length < 2) return;

    const messages = tokens.map(token => ({
        data: {
            type: 'stop_call',
            only_hide_notification: (token.fcm_token === ignoreToken).toString(),
            call_id: callId.toString(),
        },
        android: {
            priority: 'high',
        },
        token: token.fcm_token,
    }));
    await sendEach(messages);
}

export const sendCallNotification = async (toUser, callId, currentUser) => {
    const tokens = await fcmModel.getAllTokensByUserId(toUser);
    if (!tokens || tokens.length === 0) return;

    const messages = tokens.map(token => ({
        data: {
            type: 'incoming_call',
            id: callId.toString(),
            other_user: JSON.stringify(convertUserToSend(currentUser)),
        },
        android: {
            priority: 'high',
        },
        token: token.fcm_token,
    }));
    await sendEach(messages);
}

export const sendNotification = async (userId, title, body, externalData) => {
    const tokens = await fcmModel.getAllTokensByUserId(userId);
    if (!tokens || tokens.length === 0) return;

    const messages = tokens.map(token => ({
        // title and body should be in the data, not in the notification
        // for right handling background notifications
        data: {
            ...externalData,
            title: title,
            body: body
        },
        android: {
            priority: 'high',
            // notification: {
            //     notification_priority: 'PRIORITY_MAX',
            //     channel_id: 'high_importance_channel'
            // }
        },
        token: token.fcm_token,
    }));
    await sendEach(messages);
}

const sendEach = async (messages) => {
    if (messages.length === 0) return;

    const now = Date.now().toString();
    const response = await getMessaging().sendEach(messages.map(m => ({ ...m, data: { ...m.data, sent_at: now } })));

    const tokensToDelete = [];
    for (var i = 0; i < response.responses.length; i++) {
        const res = response.responses[i];
        if (!res.success) {
            const error = res.error;
            const tokenFaulty = messages[i].token;

            if (error.code === 'messaging/registration-token-not-registered' ||
                error.code === 'messaging/invalid-registration-token') {

                console.log(`Invalid token: ${tokenFaulty}`);
                tokensToDelete.push(tokenFaulty);
            } else {
                console.error(`Failed to send notification to ${tokenFaulty}:`, error.code, error.message);
            }
        }
    }

    if (tokensToDelete.length > 0) {
        await fcmModel.deleteFCMTokens(tokensToDelete);
    }

    console.log(`successfuly sent ${response.successCount} messages, type: ${messages[0]['data']['type']}`);
}
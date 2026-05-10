import admin from 'firebase-admin';
import { getMessaging } from "firebase-admin/messaging";
import * as fcmModel from '../models/fcmModel.js';
import convertUserToSend from '../utills/convertUser.js';

admin.initializeApp({
    credential: admin.credential.cert('./kepleomax-firebase-adminsdk.json')
});

export const cancelAllCallNotifcationOnOtherDevices = async (userId, otherUserId) => {
    const tokens = await fcmModel.getAllTokensByUserId(userId);
    if (tokens.length < 2) return;

    const messages = tokens.map(token => ({
        data: {
            type: 'cancel_call',
            other_user_id: otherUserId.toString(),
        },
        android: {
            priority: 'high',
        },
        token: token.fcm_token,
    }));
    sendEach(messages);
}

export const sendCallNotification = async (otherUserId, offer, currentUser) => {
    const tokens = await fcmModel.getAllTokensByUserId(otherUserId);
    if (!tokens || tokens.length === 0) return;

    const messages = tokens.map(token => ({
        data: {
            type: 'incoming_call',
            offer_sdp: offer.sdp,
            offer_type: offer.type,
            other_user: JSON.stringify(convertUserToSend(currentUser)),
        },
        android: {
            priority: 'high',
        },
        token: token.fcm_token,
    }));
    sendEach(messages);
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
    sendEach(messages);
}

const sendEach = async (messages) => {
    if (messages.length === 0) return;

    const response = await getMessaging().sendEach(messages);

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
                console.error(`Failed to send notification to ${tokenFaulty}:`, error.code);
            }
        }
    }

    if (tokensToDelete.length > 0) {
        await fcmModel.deleteFCMTokens(tokensToDelete);
    }

    console.log(`successfuly sent ${response.successCount} messages, type: ${messages[0]['data']['type']}`);

    // .then((_) => {
    //     console.log(`Successfully sent message to userId ${userId}, type: ${externalData['type']}`);
    // })
    // .catch((error) => {
    //     if (error.errorInfo.code == "messaging/registration-token-not-registered") {
    //         console.log("Error sending message, token-not-registered:", token.fcm_token);
    //         fcmModel.deleteFCMTokenById(token.id);
    //     } else {
    //         console.log("Error sending message:", error);
    //     }
    // });
}
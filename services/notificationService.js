import admin from 'firebase-admin';
import { getMessaging } from "firebase-admin/messaging";
import * as fcmModel from '../models/fcmModel.js';

admin.initializeApp({
    credential: admin.credential.cert('./kepleomax-firebase-adminsdk.json')
});

export const sendNotification = async (userId, title, body, externalData) => {
    const tokens = await fcmModel.getAllTokensByUserId(userId);
    if (!tokens || tokens.length === 0) return;

    tokens.forEach((token) => {
        const message = {
            /// should be in the data, not in the notification for right handling background notifications
            data: {
                ...externalData,
                title: title,
                body: body
            },
            token: token.fcm_token,
            android: {
                priority: 'high'
            }
        };
        getMessaging()
            .send(message)
            .then((response) => {
                console.log("Successfully sent message:", response);
            })
            .catch((error) => {
                if (error.errorInfo.code == "messaging/registration-token-not-registered") {
                    console.log("Error sending message, token-not-registered:", token);
                    fcmModel.deleteFCMToken(token.fcm_token);
                } else {
                    console.log("Error sending message:", error);
                }
            });
    });
}
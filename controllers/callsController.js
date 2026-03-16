import { io } from "../server.js";
import { endCall } from "../services/webRTCService.js";

export const declineCall = async (req, res) => {
    const userId = req.userId;
    const otherUserId = req.query.otherUserId;

    console.log(`decline call, userId: ${userId}, otherUserId: ${otherUserId}`);

    endCall(io, {
        to_user_id: otherUserId,
    }, userId);

    return res.sendStatus(200);
}
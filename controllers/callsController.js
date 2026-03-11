import { io } from "../server.js";
import { endCall } from "../services/webRTCService.js";

export const declineCall = async (req, res) => {
    const userId = req.userId;
    const otherUserId = req.query.otherUserId;

    if (isNaN(otherUserId)) {
        return res.status(400).json({ message: "otherUserId param should be int" });
    }

    console.log(`decline call, userId: ${userId}, otherUserId: ${otherUserId}`);

    endCall(io, {
        to_user_id: otherUserId,
    }, userId);

    return res.sendStatus(200);
}
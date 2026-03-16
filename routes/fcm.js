import express from 'express';
import { addFCMToken, deleteFCMToken } from '../controllers/fcmController.js';

const router = express.Router();

router.post('/', addFCMToken);
router.delete('/', deleteFCMToken);

export default router;
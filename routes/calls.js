import express from 'express';
import { declineCall } from '../controllers/callsController.js';
const router = express.Router();

router.get('/declineCall', declineCall);;

export default router;
import express from 'express';
import { declineCall } from '../controllers/callsController.js';
import { validate } from '../middleware/validator.js';
import { declineCallSchema } from '../schemas/callsSchema.js';
const router = express.Router();

router.get('/declineCall', validate(declineCallSchema), declineCall);

export default router;
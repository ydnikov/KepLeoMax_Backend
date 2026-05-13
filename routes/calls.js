import express from 'express';
import { declineCall, getStatufOfCall as getStatusOfCall, newCall } from '../controllers/callsController.js';
import { validate } from '../middleware/validator.js';
import { callStatusSchema, declineCallSchema, startCallSchema as newCallSchema } from '../schemas/callsSchema.js';
const router = express.Router();

router.get('/status', validate(callStatusSchema), getStatusOfCall);
router.get('/newCall', validate(newCallSchema), newCall);
router.get('/declineCall', validate(declineCallSchema), declineCall);

export default router;
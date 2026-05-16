import express from 'express';
import { acceptCall, declineCall, getOffer as getOfferOfCall, getStatufOfCall as getStatusOfCall, newCall } from '../controllers/callsController.js';
import { validate } from '../middleware/validator.js';
import { acceptCallSchema, callStatusSchema, declineCallSchema, getOfferOfCallSchema, startCallSchema as newCallSchema } from '../schemas/callsSchema.js';
const router = express.Router();

// TODO should they all be get?
router.get('/new', validate(newCallSchema), newCall);
router.get('/accept', validate(acceptCallSchema), acceptCall);
router.get('/status', validate(callStatusSchema), getStatusOfCall);
router.get('/getOffer', validate(getOfferOfCallSchema), getOfferOfCall);
router.get('/decline', validate(declineCallSchema), declineCall);

export default router;
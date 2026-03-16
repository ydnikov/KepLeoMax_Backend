import express from 'express';
import { addFCMToken, deleteFCMToken } from '../controllers/fcmController.js';
import { validate } from '../middleware/validator.js';
import { addFCMTokenSchema, deleteFCMTokenSchema } from '../controllers/schemas/fcmSchemas.js';

const router = express.Router();

router.post('/', validate(addFCMTokenSchema), addFCMToken);
router.delete('/', validate(deleteFCMTokenSchema), deleteFCMToken);

export default router;
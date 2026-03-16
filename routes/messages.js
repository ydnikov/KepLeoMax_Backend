import express from 'express';
import { getMessagesByChatId } from '../controllers/messagesController.js';
import { validate } from '../middleware/validator.js';
import { getMessagesByChatIdSchema } from '../controllers/schemas/messagesSchemas.js';
const router = express.Router();

router.get('/', validate(getMessagesByChatIdSchema), getMessagesByChatId);

export default router;
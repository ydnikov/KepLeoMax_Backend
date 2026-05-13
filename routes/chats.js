import express from 'express';
import { getChat, getChats, getChatWithUser } from '../controllers/chatsController.js';
import { validate } from '../middleware/validator.js';
import { getChatSchema, getChatsSchema, getChatWithUserSchema } from '../schemas/chatsSchemas.js';
const router = express.Router();

router.get('/withId', validate(getChatSchema), getChat);
router.get('/', validate(getChatsSchema), getChats);
router.get('/withUser', validate(getChatWithUserSchema), getChatWithUser);

export default router;
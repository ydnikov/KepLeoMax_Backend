import express from 'express';
import { deleteChatWithMessages, getChat, getChats, getChatWithUser } from '../controllers/chatsController.js';
import { validate } from '../middleware/validator.js';
import { deleteChatWithMessagesSchema, getChatSchema, getChatsSchema, getChatWithUserSchema } from '../schemas/chatsSchemas.js';
const router = express.Router();

router.get('/', validate(getChatsSchema), getChats);
router.get('/withUser', validate(getChatWithUserSchema), getChatWithUser);
router.delete('/', validate(deleteChatWithMessagesSchema), deleteChatWithMessages);
router.get('/:chatId', validate(getChatSchema), getChat);

export default router;
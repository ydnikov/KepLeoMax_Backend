import express from 'express';
import { validate } from '../middleware/validator.js';
import { deleteChannelSchema, editChannelSchema, newChannelSchema, subsribeOnChannelSchema as subscribeOnChannelSchema, subsSchema, unsubsribeFromChannelSchema as unsubscribeFromChannelSchema } from '../schemas/channelsSchemas.js';
import { createNewChannel, deleteChannel, editChannel, getSubscribers, subscribe as subscribeOnChannel, unsubscribe as unsubscribeFromChannel } from '../controllers/channelsController.js';

const router = express.Router();

router.post('/new', validate(newChannelSchema), createNewChannel);
router.put('/edit', validate(editChannelSchema), editChannel);
router.delete('/', validate(deleteChannelSchema), deleteChannel);
router.get('/subs', validate(subsSchema), getSubscribers);
router.post('/subscribe', validate(subscribeOnChannelSchema), subscribeOnChannel);
router.delete('/unsubscribe', validate(unsubscribeFromChannelSchema), unsubscribeFromChannel);

export default router;
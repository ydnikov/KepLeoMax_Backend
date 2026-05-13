import express from 'express';
import { getUser, searchUsers } from '../controllers/userController.js';
import { validate } from '../middleware/validator.js';
import { getUserSchema } from '../schemas/userSchemas.js';
import { searchUserSchema } from '../schemas/profileSchemas.js';
const router = express.Router();

router.get('/', validate(getUserSchema), getUser);
router.get('/search', validate(searchUserSchema), searchUsers);

export default router;
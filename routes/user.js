import express from 'express';
import { getUser, searchUsers } from '../controllers/userController.js';
const router = express.Router();

router.get('/', getUser);
router.get('/search', searchUsers);

export default router;
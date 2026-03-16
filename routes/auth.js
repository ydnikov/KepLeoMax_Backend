import express from 'express';
const router = express.Router();
import { createNewUser, login, logout, refreshToken } from '../controllers/authController.js'
import { createNewUserSchema, loginSchema, logoutSchema, refreshTokenSchema } from '../schemas/authSchemas.js';
import { validate } from '../middleware/validator.js';

router.post('/register', validate(createNewUserSchema), createNewUser);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshTokenSchema), refreshToken);
router.post('/logout', validate(logoutSchema), logout);

export default router;
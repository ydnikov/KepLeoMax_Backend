import express from 'express';
import { getProfile, editProfile } from '../controllers/profileController.js';
import { validate } from '../middleware/validator.js';
import { editProfileSchema, getProfileSchema } from '../schemas/profileSchemas.js';
const router = express.Router();

router.get('/', validate(getProfileSchema), getProfile);
router.post('/', validate(editProfileSchema), editProfile);

export default router;
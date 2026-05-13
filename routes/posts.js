import express from 'express';
import { createPost as createNewPost, deletePost, getPosts, getPostsByUserId, updatePost } from '../controllers/postsController.js';
import { validate } from '../middleware/validator.js';
import { createNewPostSchema, deletePostSchema, getPostsByUserIdSchema, getPostsSchema, updatePostSchema } from '../schemas/postsSchemas.js';
const router = express.Router();

router.get('/byUserId', validate(getPostsByUserIdSchema), getPostsByUserId);
router.get('/', validate(getPostsSchema), getPosts);
router.post('/', validate(createNewPostSchema), createNewPost);
router.delete('/', validate(deletePostSchema), deletePost);
router.put('/', validate(updatePostSchema), updatePost);

export default router;
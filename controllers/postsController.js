import * as postsModel from '../models/postsModel.js';
import * as usersModel from '../models/usersModel.js';
import convertUserToSend from '../utills/convertUser.js';

const validateContentAndImages = (content, images, res) => {
    if (content === undefined || !images) {
        res.status(400).json({ message: 'content and images fields are required' });
        return false;
    } else if (!Array.isArray(images)) {
        res.status(400).json({ message: 'images must be an array' });
        return false;
    }

    return true;
}

export const createPost = async (req, res) => {
    const userId = req.userId;
    const content = req.body.content?.trim();
    const images = req.body.images;

    // validations
    const isValid = validateContentAndImages(content, images, res);
    if (!isValid) return;

    // create post
    const newPost = await postsModel.createNewPost(userId, content, images);
    newPost.user = convertUserToSend(await usersModel.getUserById(userId), req);

    res.status(201).json({ data: newPost });
}

export const updatePost = async (req, res) => {
    const userId = req.userId;
    const postId = req.query.postId?.trim();
    const content = req.body.content?.trim();
    const images = req.body.images;

    // validations
    if (!postId) {
        return res.status(400).json({ message: 'postId param is required' });
    }
    const isValid = validateContentAndImages(content, images, res);
    if (!isValid) return;

    // get post and validate
    let post = await postsModel.getPostById(postId);
    if (!post) {
        return res.status(404).json({ message: `Post with id ${postId} not found` });
    }
    if (post.user_id != userId) {
        return res.sendStatus(403);
    }

    // update post
    post = await postsModel.updatePost(postId, content, images);
    post.user = convertUserToSend(await usersModel.getUserById(userId), req);

    res.status(200).json({ data: post });
}

export const getPostsByUserId = async (req, res) => {
    const userId = req.query.userId;
    const limit = req.query.limit?.trim() ?? 999;
    const offset = req.query.offset?.trim() ?? 0;
    const cursor = req.query.cursor?.trim() ?? Date.now(); // int, created_at (works as before_time)

    // validations
    if (!userId) {
        return res.status(400).json({ message: 'userId param is required' });
    } else if (isNaN(userId)) {
        return res.status(400).json({ message: 'userId param must be int' });
    } else if (isNaN(limit)) {
        return res.status(400).json({ message: 'limit must be int' });
    } else if (isNaN(offset)) {
        return res.status(400).json({ message: 'offset must be int' });
    } else if (isNaN(cursor)) {
        return res.status(400).json({ message: 'cursor must be int' });
    }

    // get posts
    let posts = await postsModel.getPostsByUserId(userId, limit, offset, cursor);
    const user = convertUserToSend(await usersModel.getUserById(userId), req);
    posts.forEach(post => {
        post.user = user;
    });

    res.status(200).json({ data: posts ?? [], limit: limit, offset: offset, cursor: cursor });
}

export const getPosts = async (req, res) => {
    const limit = req.query.limit?.trim() ?? 999;
    const offset = req.query.offset?.trim() ?? 0;
    const cursor = req.query.cursor?.trim() ?? Date.now(); // int, created_at (works as before_time)

    // validations
    if (isNaN(limit)) {
        return res.status(400).json({ message: 'limit must be int' });
    } else if (isNaN(offset)) {
        return res.status(400).json({ message: 'offset must be int' });
    } else if (isNaN(cursor)) {
        return res.status(400).json({ message: 'cursor must be int' });
    }

    // get posts
    let posts = await postsModel.getPosts(limit, offset, cursor);
    // set users
    const usersMap = new Map();
    for (let i = 0; i < posts.length; i++) {
        const userId = posts[i].user_id;
        if (!usersMap.get(userId)) {
            usersMap.set(userId, convertUserToSend(await usersModel.getUserById(userId), req));
        }
        posts[i].user = usersMap.get(userId);
    }

    res.status(200).json({ data: posts ?? [], limit: limit, offset: offset, cursor: cursor });
}

export const deletePost = async (req, res) => {
    const userId = req.userId;
    const postId = req.query.postId;

    // validations
    if (!postId) {
        return res.status(400).json({ message: 'postId param is required' });
    } else if (isNaN(postId)) {
        return res.status(400).json({ message: 'postId must be int' });
    }

    // get post and validate
    const post = await postsModel.getPostById(postId);
    if (!post) {
        return res.status(404).json({ message: `Post with id ${postId} not found` });
    } else if (post.user_id != userId) {
        return res.sendStatus(403);
    }

    // delete post
    await postsModel.deletePostById(postId);
    
    post.user = convertUserToSend(await usersModel.getUserById(userId), req);
    res.status(200).json({ data: post });
}
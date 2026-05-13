import * as postsModel from '../models/postsModel.js';
import * as usersModel from '../models/usersModel.js';
import convertUserToSend from '../utills/convertUser.js';

export const createPost = async (req, res) => {
    const userId = req.userId;
    const content = req.body.content;
    const images = req.body.images;

    // create post 
    // TODO optimize
    const newPost = await postsModel.createNewPost(userId, content, images);
    newPost.user = convertUserToSend(await usersModel.getUserById(userId), req);

    return res.status(201).json({ data: newPost });
}

export const updatePost = async (req, res) => {
    const userId = req.userId;
    const postId = req.query.postId;
    const content = req.body.content;
    const images = req.body.images;

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

    return res.status(200).json({ data: post });
}

export const getPostsByUserId = async (req, res) => {
    const userId = req.query.userId;
    const limit = req.query.limit;
    const cursor = req.query.cursor; // last loaded post id

    // get posts
    let posts = await postsModel.getPostsByUserId(userId, limit, cursor);
    const user = convertUserToSend(await usersModel.getUserById(userId), req);
    posts.forEach(post => {
        post.user = user;
    });

    return res.status(200).json({ data: posts ?? [], limit: limit, cursor: cursor });
}

export const getPosts = async (req, res) => {
    const limit = req.query.limit;
    const cursor = req.query.cursor; // last loaded post id

    // get posts
    let posts = await postsModel.getPosts(limit, cursor);
    // set users
    const usersMap = new Map();
    for (let i = 0; i < posts.length; i++) {
        const userId = posts[i].user_id;
        if (!usersMap.get(userId)) {
            usersMap.set(userId, convertUserToSend(await usersModel.getUserById(userId), req));
        }
        posts[i].user = usersMap.get(userId);
    }

    return res.status(200).json({ data: posts ?? [], limit: limit, cursor: cursor });
}

export const deletePost = async (req, res) => {
    const userId = req.userId;
    const postId = req.query.postId;

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
    return res.status(200).json({ data: post });
}
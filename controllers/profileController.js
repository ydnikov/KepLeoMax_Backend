import pool from "../db.js";
import * as profilesModel from "../models/profilesModel.js";
import * as usersModel from '../models/usersModel.js';
import convertUserToSend from "../utills/convertUser.js";

export const editProfile = async (req, res) => {
    const userId = req.userId;
    const username = req.body.username;
    const description = req.body.description;
    const profileImage = req.body.profile_image;
    const updateImage = req.body.update_image;

    // update profile
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updatedProfile = await profilesModel.editProfileByUserId(userId, description, client);
        const updateUser = await usersModel.updateUser(userId, username, profileImage, updateImage, client);
        
        await client.query('COMMIT');
        
        updatedProfile.user = convertUserToSend(updateUser, req);
        return res.status(200).json({ data: updatedProfile });;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export const getProfile = async (req, res) => {
    const userId = req.query.userId;

    // get profile
    const profile = await profilesModel.getProfileByUserId(userId);
    if (!profile) {
        return res.status(404).json({ message: `Profile of user with id ${userId} not found` });
    }
    const user = await usersModel.getUserById(userId);
    profile.user = convertUserToSend(user, req);

    res.status(200).json({ data: profile });
}
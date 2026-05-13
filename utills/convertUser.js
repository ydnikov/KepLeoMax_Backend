const convertUserToSend = (user, req) => {
    if (!user) return null;

    const isCurrent = req?.userId === user.id;

    // console.log(`convertUser: ${JSON.stringify(user)}`);

    return {
        id: user.id,
        username: user.username,
        profile_image: user.profile_image,
        is_current: isCurrent,
        is_online: user.is_online,
        last_activity_time: user.last_activity_time,
    };
};

export default convertUserToSend;
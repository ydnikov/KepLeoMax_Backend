import { RateLimiterMemory } from 'rate-limiter-flexible';

export const rateLimiter = new RateLimiterMemory({
    points: 90,
    duration: 60,
});

export const rateLimitMiddleware = (req, res, next) => {
    const key = req.ip;
    rateLimiter.consume(key)
        .then((rateLimitRes) => {
            next();
        })
        .catch((rateLimitRes) => {
            res.setHeader('Retry-After', Math.round(rateLimitRes.msBeforeNext / 1000));
            res.status(429).json({ message: 'Too Many Requests' });
            console.log(`too many requests: ${req.ip}`);
        });

}
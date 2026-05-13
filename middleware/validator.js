import { ZodError } from 'zod';

export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (e) {
        if (e instanceof ZodError) {
            const errors = e.issues ?? e.errors ?? [];
            return res.status(400).json({
                message: 'Invalid data',
                errors: errors.map(error => ({ field: error.path.join('.'), message: error.message }))
            });
        } else {
            next(e);
        }
    }
}
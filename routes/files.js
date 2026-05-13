import express from 'express';
const router = express.Router();

import url from 'url';
import path from 'path';
import multer from "multer";
import verifyJWT from '../middleware/verifyJWT.js';
import sharp from 'sharp';
import { validate } from '../middleware/validator.js';
import { z } from 'zod';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    }, filename: (req, file, cb) => {
        const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const extension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + suffix + extension);
    }
});
const upload = multer({
    storage, limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});

router.post('/single', verifyJWT, upload.single('file'), (req, res) => {
    return res.status(201).json({ data: { path: req.file.filename } });
});

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getFileSchema = z.object({
    params: z.object({
        fileName: z.string()
    }),
    query: z.object({
        w: z.coerce.number().int().positive().optional()
    })
});
router.get('/:fileName', validate(getFileSchema), async (req, res) => {
    const fileName = req.params.fileName;
    const w = req.query.w;

    const imagePath = path.join(__dirname, '..', 'uploads', fileName);

    if (w) {
        const buffer = await sharp(imagePath)
            .resize(Number(w))
            .withMetadata()
            .toBuffer();
        res.send(buffer);
    } else {
        res.download(imagePath, (err) => {
            if (err) {
                console.error('Error downloading image:', err);
                res.status(500).json({ message: `Error downloading image: ${err}` });
            }
        });
    }
});

export default router;
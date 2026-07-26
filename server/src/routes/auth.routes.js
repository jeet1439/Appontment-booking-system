import express from 'express';

import { login } from '../controllers/auth.contoller.js';

const router = express.Router();

router.post("/login", login);

export default router;


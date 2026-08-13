import express from 'express';
import { generateItinerary, chat, generateDescription, status } from '../controllers/aiController.js';

const router = express.Router();

router.get('/status', status);
router.post('/itinerary', generateItinerary);
router.post('/chat', chat);
router.post('/description', generateDescription);

export default router;

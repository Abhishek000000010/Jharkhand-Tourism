import express from 'express';
import { getTouristDashboard } from '../controllers/touristController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', protect, authorize('tourist'), getTouristDashboard);

export default router;

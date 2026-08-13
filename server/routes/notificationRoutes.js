import express from 'express';
import {
  listNotifications,
  markRead,
  markAllRead,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Notifications belong to a user, not to a role — an admin has them too. Every
// query is scoped to req.user, so there is nothing else to authorize.
router.use(protect);

router.get('/', listNotifications);
router.post('/read-all', markAllRead);
router.post('/:id/read', markRead);

export default router;

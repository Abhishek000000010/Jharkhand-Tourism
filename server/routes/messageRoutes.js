import express from 'express';
import {
  startConversation,
  listConversations,
  getUnreadCount,
  getThread,
  sendMessage,
} from '../controllers/messageController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Everything here needs a signed-in participant. Thread-level membership is checked
// inside the controller — role alone is never enough to open someone else's thread.
router.use(protect, authorize('tourist', 'operator'));

router.route('/conversations')
  // Only a traveller opens a thread; an operator replies to one that exists, which
  // keeps hosts from cold-messaging people who never showed interest.
  .post(authorize('tourist'), startConversation)
  .get(listConversations);

router.get('/unread', getUnreadCount);

router.get('/conversations/:id', getThread);
router.post('/conversations/:id/messages', sendMessage);

export default router;

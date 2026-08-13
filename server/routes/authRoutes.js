import express from 'express';
import { registerUser, loginUser, getMe } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);

// Example of a protected admin-only route for testing role guards
router.get('/admin-only', protect, authorize('admin'), (req, res) => {
  res.status(200).json({ success: true, message: 'You have admin access' });
});

// NOTE: the old POST /make-me-admin route was removed. It let ANY logged-in user
// promote themselves to admin, which would have handed them the KYC documents and
// the verification queue. Create admins with `npm run seed:admin` instead.

export default router;

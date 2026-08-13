import express from 'express';
import { 
  getPendingOperators, 
  verifyOperator, 
  getSecureKycUrl, 
  getEmailQueue, 
  getAnalytics 
} from '../controllers/adminController.js';
import { getSettings, updateSettings } from '../controllers/paymentController.js';
import { adminRefund } from '../controllers/cancellationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes here are admin only
router.use(protect);
router.use(authorize('admin'));

router.get('/operators/pending', getPendingOperators);
router.put('/operators/:id/verify', verifyOperator);
router.get('/operators/:id/kyc-url', getSecureKycUrl);
router.get('/emails', getEmailQueue);

router.route('/settings')
  .get(getSettings)
  .put(updateSettings);

// Analytics
router.get('/analytics', getAnalytics);

// Dispute resolution — manual refund outside the automatic policy
router.post('/bookings/:id/refund', adminRefund);

export default router;

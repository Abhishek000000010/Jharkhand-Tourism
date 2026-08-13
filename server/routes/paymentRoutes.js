import express from 'express';
import { createOrder, verifyPayment, mockConfirm } from '../controllers/paymentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// NOTE: POST /api/payments/webhook is deliberately NOT declared here. It needs the raw
// request body for signature verification, so it is mounted in index.js ahead of the
// global express.json() middleware.

router.post('/order', protect, authorize('tourist'), createOrder);
router.post('/verify', protect, authorize('tourist'), verifyPayment);
router.post('/mock-confirm', protect, authorize('tourist'), mockConfirm);

export default router;

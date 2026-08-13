import express from 'express';
import multer from 'multer';
import {
  submitProfile,
  getMyProfile,
  createListing,
  getMyListings,
  updateListing,
  deleteListing,
  getListingCalendarForOperator,
  createBlock,
  deleteBlock,
  getAnalytics,
  getTimeline,
} from '../controllers/operatorController.js';
import { getOperatorBookings } from '../controllers/bookingController.js';
import { rejectBooking, markNoShow, markCompleted } from '../controllers/cancellationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Setup Multer for memory storage (file buffer is sent to cloudinary).
// The size cap and type filter matter here: without them a single request could
// buffer an arbitrarily large file straight into server memory.
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, WebP images and PDF documents are allowed'));
  },
});

router.route('/profile')
  .post(protect, authorize('operator'), upload.single('kycDocument'), submitProfile)
  .get(protect, authorize('operator'), getMyProfile);

router.route('/listings')
  .post(protect, authorize('operator'), upload.array('images', 5), createListing)
  .get(protect, authorize('operator'), getMyListings);

router.route('/listings/:id')
  .put(protect, authorize('operator'), updateListing)
  .delete(protect, authorize('operator'), deleteListing);

// --- Phase 4: availability ---
router.get('/bookings', protect, authorize('operator'), getOperatorBookings);

// --- Phase 6: settling a booking ---
router.post('/bookings/:id/reject', protect, authorize('operator'), rejectBooking);
router.post('/bookings/:id/no-show', protect, authorize('operator'), markNoShow);
router.post('/bookings/:id/complete', protect, authorize('operator'), markCompleted);
router.get('/listings/:id/calendar', protect, authorize('operator'), getListingCalendarForOperator);
router.post('/listings/:id/blocks', protect, authorize('operator'), createBlock);
router.delete('/blocks/:blockId', protect, authorize('operator'), deleteBlock);

// --- Analytics ---
// `protect` must run first: `authorize` only reads req.user, so without it the
// route rejected every request with a bare "Not authorized".
router.get('/analytics', protect, authorize('operator'), getAnalytics);

// Day-by-day agenda: who arrives, who leaves, who is in the house tonight.
router.get('/timeline', protect, authorize('operator'), getTimeline);

export default router;

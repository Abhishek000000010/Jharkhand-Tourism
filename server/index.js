// dotenv must load before any other local import, because ES module imports are
// evaluated before this file's body runs. Anything that reads process.env at
// import time (e.g. the Cloudinary config) would otherwise see undefined values.
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { configureCloudinary } from './config/cloudinary.js';
import { configureRazorpay } from './config/razorpay.js';
import { configureMailer } from './config/mailer.js';
import { startHoldSweeper } from './services/holdSweeper.js';
import { startEmailWorker } from './services/emailService.js';
import { handleWebhook } from './controllers/paymentController.js';
import authRoutes from './routes/authRoutes.js';
import operatorRoutes from './routes/operatorRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import touristRoutes from './routes/touristRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

// Fail fast on missing secrets rather than signing tokens with `undefined`
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('FATAL: MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

connectDB();
configureCloudinary();
configureRazorpay();
configureMailer();
startHoldSweeper();
startEmailWorker();

const app = express();

app.use(cors());

// The Razorpay webhook is mounted BEFORE express.json() and takes the body as a raw
// Buffer. Its signature is an HMAC over the exact bytes Razorpay sent, so verifying
// against a re-serialised JSON object would fail on any key-order or whitespace
// difference. Everything else in the app is happy with parsed JSON.
app.post('/api/payments/webhook', express.raw({ type: '*/*' }), handleWebhook);

app.use(express.json());

// Health Check Route — reports the real Mongo connection state instead of a hardcoded string
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Backend server is running',
    dbConnection: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/tourist', touristRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Central error handler — catches Multer errors (e.g. file too large) and anything
// a controller forwards with next(err), so the client always gets JSON not an HTML page.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File is too large. Maximum size is 5MB.' });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'Too many files uploaded.' });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server error',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

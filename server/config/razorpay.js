import Razorpay from 'razorpay';

/**
 * Razorpay client, configured after dotenv has loaded (see index.js import order).
 *
 * When credentials are absent the whole payment layer falls back to a local mock
 * gateway so the booking flow stays testable without a Razorpay account — the same
 * pattern the Cloudinary config uses. `isRazorpayConfigured()` is the only thing that
 * decides which path runs, so there is exactly one switch to reason about.
 */

let client = null;

export const isRazorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export const configureRazorpay = () => {
  if (!isRazorpayConfigured()) {
    console.warn('Razorpay credentials not set — payments will use the local mock gateway.');
    return;
  }

  client = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.warn('RAZORPAY_WEBHOOK_SECRET is not set — incoming webhooks will be rejected.');
  }

  console.log('Razorpay configured (test mode keys expected)');
};

export const getRazorpay = () => {
  if (!client) throw new Error('Razorpay is not configured');
  return client;
};

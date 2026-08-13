import { v2 as cloudinary } from 'cloudinary';

/**
 * Single place where Cloudinary is configured.
 *
 * This module is imported by index.js AFTER dotenv has loaded. Previously each
 * controller called cloudinary.config() at import time, which ran before
 * dotenv.config() (ES module imports are evaluated before the importing module's
 * body), so the SDK silently ended up holding placeholder credentials and every
 * real upload would have failed.
 */

// True only when all three credentials are actually present.
export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

export const configureCloudinary = () => {
  if (!isCloudinaryConfigured()) {
    console.warn('Cloudinary credentials not set — file uploads will use local mock placeholders.');
    return;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  console.log('Cloudinary configured');
};

export default cloudinary;

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

/**
 * Creates (or promotes) the Tourism Department admin account.
 *
 * Admin is a government role, so it deliberately cannot be created through the
 * public /api/auth/register endpoint. Run this from the `server` folder:
 *
 *   npm run seed:admin
 *
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD in .env, with sane defaults
 * for local development.
 */
const seedAdmin = async () => {
  const email = (process.env.ADMIN_EMAIL || 'admin@jharkhandtourism.gov.in').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Tourism Department Admin';

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const existing = await User.findOne({ email });

    if (existing) {
      if (existing.role === 'admin') {
        console.log(`Admin already exists: ${email} (no changes made)`);
      } else {
        existing.role = 'admin';
        await existing.save();
        console.log(`Promoted existing user to admin: ${email}`);
      }
    } else {
      await User.create({ name, email, password, role: 'admin' });
      console.log(`Admin created: ${email}`);
      console.log(`Password: ${password}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`Seed failed: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();

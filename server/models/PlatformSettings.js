import mongoose from 'mongoose';

/**
 * Single-document collection holding platform-wide configuration the admin can change.
 *
 * The commission rate lives here rather than in an env var because the tourism
 * department needs to change it without a redeploy. Note that every booking snapshots
 * the rate it was created under — changing this value never rewrites past bookings.
 */
const platformSettingsSchema = new mongoose.Schema(
  {
    // `singleton: true` with a unique index guarantees exactly one settings document
    singleton: {
      type: Boolean,
      default: true,
      unique: true,
    },
    commissionPercent: {
      type: Number,
      default: 10,
      min: [0, 'Commission cannot be negative'],
      max: [50, 'Commission cannot exceed 50%'],
    },
  },
  { timestamps: true }
);

platformSettingsSchema.statics.current = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

export default mongoose.model('PlatformSettings', platformSettingsSchema);

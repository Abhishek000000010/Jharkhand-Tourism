import Booking from '../models/Booking.js';

/**
 * Marks lapsed holds as `expired`.
 *
 * Availability is already correct without this — the engine's query filter ignores
 * holds whose expiry has passed, so inventory frees itself the moment the clock runs
 * out. This sweeper exists so the *stored status* matches reality, which is what the
 * tourist's bookings list and the operator's dashboard read.
 *
 * Runs in-process on an interval rather than as an external cron: one less moving part
 * to deploy, and the work is a single indexed update.
 */
const SWEEP_INTERVAL_MS = 60 * 1000;

export const sweepExpiredHolds = async () => {
  const result = await Booking.updateMany(
    { status: 'pending_payment', holdExpiresAt: { $lte: new Date() } },
    { $set: { status: 'expired' } }
  );

  if (result.modifiedCount > 0) {
    console.log(`Released ${result.modifiedCount} expired hold(s)`);
  }

  return result.modifiedCount;
};

export const startHoldSweeper = () => {
  const tick = () => {
    sweepExpiredHolds().catch(err => console.error('Hold sweep failed:', err.message));
  };

  tick(); // clear anything that lapsed while the server was down

  const timer = setInterval(tick, SWEEP_INTERVAL_MS);
  timer.unref?.(); // never hold the process open just for the sweeper
  return timer;
};

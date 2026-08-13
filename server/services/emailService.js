import EmailJob from '../models/EmailJob.js';
import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import OperatorProfile from '../models/OperatorProfile.js';
import User from '../models/User.js';
import { getTransport, mailFrom, isMailConfigured } from '../config/mailer.js';
import { buildVoucherPdf } from './voucherService.js';
import * as T from './emailTemplates.js';

const WORKER_INTERVAL_MS = 20 * 1000;
const BATCH_SIZE = 10;

const appUrl = () => process.env.APP_URL || 'http://localhost:5173';

/**
 * Put a message in the outbox.
 *
 * Never throws. Every caller sits on a path where money has already moved or a decision
 * has already been recorded, so a failure to *queue* an email must not unwind that work.
 * The worst case is a logged error and a message nobody receives — never a lost booking.
 */
export const enqueueEmail = async (job) => {
  try {
    if (!job.to) return null;
    return await EmailJob.create(job);
  } catch (err) {
    // Duplicate dedupeKey is the expected path when a webhook is replayed, not an error
    if (err.code === 11000) return null;
    console.error(`Could not queue ${job.type} email:`, err.message);
    return null;
  }
};

/** Everything a booking email needs, fetched once. */
const bookingContext = async (booking) => {
  const [listing, operatorProfile, tourist, operatorUser] = await Promise.all([
    Listing.findById(booking.listing).lean(),
    OperatorProfile.findOne({ user: booking.operator }).lean(),
    User.findById(booking.tourist).lean(),
    User.findById(booking.operator).lean(),
  ]);
  return { listing, operatorProfile, tourist, operatorUser };
};

// ---------------------------------------------------------------------------
// Event notifications. Each is safe to call more than once — the dedupeKey means
// a replayed payment webhook cannot email the traveller twice.
// ---------------------------------------------------------------------------

export const notifyBookingConfirmed = async (booking) => {
  try {
    const { listing, operatorProfile, tourist, operatorUser } = await bookingContext(booking);

    const traveller = T.bookingConfirmedTraveller({ booking, listing, operatorProfile, tourist });
    await enqueueEmail({
      type: 'booking_confirmed_traveller',
      to: tourist?.email,
      ...traveller,
      attachVoucherFor: booking._id,
      dedupeKey: `confirmed_traveller:${booking._id}`,
    });

    const operator = T.bookingConfirmedOperator({ booking, listing, tourist });
    await enqueueEmail({
      type: 'booking_confirmed_operator',
      to: operatorUser?.email,
      ...operator,
      dedupeKey: `confirmed_operator:${booking._id}`,
    });
  } catch (err) {
    console.error('notifyBookingConfirmed failed:', err.message);
  }
};

export const notifyBookingCancelled = async (booking, { refundedPaise, refundPercent }) => {
  try {
    const { listing, tourist, operatorUser } = await bookingContext(booking);

    const traveller = T.bookingCancelledTraveller({ booking, listing, refundedPaise, refundPercent });
    await enqueueEmail({
      type: 'booking_cancelled_traveller',
      to: tourist?.email,
      ...traveller,
      dedupeKey: `cancelled_traveller:${booking._id}`,
    });

    const operator = T.bookingCancelledOperator({ booking, listing, tourist });
    await enqueueEmail({
      type: 'booking_cancelled_operator',
      to: operatorUser?.email,
      ...operator,
      dedupeKey: `cancelled_operator:${booking._id}`,
    });
  } catch (err) {
    console.error('notifyBookingCancelled failed:', err.message);
  }
};

export const notifyBookingRejected = async (booking, { reason, refundedPaise }) => {
  try {
    const { listing, operatorProfile, tourist } = await bookingContext(booking);

    const traveller = T.bookingRejectedTraveller({ booking, listing, operatorProfile, reason, refundedPaise });
    await enqueueEmail({
      type: 'booking_rejected_traveller',
      to: tourist?.email,
      ...traveller,
      dedupeKey: `rejected_traveller:${booking._id}`,
    });
  } catch (err) {
    console.error('notifyBookingRejected failed:', err.message);
  }
};

export const notifyRefundIssued = async (booking, { refundedPaise, reason }) => {
  try {
    const { listing, tourist } = await bookingContext(booking);

    const traveller = T.refundIssuedTraveller({ booking, listing, refundedPaise, reason });
    await enqueueEmail({
      type: 'refund_issued_traveller',
      to: tourist?.email,
      ...traveller,
      // Admins can refund the same booking more than once, so the amount is part of the key
      dedupeKey: `refund_traveller:${booking._id}:${booking.refundedPaise}`,
    });
  } catch (err) {
    console.error('notifyRefundIssued failed:', err.message);
  }
};

export const notifyOperatorDecision = async (profile, status, reason) => {
  try {
    const operatorUser = await User.findById(profile.user).lean();
    if (!operatorUser?.email) return;

    const approved = status === 'approved';
    const built = approved
      ? T.operatorApproved({ profile, appUrl: appUrl() })
      : T.operatorRejected({ profile, reason, appUrl: appUrl() });

    await enqueueEmail({
      type: approved ? 'operator_approved' : 'operator_rejected',
      to: operatorUser.email,
      ...built,
      // Keyed on the decision count so a re-submission and second decision still sends
      dedupeKey: `operator_decision:${profile._id}:${status}:${profile.updatedAt?.getTime?.() || Date.now()}`,
    });
  } catch (err) {
    console.error('notifyOperatorDecision failed:', err.message);
  }
};

// ---------------------------------------------------------------------------
// The worker
// ---------------------------------------------------------------------------

/** Exponential backoff: roughly 1, 2, 4, 8 then 16 minutes between attempts. */
const backoffMs = (attempts) => Math.min(2 ** attempts, 16) * 60 * 1000;

const deliver = async (job) => {
  // In development every account is a @demo.test address that does not exist.
  // The SMTP relay accepts the message and it then bounces into nothing, which
  // looks exactly like "email is broken". MAIL_REDIRECT_TO sends the whole lot
  // to one real inbox instead, with the intended recipient kept in the subject.
  const redirectTo = process.env.MAIL_REDIRECT_TO;
  const redirected = Boolean(redirectTo) && job.to !== redirectTo;

  const message = {
    from: mailFrom(),
    to: redirected ? redirectTo : job.to,
    subject: redirected ? `[to: ${job.to}] ${job.subject}` : job.subject,
    text: job.text,
    html: job.html,
  };

  // Regenerated at send time rather than stored, so a queued job stays small
  if (job.attachVoucherFor) {
    const booking = await Booking.findById(job.attachVoucherFor);
    if (booking && booking.status === 'confirmed') {
      const [listing, profile, tourist] = await Promise.all([
        Listing.findById(booking.listing).lean(),
        OperatorProfile.findOne({ user: booking.operator }).lean(),
        User.findById(booking.tourist).lean(),
      ]);
      const pdf = await buildVoucherPdf(booking, listing, profile, tourist);
      message.attachments = [{
        filename: `voucher-${booking.bookingRef || booking._id}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      }];
    }
  }

  await getTransport().sendMail(message);
};

/**
 * Drain due jobs. Each job is claimed with an atomic findOneAndUpdate so that two
 * workers — or two server instances — cannot deliver the same message twice.
 */
export const processEmailQueue = async ({ limit = BATCH_SIZE } = {}) => {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < limit; i++) {
    const job = await EmailJob.findOneAndUpdate(
      { status: 'pending', nextAttemptAt: { $lte: new Date() } },
      { $inc: { attempts: 1 }, $set: { nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000) } },
      { sort: { createdAt: 1 }, new: true }
    );

    if (!job) break;

    try {
      await deliver(job);
      job.status = 'sent';
      job.sentAt = new Date();
      job.lastError = undefined;
      await job.save();
      sent++;

      if (!isMailConfigured()) {
        console.log(`[mail:dev] ${job.type} -> ${job.to} — "${job.subject}"`);
      }
    } catch (err) {
      failed++;
      job.lastError = err.message?.slice(0, 300);

      if (job.attempts >= job.maxAttempts) {
        // Give up, but keep the record so the failure is visible rather than silent
        job.status = 'failed';
        console.error(`Email ${job.type} to ${job.to} failed permanently: ${err.message}`);
      } else {
        job.status = 'pending';
        job.nextAttemptAt = new Date(Date.now() + backoffMs(job.attempts));
        console.warn(`Email ${job.type} attempt ${job.attempts} failed, retrying: ${err.message}`);
      }

      await job.save();
    }
  }

  return { sent, failed };
};

export const startEmailWorker = () => {
  const tick = () => {
    processEmailQueue().catch(err => console.error('Email worker failed:', err.message));
  };

  tick(); // deliver anything queued while the server was down

  const timer = setInterval(tick, WORKER_INTERVAL_MS);
  timer.unref?.();
  return timer;
};

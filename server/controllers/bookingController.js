import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import OperatorProfile from '../models/OperatorProfile.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import { buildVoucherPdf, archiveVoucher } from '../services/voucherService.js';
import { verifyVoucherToken } from '../services/paymentService.js';
import { policyPreview } from '../services/refundService.js';
import {
  checkAvailability,
  getCalendar,
  resolveRange,
  nightsBetween,
  capacityOf,
  toUtcMidnight,
  HOLD_MINUTES,
} from '../services/availabilityService.js';

/**
 * Load a listing that the public is actually allowed to book: it must exist, be
 * active, and belong to an approved operator. Returns null otherwise so callers
 * can return an indistinguishable 404.
 */
const findBookableListing = async (listingId) => {
  const listing = await Listing.findById(listingId).lean();
  if (!listing || !listing.isActive) return null;

  const profile = await OperatorProfile.findOne({ user: listing.operator, status: 'approved' }).lean();
  if (!profile) return null;

  return listing;
};

// @desc    Check whether a listing can be booked for the given dates/quantity
// @route   POST /api/bookings/check
// @access  Public
export const checkListingAvailability = async (req, res) => {
  try {
    const { listingId, checkIn, checkOut, date, units } = req.body;

    const listing = await findBookableListing(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // `??` not `||`: a request for 0 units must be rejected by the validator, not
    // silently rewritten into a request for 1.
    const requestedUnits = units ?? 1;

    const result = await checkAvailability(listing, { checkIn, checkOut, date, units: requestedUnits });

    // Quote the price alongside the answer so the UI never has to recompute it
    let quote = null;
    if (result.available) {
      const nights = result.nights || 1;
      const requested = Number(requestedUnits);
      const pricePerUnitPaise = Math.round(listing.price * 100);

      quote = {
        pricePerUnitPaise,
        units: requested,
        nights: listing.category === 'artisan' ? null : nights,
        amountPaise: pricePerUnitPaise * requested * (listing.category === 'artisan' ? 1 : nights),
      };
    }

    // The cancellation terms must be visible BEFORE payment, not discovered afterwards
    const cancellationPolicy = result.available
      ? policyPreview(listing.category === 'artisan' ? null : (result.start || checkIn || date))
      : null;

    res.status(200).json({ success: true, ...result, quote, cancellationPolicy });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Day-by-day availability for a listing
// @route   GET /api/bookings/calendar/:listingId?from=YYYY-MM-DD&to=YYYY-MM-DD
// @access  Public
export const getListingCalendar = async (req, res) => {
  try {
    const listing = await findBookableListing(req.params.listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    const calendar = await getCalendar(listing, req.query.from, req.query.to);

    res.status(200).json({ success: true, category: listing.category, ...calendar });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Place a 10-minute hold on a listing (payment is attached in Phase 5)
// @route   POST /api/bookings/hold
// @access  Private/Tourist
export const createHold = async (req, res) => {
  try {
    const { listingId, checkIn, checkOut, date, units, guestName, guestPhone } = req.body;

    const listing = await findBookableListing(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // An operator booking their own listing would let them game their own availability
    if (listing.operator.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot book your own listing' });
    }

    // `??` not `||`, so an explicit 0 is rejected rather than turned into 1
    const requested = Number(units ?? 1);

    // The authoritative check. Phase 5 must run this again inside the payment
    // confirm step — two tourists can both pass here and only one can win.
    const result = await checkAvailability(listing, { checkIn, checkOut, date, units: requested });

    if (!result.available) {
      return res.status(409).json({ success: false, message: result.reason, remaining: result.remaining });
    }

    const range = resolveRange(listing, { checkIn, checkOut, date });
    const nights = listing.category === 'artisan' ? 1 : nightsBetween(range.start, range.end);

    const pricePerUnitPaise = Math.round(listing.price * 100);

    const booking = await Booking.create({
      tourist: req.user.id,
      listing: listing._id,
      operator: listing.operator,
      category: listing.category,
      checkIn: range.start,
      checkOut: range.end,
      units: requested,
      pricePerUnitPaise,
      amountPaise: pricePerUnitPaise * requested * nights,
      status: 'pending_payment',
      holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
      guestName,
      guestPhone,
    });

    res.status(201).json({ success: true, booking, holdMinutes: HOLD_MINUTES });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bookings belonging to the logged-in tourist
// @route   GET /api/bookings/mine
// @access  Private/Tourist
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ tourist: req.user.id })
      .populate('listing', 'title category district images price')
      .sort('-createdAt')
      .lean();

    // Whether each completed booking has already been reviewed. Without this
    // the page offered "Leave a review" on every completed stay, and a second
    // submission failed on the one-review-per-booking constraint.
    const reviews = await Review.find({ tourist: req.user.id })
      .select('booking rating')
      .lean();
    const byBooking = new Map(reviews.map(r => [String(r.booking), r.rating]));

    for (const b of bookings) {
      const rating = byBooking.get(String(b._id));
      b.myReviewRating = rating ?? null;
      b.hasReview = rating !== undefined;
    }

    res.status(200).json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Release a hold the tourist no longer wants
// @route   DELETE /api/bookings/:id
// @access  Private/Tourist
export const releaseHold = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.tourist.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this booking' });
    }

    // Phase 6 owns cancelling a *paid* booking, because that involves refund maths.
    if (booking.status !== 'pending_payment') {
      return res.status(400).json({ success: false, message: 'Only unpaid holds can be released here' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.status(200).json({ success: true, message: 'Hold released' });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bookings across all of the logged-in operator's listings
// @route   GET /api/operator/bookings
// @access  Private/Operator
//
// Optional filters let the availability calendar deep-link straight to the
// reservations standing in the way of a closure:
//   ?listing=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD&status=confirmed,pending_payment
export const getOperatorBookings = async (req, res) => {
  try {
    const query = { operator: req.user.id };
    const applied = {};

    if (req.query.listing) {
      query.listing = req.query.listing;
      applied.listing = req.query.listing;
    }

    const statuses = String(req.query.status || '').split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) {
      query.status = { $in: statuses };
      applied.status = statuses;
    }

    // Same half-open overlap test the availability engine uses: a stay counts if
    // it touches any night in [from, to), not only if it starts inside it.
    const from = toUtcMidnight(req.query.from);
    const to = toUtcMidnight(req.query.to);

    if (from && to && to > from) {
      query.checkIn = { $lt: to };
      query.checkOut = { $gt: from };
      applied.from = req.query.from;
      applied.to = req.query.to;
    }

    const bookings = await Booking.find(query)
      .populate('listing', 'title category district')
      .populate('tourist', 'name email')
      .sort('-createdAt')
      .lean();

    res.status(200).json({ success: true, count: bookings.length, bookings, filters: applied });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid filter value' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Download the e-voucher PDF for a confirmed booking
// @route   GET /api/bookings/:id/voucher
// @access  Private (the booking's tourist, or the operator fulfilling it)
export const downloadVoucher = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isTourist = booking.tourist.toString() === req.user.id;
    const isOperator = booking.operator.toString() === req.user.id;
    if (!isTourist && !isOperator) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this voucher' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'A voucher is only issued once payment is confirmed' });
    }

    const [listing, profile, tourist] = await Promise.all([
      Listing.findById(booking.listing).lean(),
      OperatorProfile.findOne({ user: booking.operator }).lean(),
      User.findById(booking.tourist).lean(),
    ]);

    const pdf = await buildVoucherPdf(booking, listing, profile, tourist);

    // Archive a copy to Cloudinary the first time the voucher is produced.
    // Deliberately not awaited into the response path: the traveller's download
    // must not fail, or wait, because a storage provider is slow.
    if (!booking.voucherPublicId) {
      archiveVoucher(booking, pdf)
        .then(async (archived) => {
          if (!archived) return;
          booking.voucherPublicId = archived.publicId;
          booking.voucherArchivedAt = new Date();
          await booking.save();
        })
        .catch(err => console.error(`Voucher archive failed for ${booking.bookingRef}:`, err.message));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="voucher-${booking.bookingRef || booking._id}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Booking not found' });
    res.status(500).json({ success: false, message: error.message });
  }
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

/**
 * Target of the voucher QR code. Deliberately returns a small HTML page rather than
 * JSON, so an operator scanning with an ordinary phone camera gets a readable answer.
 *
 * Public by design — the HMAC in the query string is the credential. It reveals only
 * what the operator needs to admit the guest.
 */
// @route   GET /api/bookings/verify/:id?t=<token>
// @access  Public (authenticated by the voucher HMAC)
export const verifyVoucher = async (req, res) => {
  const page = (ok, title, rows = []) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Voucher verification</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#18181b;
       margin:0;padding:2rem 1.25rem;display:flex;justify-content:center}
  .box{max-width:420px;width:100%}
  .status{padding:1rem 1.25rem;border-radius:12px;font-weight:600;margin-bottom:1.5rem;
          background:${ok ? '#f0fdf4' : '#fef2f2'};color:${ok ? '#15803d' : '#b91c1c'};
          border:1px solid ${ok ? '#bbf7d0' : '#fecaca'}}
  .row{display:flex;justify-content:space-between;gap:1rem;padding:.7rem 0;border-bottom:1px solid #e8e8ea;font-size:.92rem}
  .row span:first-child{color:#6b7280}
  .row span:last-child{font-weight:500;text-align:right}
</style></head><body><div class="box">
<div class="status">${escapeHtml(title)}</div>
${rows.map(([k, v]) => `<div class="row"><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`).join('')}
</div></body></html>`;

  try {
    const { id } = req.params;

    if (!verifyVoucherToken(id, req.query.t)) {
      return res.status(400).type('html').send(page(false, 'Invalid voucher'));
    }

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).type('html').send(page(false, 'Voucher not found'));

    if (booking.status !== 'confirmed') {
      return res.status(200).type('html').send(page(false, `Not valid — booking is ${booking.status.replace('_', ' ')}`));
    }

    const [listing, tourist] = await Promise.all([
      Listing.findById(booking.listing).lean(),
      User.findById(booking.tourist).lean(),
    ]);

    const rows = [
      ['Reference', booking.bookingRef],
      ['Experience', listing?.title],
      ['Guest', booking.guestName || tourist?.name],
    ];

    if (booking.category === 'artisan') {
      rows.push(['Quantity', `${booking.units} item(s)`]);
    } else if (booking.category === 'guide') {
      rows.push(['Date', new Date(booking.checkIn).toISOString().slice(0, 10)]);
    } else {
      rows.push(['Check-in', new Date(booking.checkIn).toISOString().slice(0, 10)]);
      rows.push(['Check-out', new Date(booking.checkOut).toISOString().slice(0, 10)]);
      rows.push(['Rooms', booking.units]);
    }

    // The scan-result page is HTML, so the real symbol renders natively here —
    // "Rs" was only ever a workaround for the PDF's non-Unicode base fonts.
    rows.push(['Paid', `₹${(booking.amountPaise / 100).toLocaleString('en-IN')}`]);

    res.status(200).type('html').send(page(true, 'Valid booking', rows));
  } catch (error) {
    res.status(500).type('html').send(page(false, 'Could not verify this voucher'));
  }
};

// Exported for the operator calendar route, which needs capacity without re-deriving it
export const listingCapacity = capacityOf;

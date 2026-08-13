import Booking, { ACTIVE_BOOKING_FILTER } from '../models/Booking.js';
import AvailabilityBlock from '../models/AvailabilityBlock.js';

// How long a tourist gets to pay before the hold is released (Phase 5 wires the
// actual payment; the engine already refuses to count expired holds).
export const HOLD_MINUTES = 10;

// Guard rails: nobody books a homestay for two years to squat the calendar.
export const MAX_NIGHTS = 30;
export const MAX_CALENDAR_DAYS = 365;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse a YYYY-MM-DD string into a Date pinned to UTC midnight.
 *
 * Everything in the engine is UTC-midnight so that a server in one timezone and a
 * browser in another agree on which night is being booked. Using `new Date(str)`
 * directly would drift by a day either side of the date line.
 *
 * Returns null for anything malformed, including calendar-invalid dates like
 * 2026-02-31 (which JS would otherwise silently roll forward to March 3rd).
 */
export const toUtcMidnight = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  if (typeof value !== 'string' || !DATE_RE.test(value.trim())) return null;

  const [year, month, day] = value.trim().split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

export const addDays = (date, days) => new Date(date.getTime() + days * MS_PER_DAY);

export const todayUtc = () => toUtcMidnight(new Date());

export const nightsBetween = (start, end) => Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);

export const toDateKey = (date) => date.toISOString().slice(0, 10);

/**
 * Maximum number of units occupied at any single moment inside [windowStart, windowEnd).
 *
 * Counting overlapping intervals is NOT the same thing and would over-reject: in a
 * 2-room homestay, bookings of 12th-14th and 14th-16th both overlap a 12th-16th
 * request, but they never coincide, so a room is free every night.
 *
 * Sweep-line: +units when an interval opens, -units when it closes. At an identical
 * timestamp the closing event is applied first, which is exactly the rule that lets
 * a guest check in on the same day another checks out.
 */
const maxConcurrentUnits = (intervals, windowStart, windowEnd) => {
  const events = [];

  for (const interval of intervals) {
    // Clip to the window so bookings hanging outside it don't inflate the count
    const start = interval.start < windowStart ? windowStart : interval.start;
    const end = interval.end > windowEnd ? windowEnd : interval.end;
    if (start >= end) continue;

    events.push({ time: start.getTime(), delta: interval.units });
    events.push({ time: end.getTime(), delta: -interval.units });
  }

  // Ascending by time; at equal times negative deltas (check-outs) sort first.
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);

  let running = 0;
  let peak = 0;
  for (const event of events) {
    running += event.delta;
    if (running > peak) peak = running;
  }

  return peak;
};

/** Capacity of a listing, expressed in the unit that category sells. */
export const capacityOf = (listing) => {
  if (listing.category === 'homestay') return listing.rooms || 0;
  if (listing.category === 'guide') return 1; // one guide, one booking per day
  return listing.stockQuantity || 0; // artisan
};

/**
 * Validate and normalise a requested date range.
 * Returns { start, end } on success, or { error } describing what was wrong.
 */
export const resolveRange = (listing, { checkIn, checkOut, date }) => {
  if (listing.category === 'artisan') return { start: null, end: null };

  if (listing.category === 'guide') {
    // A guide is booked by the day; store it as a single night so the overlap
    // maths is identical to a homestay's.
    const day = toUtcMidnight(date || checkIn);
    if (!day) return { error: 'Provide a valid booking date as YYYY-MM-DD' };
    return { start: day, end: addDays(day, 1) };
  }

  const start = toUtcMidnight(checkIn);
  const end = toUtcMidnight(checkOut);

  if (!start) return { error: 'Provide a valid check-in date as YYYY-MM-DD' };
  if (!end) return { error: 'Provide a valid check-out date as YYYY-MM-DD' };

  // Same-day is rejected too: zero nights is not a stay.
  if (end <= start) return { error: 'Check-out must be after check-in' };

  const nights = nightsBetween(start, end);
  if (nights > MAX_NIGHTS) return { error: `Maximum stay is ${MAX_NIGHTS} nights` };

  return { start, end };
};

/**
 * The single source of truth for "can this be booked?".
 *
 * Phase 5 must call this again inside the payment-confirm step, because two
 * tourists can pass this check simultaneously and only one of them can win.
 */
export const checkAvailability = async (listing, { checkIn, checkOut, date, units = 1, excludeBookingId = null }) => {
  const capacity = capacityOf(listing);

  const requested = Number(units);
  if (!Number.isInteger(requested) || requested < 1) {
    return { available: false, reason: 'Requested quantity must be a whole number of at least 1' };
  }

  if (!listing.isActive) {
    return { available: false, reason: 'This listing is not currently accepting bookings' };
  }

  if (capacity < 1) {
    return { available: false, reason: listing.category === 'artisan' ? 'This item is out of stock' : 'This listing has no availability configured' };
  }

  if (requested > capacity) {
    return {
      available: false,
      reason: listing.category === 'artisan'
        ? `Only ${capacity} in stock`
        : `This listing only has ${capacity} ${listing.category === 'homestay' ? 'room(s)' : 'slot(s)'}`,
    };
  }

  // ---- Artisan: pure stock arithmetic, no calendar ----
  if (listing.category === 'artisan') {
    const query = { listing: listing._id, ...ACTIVE_BOOKING_FILTER() };
    if (excludeBookingId) query._id = { $ne: excludeBookingId };

    const activeOrders = await Booking.find(query).select('units').lean();
    const reserved = activeOrders.reduce((sum, b) => sum + (b.units || 0), 0);
    const remaining = capacity - reserved;

    if (requested > remaining) {
      return {
        available: false,
        reason: remaining <= 0 ? 'This item is out of stock' : `Only ${remaining} left in stock`,
        remaining: Math.max(0, remaining),
      };
    }

    return { available: true, remaining: remaining - requested };
  }

  // ---- Homestay / guide: date-range capacity ----
  const range = resolveRange(listing, { checkIn, checkOut, date });
  if (range.error) return { available: false, reason: range.error };

  const { start, end } = range;

  if (start < todayUtc()) {
    return { available: false, reason: 'Bookings cannot start in the past' };
  }

  const bookingQuery = {
    listing: listing._id,
    checkIn: { $lt: end },
    checkOut: { $gt: start },
    ...ACTIVE_BOOKING_FILTER(),
  };
  if (excludeBookingId) bookingQuery._id = { $ne: excludeBookingId };

  const [bookings, blocks] = await Promise.all([
    Booking.find(bookingQuery).select('checkIn checkOut units').lean(),
    AvailabilityBlock.find({
      listing: listing._id,
      startDate: { $lt: end },
      endDate: { $gt: start },
    }).select('startDate endDate').lean(),
  ]);

  const intervals = [
    ...bookings.map(b => ({ start: b.checkIn, end: b.checkOut, units: b.units || 1 })),
    // An operator block consumes the entire listing, so it always wins.
    ...blocks.map(b => ({ start: b.startDate, end: b.endDate, units: capacity })),
  ];

  const peak = maxConcurrentUnits(intervals, start, end);
  const remaining = capacity - peak;

  if (requested > remaining) {
    return {
      available: false,
      reason: remaining <= 0
        ? 'Those dates are already taken'
        : `Only ${remaining} of ${capacity} available for those dates`,
      remaining: Math.max(0, remaining),
      start,
      end,
    };
  }

  return { available: true, remaining: remaining - requested, start, end, nights: nightsBetween(start, end) };
};

/**
 * Per-day occupancy for a calendar view: which days are full, and how much is left
 * on the days that aren't. Powers both the tourist date picker and the operator calendar.
 */
export const getCalendar = async (listing, fromInput, toInput) => {
  if (listing.category === 'artisan') return { days: [], capacity: capacityOf(listing) };

  const from = toUtcMidnight(fromInput) || todayUtc();
  let to = toUtcMidnight(toInput) || addDays(from, 60);

  if (to <= from) to = addDays(from, 1);

  const span = nightsBetween(from, to);
  if (span > MAX_CALENDAR_DAYS) to = addDays(from, MAX_CALENDAR_DAYS);

  const capacity = capacityOf(listing);

  const [bookings, blocks] = await Promise.all([
    Booking.find({
      listing: listing._id,
      checkIn: { $lt: to },
      checkOut: { $gt: from },
      ...ACTIVE_BOOKING_FILTER(),
    }).select('checkIn checkOut units').lean(),
    AvailabilityBlock.find({
      listing: listing._id,
      startDate: { $lt: to },
      endDate: { $gt: from },
    }).select('startDate endDate reason').lean(),
  ]);

  const days = [];
  for (let cursor = from; cursor < to; cursor = addDays(cursor, 1)) {
    const next = addDays(cursor, 1);

    const booked = bookings
      .filter(b => b.checkIn < next && b.checkOut > cursor)
      .reduce((sum, b) => sum + (b.units || 1), 0);

    const blocked = blocks.some(b => b.startDate < next && b.endDate > cursor);

    const used = blocked ? capacity : booked;

    days.push({
      date: toDateKey(cursor),
      capacity,
      booked,
      blocked,
      remaining: Math.max(0, capacity - used),
      isFull: capacity - used <= 0,
      isPast: cursor < todayUtc(),
    });
  }

  return { days, capacity };
};

/**
 * Work out what stands between the operator and closing [start, end).
 *
 * A block shuts the WHOLE listing, so unlike `checkAvailability` this is not
 * capacity arithmetic: a single booked room on a day is enough to make that day
 * un-closable, even in a ten-room homestay.
 *
 * Days already covered by an existing block are treated as "nothing to do" rather
 * than as free, so a partial close doesn't lay a second block on top of the first.
 *
 * Returns:
 *   conflicts    the active bookings in the way, tourist populated
 *   busyDates    YYYY-MM-DD keys that a booking occupies
 *   freeRanges   consecutive [start, end) spans that CAN be closed right now
 */
export const inspectClosure = async (listing, start, end) => {
  const [bookings, blocks] = await Promise.all([
    Booking.find({
      listing: listing._id,
      checkIn: { $lt: end },
      checkOut: { $gt: start },
      ...ACTIVE_BOOKING_FILTER(),
    })
      .select('checkIn checkOut units status holdExpiresAt bookingRef guestName guestPhone amountPaise refundedPaise category')
      .populate('tourist', 'name email')
      .sort('checkIn')
      .lean(),
    AvailabilityBlock.find({
      listing: listing._id,
      startDate: { $lt: end },
      endDate: { $gt: start },
    }).select('startDate endDate').lean(),
  ]);

  const busyDates = [];
  const closable = [];

  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) {
    const next = addDays(cursor, 1);
    const taken = bookings.some(b => b.checkIn < next && b.checkOut > cursor);
    const alreadyClosed = blocks.some(b => b.startDate < next && b.endDate > cursor);

    if (taken) busyDates.push(toDateKey(cursor));
    closable.push(!taken && !alreadyClosed);
  }

  // Collapse the run of closable days into as few blocks as possible.
  const freeRanges = [];
  let runStart = null;

  for (let i = 0; i < closable.length; i += 1) {
    if (closable[i] && runStart === null) runStart = i;
    if (!closable[i] && runStart !== null) {
      freeRanges.push({ start: addDays(start, runStart), end: addDays(start, i) });
      runStart = null;
    }
  }
  if (runStart !== null) {
    freeRanges.push({ start: addDays(start, runStart), end: addDays(start, closable.length) });
  }

  return { conflicts: bookings, busyDates, freeRanges };
};

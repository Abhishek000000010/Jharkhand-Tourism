import OperatorProfile from '../models/OperatorProfile.js';
import Listing from '../models/Listing.js';
import Booking, { OCCUPYING_STATUSES } from '../models/Booking.js';
import AvailabilityBlock from '../models/AvailabilityBlock.js';
import Review from '../models/Review.js';
import Conversation from '../models/Conversation.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import { invalidateKnowledgeCache } from '../services/knowledgeService.js';
import {
  toUtcMidnight,
  todayUtc,
  getCalendar,
  inspectClosure,
  toDateKey,
  capacityOf,
  MAX_NIGHTS,
  addDays,
} from '../services/availabilityService.js';

// Multipart form fields arrive as comma-separated strings; JSON bodies may already be arrays.
const parseCsv = (value) => {
  if (Array.isArray(value)) return value.map(s => String(s).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map(s => s.trim()).filter(Boolean);
  return undefined;
};

// Each vendor type sells a different unit, so each needs different fields present.
// Enforced server-side because the browser form is not a security boundary.
const validateCategoryFields = (category, body) => {
  if (!['homestay', 'guide', 'artisan'].includes(category)) {
    return 'Category must be one of: homestay, guide, artisan';
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) {
    return 'Price must be a number of 0 or more';
  }

  if (category === 'homestay') {
    const rooms = Number(body.rooms);
    if (!Number.isFinite(rooms) || rooms < 1) {
      return 'A homestay must have at least 1 room';
    }
  }

  if (category === 'guide' && !parseCsv(body.languages)) {
    return 'A guide must list at least one language';
  }

  if (category === 'artisan') {
    const stock = Number(body.stockQuantity);
    if (!Number.isFinite(stock) || stock < 0) {
      return 'Stock quantity must be a number of 0 or more';
    }
    if (!body.craftType) {
      return 'An artisan listing must have a craft type';
    }
  }

  return null;
};

// @desc    Submit operator profile & KYC
// @route   POST /api/operator/profile
// @access  Private/Operator
export const submitProfile = async (req, res) => {
  try {
    const { businessName, contactPhone, district } = req.body;
    
    // Check if user already has a profile
    let profile = await OperatorProfile.findOne({ user: req.user.id });

    if (profile && profile.status !== 'rejected') {
      return res.status(400).json({ success: false, message: 'Profile already submitted and is pending or approved.' });
    }

    let kycDocumentId = '';

    // Handle File Upload
    if (req.file) {
      if (!isCloudinaryConfigured()) {
        // Mock upload for local testing when no Cloudinary credentials are present
        kycDocumentId = `mock_kyc_${Date.now()}`;
      } else {
        // Upload to cloudinary as authenticated/private
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'jhk-tourism-kyc',
          type: 'authenticated' // Private, requires signed URL to view
        });
        kycDocumentId = result.public_id;
      }
    } else {
       return res.status(400).json({ success: false, message: 'Please upload a KYC document' });
    }

    if (profile) {
      // Update rejected profile
      profile.businessName = businessName;
      profile.contactPhone = contactPhone;
      profile.district = district;
      profile.kycDocumentId = kycDocumentId;
      profile.status = 'pending';
      profile.rejectionReason = '';
      await profile.save();
    } else {
      // Create new profile
      profile = await OperatorProfile.create({
        user: req.user.id,
        businessName,
        contactPhone,
        district,
        kycDocumentId
      });
    }

    res.status(201).json({ success: true, profile });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'An operator is already registered with this phone number.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my operator profile
// @route   GET /api/operator/profile
// @access  Private/Operator
export const getMyProfile = async (req, res) => {
  try {
    const profile = await OperatorProfile.findOne({ user: req.user.id });
    if (!profile) {
       return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.status(200).json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new listing
// @route   POST /api/operator/listings
// @access  Private/Operator
export const createListing = async (req, res) => {
  try {
    const { category, title, description, district, price, rooms, amenities, languages, specialities, serviceArea, craftType, stockQuantity } = req.body;

    // An operator must have submitted a profile before listing anything. The profile
    // may still be `pending` — those listings just stay hidden from the public feed.
    const profile = await OperatorProfile.findOne({ user: req.user.id });
    if (!profile) {
      return res.status(403).json({ success: false, message: 'Please complete operator onboarding before creating listings.' });
    }

    const validationError = validateCategoryFields(category, req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    let images = [];
    if (req.files && req.files.length > 0) {
      // Upload multiple images to cloudinary public space
      for (const file of req.files) {
        // Here we mock upload if cloudinary is not fully configured, similar to KYC
        if (!isCloudinaryConfigured()) {
           images.push(`https://placehold.co/400x300/1a1a2e/eee?text=Mock+Image+${images.length+1}`);
        } else {
           const b64 = Buffer.from(file.buffer).toString('base64');
           const dataURI = `data:${file.mimetype};base64,${b64}`;
           const result = await cloudinary.uploader.upload(dataURI, { folder: 'jhk-tourism/listings' });
           images.push(result.secure_url);
        }
      }
    }

    const listing = await Listing.create({
      operator: req.user.id,
      category, title, description, district, price: Number(price),
      images,
      rooms: rooms !== undefined && rooms !== '' ? Number(rooms) : undefined,
      amenities: parseCsv(amenities),
      languages: parseCsv(languages),
      specialities: parseCsv(specialities),
      serviceArea,
      craftType,
      stockQuantity: stockQuantity !== undefined && stockQuantity !== '' ? Number(stockQuantity) : undefined
    });

    // The assistant caches the catalogue; without this it would quote a stale
    // price, or miss a brand-new listing entirely, for up to five minutes.
    invalidateKnowledgeCache();
    res.status(201).json({ success: true, listing });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get operator's own listings
// @route   GET /api/operator/listings
// @access  Private/Operator
export const getMyListings = async (req, res) => {
  try {
    const listings = await Listing.find({ operator: req.user.id }).sort('-createdAt');
    res.status(200).json({ success: true, listings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update listing
// @route   PUT /api/operator/listings/:id
// @access  Private/Operator
export const updateListing = async (req, res) => {
  try {
    let listing = await Listing.findById(req.params.id);
    
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
    if (listing.operator.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized to modify this listing' });

    // In a real app we'd handle updating images, but for simplicity we'll just update text fields.
    // Note: `category` is deliberately not updatable — a homestay cannot become an artisan
    // stall, and the availability rules in Phase 4 depend on it staying fixed.
    const { title, description, district, price, isActive, rooms, amenities, languages, specialities, serviceArea, craftType, stockQuantity } = req.body;

    // These use an explicit undefined check rather than truthiness, so that a
    // legitimate 0 (artisan sold out, price dropped to free) actually saves.
    if (title !== undefined) listing.title = title;
    if (description !== undefined) listing.description = description;
    if (district !== undefined) listing.district = district;
    if (price !== undefined && price !== '') listing.price = Number(price);
    if (isActive !== undefined) listing.isActive = isActive === true || isActive === 'true';

    if (rooms !== undefined && rooms !== '') listing.rooms = Number(rooms);
    if (parseCsv(amenities)) listing.amenities = parseCsv(amenities);
    if (parseCsv(languages)) listing.languages = parseCsv(languages);
    if (parseCsv(specialities)) listing.specialities = parseCsv(specialities);
    if (serviceArea !== undefined) listing.serviceArea = serviceArea;
    if (craftType !== undefined) listing.craftType = craftType;
    if (stockQuantity !== undefined && stockQuantity !== '') listing.stockQuantity = Number(stockQuantity);

    await listing.save();
    invalidateKnowledgeCache();
    res.status(200).json({ success: true, listing });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete listing
// @route   DELETE /api/operator/listings/:id
// @access  Private/Operator
export const deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
    if (listing.operator.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized to delete this listing' });

    await listing.deleteOne();
    invalidateKnowledgeCache();
    res.status(200).json({ success: true, message: 'Listing removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Load a listing the logged-in operator owns. Unlike the public lookup this does
 * NOT require the operator to be approved — a pending operator still needs to be
 * able to manage their own calendar before they go live.
 */
const findOwnListing = async (listingId, userId) => {
  const listing = await Listing.findById(listingId).lean();
  if (!listing) return { error: 'notFound' };
  if (listing.operator.toString() !== userId) return { error: 'forbidden' };
  return { listing };
};

// @desc    Day-by-day availability for one of the operator's own listings
// @route   GET /api/operator/listings/:id/calendar
// @access  Private/Operator
export const getListingCalendarForOperator = async (req, res) => {
  try {
    const { listing, error } = await findOwnListing(req.params.id, req.user.id);
    if (error === 'notFound') return res.status(404).json({ success: false, message: 'Listing not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Not authorized to view this calendar' });

    const calendar = await getCalendar(listing, req.query.from, req.query.to);

    const blocks = await AvailabilityBlock.find({ listing: listing._id })
      .sort('startDate')
      .lean();

    res.status(200).json({ success: true, category: listing.category, ...calendar, blocks });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Listing not found' });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Trim a booking that is blocking a closure down to what the operator needs in
 * order to decide, and state up front which action its status actually allows —
 * an unpaid hold cannot be rejected, it simply expires on its own.
 */
const serialiseConflict = (booking) => {
  const stayEnded = booking.checkOut ? toUtcMidnight(booking.checkOut) <= todayUtc() : false;

  return {
    _id: booking._id,
    bookingRef: booking.bookingRef,
    status: booking.status,
    category: booking.category,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    units: booking.units,
    amountPaise: booking.amountPaise,
    refundedPaise: booking.refundedPaise || 0,
    holdExpiresAt: booking.holdExpiresAt,
    guestName: booking.guestName || booking.tourist?.name || 'Guest',
    guestPhone: booking.guestPhone,
    guestEmail: booking.tourist?.email,
    // Mirrors rejectBooking's own guards, so the UI never offers a button that 400s.
    canReject: booking.status === 'confirmed' && !stayEnded,
  };
};

// @desc    Block dates on the operator's own listing (maintenance, personal use)
// @route   POST /api/operator/listings/:id/blocks
// @access  Private/Operator
export const createBlock = async (req, res) => {
  try {
    const { listing, error } = await findOwnListing(req.params.id, req.user.id);
    if (error === 'notFound') return res.status(404).json({ success: false, message: 'Listing not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Not authorized to modify this calendar' });

    if (listing.category === 'artisan') {
      return res.status(400).json({ success: false, message: 'Craft listings use stock quantity, not a calendar. Set stock to 0 to pause sales.' });
    }

    const start = toUtcMidnight(req.body.startDate);
    // A single-day block is expressed as [day, day + 1) like everything else
    const end = req.body.endDate ? toUtcMidnight(req.body.endDate) : (start ? addDays(start, 1) : null);

    if (!start) return res.status(400).json({ success: false, message: 'Provide a valid start date as YYYY-MM-DD' });
    if (!end) return res.status(400).json({ success: false, message: 'Provide a valid end date as YYYY-MM-DD' });
    if (end <= start) return res.status(400).json({ success: false, message: 'Block end date must be after the start date' });
    if (start < todayUtc()) return res.status(400).json({ success: false, message: 'Cannot block dates in the past' });

    const days = Math.round((end - start) / (24 * 60 * 60 * 1000));
    if (days > MAX_NIGHTS) {
      return res.status(400).json({ success: false, message: `A single block can span at most ${MAX_NIGHTS} days` });
    }

    // Refuse to block over live bookings. Honouring an existing booking matters more
    // than the operator's convenience, and silently double-committing the room is worse
    // than making them deal with it explicitly. But say WHO is in the way, and offer
    // the days that are actually free — usually only one night of a week is booked.
    const { conflicts, busyDates, freeRanges } = await inspectClosure(listing, start, end);

    // `skipConflicts` is the operator answering "close the free dates only".
    if (conflicts.length > 0 && !req.body.skipConflicts) {
      return res.status(409).json({
        success: false,
        code: 'BOOKING_CONFLICT',
        message: `Those dates already have ${conflicts.length} active booking(s).`,
        requested: { startDate: toDateKey(start), endDate: toDateKey(end) },
        busyDates,
        freeRanges: freeRanges.map(r => ({ startDate: toDateKey(r.start), endDate: toDateKey(r.end) })),
        conflicts: conflicts.map(serialiseConflict),
      });
    }

    if (freeRanges.length === 0) {
      return res.status(409).json({
        success: false,
        code: conflicts.length > 0 ? 'BOOKING_CONFLICT' : 'ALREADY_CLOSED',
        message: conflicts.length > 0
          ? 'Every date in that range is booked — there is nothing left to close.'
          : 'Those dates are already closed.',
        requested: { startDate: toDateKey(start), endDate: toDateKey(end) },
        busyDates,
        freeRanges: [],
        conflicts: conflicts.map(serialiseConflict),
      });
    }

    // One block per free run, so 17th–22nd with the 18th booked closes as two
    // tidy periods rather than one block that lies about the 18th.
    const blocks = await AvailabilityBlock.insertMany(
      freeRanges.map(range => ({
        listing: listing._id,
        operator: req.user.id,
        startDate: range.start,
        endDate: range.end,
        reason: req.body.reason || '',
      }))
    );

    res.status(201).json({
      success: true,
      blocks,
      block: blocks[0], // single-block callers predate the partial close
      skipped: busyDates,
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Listing not found' });
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove a date block
// @route   DELETE /api/operator/blocks/:blockId
// @access  Private/Operator
export const deleteBlock = async (req, res) => {
  try {
    const block = await AvailabilityBlock.findById(req.params.blockId);

    if (!block) return res.status(404).json({ success: false, message: 'Block not found' });
    if (block.operator.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to remove this block' });
    }

    await block.deleteOne();
    res.status(200).json({ success: true, message: 'Dates reopened' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Block not found' });
    res.status(500).json({ success: false, message: error.message });
  }
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const OCCUPANCY_DAYS = 30;
const HEATMAP_DAYS = 60;

/**
 * Ranges the dashboard can be scoped to. `months: null` means all time.
 *
 * A single month is bucketed by day; anything longer by month. Thirty daily points
 * make a readable line, but 365 of them are mush.
 */
const RANGES = {
  '1m': { months: 1, label: 'This month', granularity: 'day' },
  '3m': { months: 3, label: 'Last 3 months', granularity: 'month' },
  '6m': { months: 6, label: 'Last 6 months', granularity: 'month' },
  '12m': { months: 12, label: 'Last 12 months', granularity: 'month' },
  all: { months: null, label: 'All time', granularity: 'month' },
};

const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const sumBy = (list, key) => list.reduce((total, item) => total + (item[key] || 0), 0);

/**
 * Month-on-month change. Returns null rather than Infinity when there is nothing to
 * compare against, so the UI can say "new" instead of printing a nonsense percentage.
 */
const deltaPercent = (current, previous) => {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

/** Unit-nights a booking consumes inside [from, to). */
const overlapNights = (booking, from, to) => {
  if (!booking.checkIn || !booking.checkOut) return 0;
  const start = booking.checkIn < from ? from : booking.checkIn;
  const end = booking.checkOut > to ? to : booking.checkOut;
  if (end <= start) return 0;
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) * (booking.units || 1);
};

const OUTCOME_LABELS = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  pending_payment: 'Awaiting payment',
  cancelled: 'Cancelled by guest',
  rejected: 'You cancelled',
  no_show: 'No show',
  expired: 'Hold expired',
};

// @desc    Day-by-day agenda of who is arriving, leaving and staying
// @route   GET /api/operator/timeline?days=14
// @access  Private/Operator
//
// A booking list answers "what have I sold". It does not answer the question an
// owner actually asks every morning — "who is turning up today, and which rooms
// are free tonight". That is a different shape of data, so it gets its own view.
export const getTimeline = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 60);

    const start = req.query.from ? (toUtcMidnight(req.query.from) || todayUtc()) : todayUtc();
    const end = addDays(start, days);

    const [listings, bookings, blocks] = await Promise.all([
      Listing.find({ operator: operatorId, category: { $ne: 'artisan' } }).lean(),
      Booking.find({
        operator: operatorId,
        checkIn: { $lt: end },
        checkOut: { $gt: addDays(start, -1) },
        status: { $in: ['confirmed', 'completed', 'no_show'] },
      })
        .populate('listing', 'title district rooms')
        .populate('tourist', 'name email')
        .lean(),
      AvailabilityBlock.find({
        operator: operatorId,
        startDate: { $lt: end },
        endDate: { $gt: start },
      }).populate('listing', 'title').lean(),
    ]);

    const capacity = listings.reduce((total, l) => total + capacityOf(l), 0);

    const entry = (b) => ({
      id: b._id,
      bookingRef: b.bookingRef,
      guestName: b.guestName || b.tourist?.name || 'Guest',
      guestPhone: b.guestPhone,
      listingTitle: b.listing?.title,
      listingId: b.listing?._id,
      units: b.units,
      nights: b.checkIn && b.checkOut
        ? Math.round((new Date(b.checkOut) - new Date(b.checkIn)) / (24 * 60 * 60 * 1000))
        : null,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      status: b.status,
      amountPaise: b.amountPaise,
      payoutPaise: b.operatorPayoutPaise,
    });

    const timeline = [];

    for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) {
      const next = addDays(cursor, 1);
      const sameDay = (value) => value && toUtcMidnight(value).getTime() === cursor.getTime();

      const arrivals = bookings.filter(b => sameDay(b.checkIn)).map(entry);
      const departures = bookings.filter(b => sameDay(b.checkOut)).map(entry);

      // In-house means sleeping here tonight: arrived on or before today, leaving
      // after today. Someone checking out this morning is a departure, not a guest.
      const staying = bookings
        .filter(b => b.checkIn && b.checkIn <= cursor && b.checkOut > cursor)
        .map(entry);

      const closed = blocks
        .filter(b => b.startDate < next && b.endDate > cursor)
        .map(b => ({ id: b._id, listingTitle: b.listing?.title, reason: b.reason }));

      const occupied = staying.reduce((total, s) => total + (s.units || 1), 0);

      timeline.push({
        date: toDateKey(cursor),
        arrivals,
        departures,
        staying,
        closed,
        occupied,
        capacity,
        free: Math.max(0, capacity - occupied),
      });
    }

    res.status(200).json({ success: true, days, capacity, timeline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Earnings and performance for the logged-in operator
// @route   GET /api/operator/analytics
// @access  Private/Operator
//
// Deliberately built from the SAME set as the bookings page ledger — every booking
// that was actually paid for, not only completed ones. The previous version counted
// `completed` alone, so this page and that one reported different revenue for the
// same account, which is the kind of thing that destroys trust in a dashboard.
export const getAnalytics = async (req, res) => {
  try {
    const operatorId = req.user.id;

    const range = RANGES[req.query.range] ? req.query.range : '6m';
    const { months, granularity } = RANGES[range];

    const now = new Date();
    const today = todayUtc();

    // The window the money figures cover. Deltas compare it against the period of
    // equal length immediately before it, which works for any range — "vs last
    // month" only ever made sense for one of them.
    const periodStart = months
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
      : new Date(0);
    const previousStart = months
      ? new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - months, 1))
      : new Date(0);

    const [listings, bookings, profile, reviews, conversations] = await Promise.all([
      Listing.find({ operator: operatorId }).lean(),
      Booking.find({ operator: operatorId })
        .populate('listing', 'title category district rooms')
        .populate('tourist', 'name email')
        .sort('-createdAt')
        .lean(),
      OperatorProfile.findOne({ user: operatorId }).lean(),
      Review.find({ operator: operatorId }).select('rating operatorReply listing createdAt').lean(),
      Conversation.find({ operator: operatorId }).select('tourist listing unreadOperator').lean(),
    ]);

    const allPaid = bookings.filter(b => b.paidAt);
    const inPeriod = allPaid.filter(b => new Date(b.paidAt) >= periodStart);
    const inPrevious = months
      ? allPaid.filter(b => new Date(b.paidAt) >= previousStart && new Date(b.paidAt) < periodStart)
      : [];

    // ---- Headline money, scoped to the chosen range ----
    const grossPaise = sumBy(inPeriod, 'amountPaise');
    const refundedPaise = sumBy(inPeriod, 'refundedPaise');
    const commissionPaise = sumBy(inPeriod, 'commissionPaise');
    const netPaise = sumBy(inPeriod, 'operatorPayoutPaise');

    // ---- Series: daily inside a single month, monthly beyond ----
    const buckets = new Map();

    if (granularity === 'day') {
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      for (let cursor = periodStart; cursor < monthEnd; cursor = addDays(cursor, 1)) {
        buckets.set(toDateKey(cursor), {
          key: toDateKey(cursor),
          label: String(cursor.getUTCDate()),
          grossPaise: 0,
          netPaise: 0,
          bookings: 0,
        });
      }
    } else {
      const span = months || Math.max(1, Math.round((now - (allPaid.length
        ? new Date(Math.min(...allPaid.map(b => new Date(b.paidAt))))
        : now)) / (30 * 24 * 60 * 60 * 1000)) + 1);

      for (let i = span - 1; i >= 0; i -= 1) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        buckets.set(monthKey(d), {
          key: monthKey(d),
          label: MONTH_LABELS[d.getUTCMonth()],
          grossPaise: 0,
          netPaise: 0,
          bookings: 0,
        });
      }
    }

    for (const b of allPaid) {
      const key = granularity === 'day' ? toDateKey(toUtcMidnight(b.paidAt)) : monthKey(b.paidAt);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.grossPaise += b.amountPaise || 0;
      bucket.netPaise += b.operatorPayoutPaise || 0;
      bucket.bookings += 1;
    }

    const series = [...buckets.values()];

    // ---- Occupancy: the number a homestay owner actually runs their year on ----
    const dateListings = listings.filter(l => l.category !== 'artisan');
    const windowStart = today;
    const windowEnd = addDays(windowStart, OCCUPANCY_DAYS);
    const prevStart = addDays(windowStart, -OCCUPANCY_DAYS);

    const occupies = (b) =>
      OCCUPYING_STATUSES.includes(b.status) ||
      (b.status === 'pending_payment' && b.holdExpiresAt && new Date(b.holdExpiresAt) > now);

    const live = bookings.filter(occupies);
    const capacityNights = dateListings.reduce((total, l) => total + capacityOf(l) * OCCUPANCY_DAYS, 0);

    const soldNights = live.reduce((total, b) => total + overlapNights(b, windowStart, windowEnd), 0);
    const prevSoldNights = live.reduce((total, b) => total + overlapNights(b, prevStart, windowStart), 0);

    const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
    const occupancyPercent = pct(soldNights, capacityNights);
    const prevOccupancyPercent = pct(prevSoldNights, capacityNights);

    // ---- How bookings end up ----
    const outcomeCounts = bookings.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});

    const outcomes = Object.entries(OUTCOME_LABELS)
      .map(([status, label]) => ({
        status,
        label,
        count: outcomeCounts[status] || 0,
        percent: pct(outcomeCounts[status] || 0, bookings.length),
      }))
      .filter(o => o.count > 0);

    const settled = (outcomeCounts.completed || 0) + (outcomeCounts.no_show || 0);
    const lost = (outcomeCounts.cancelled || 0) + (outcomeCounts.rejected || 0);
    const honoured = settled + (outcomeCounts.confirmed || 0);

    // ---- Per-listing performance ----
    const byListing = new Map(listings.map(l => [String(l._id), []]));
    for (const b of bookings) {
      const key = String(b.listing?._id || b.listing);
      if (byListing.has(key)) byListing.get(key).push(b);
    }

    const listingStats = listings.map(l => {
      const own = byListing.get(String(l._id)) || [];
      const ownPaid = own.filter(b => b.paidAt);
      const ownLive = own.filter(occupies);
      const capacity = l.category === 'artisan' ? 0 : capacityOf(l) * OCCUPANCY_DAYS;

      return {
        id: l._id,
        title: l.title,
        category: l.category,
        district: l.district,
        price: l.price,
        rooms: l.rooms,
        isActive: l.isActive,
        bookings: ownPaid.length,
        netPaise: sumBy(ownPaid, 'operatorPayoutPaise'),
        nightsSold: ownLive.reduce((t, b) => t + overlapNights(b, windowStart, windowEnd), 0),
        occupancyPercent: pct(
          ownLive.reduce((t, b) => t + overlapNights(b, windowStart, windowEnd), 0),
          capacity
        ),
        ratingAvg: l.ratingCount ? Math.round((l.ratingSum / l.ratingCount) * 10) / 10 : null,
        ratingCount: l.ratingCount || 0,
      };
    }).sort((a, b) => b.netPaise - a.netPaise);

    // ---- Who is arriving next ----
    const upcoming = bookings
      .filter(b => b.status === 'confirmed' && b.checkIn && new Date(b.checkIn) >= windowStart)
      .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn))
      .slice(0, 5)
      .map(b => ({
        id: b._id,
        bookingRef: b.bookingRef,
        guestName: b.guestName || b.tourist?.name || 'Guest',
        listingTitle: b.listing?.title,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        units: b.units,
        amountPaise: b.amountPaise,
        payoutPaise: b.operatorPayoutPaise,
      }));

    // ---- Occupancy heatmap: the densest honest widget on the page ----
    const heatmapEnd = addDays(today, HEATMAP_DAYS);
    const blocks = dateListings.length
      ? await AvailabilityBlock.find({
        listing: { $in: dateListings.map(l => l._id) },
        startDate: { $lt: heatmapEnd },
        endDate: { $gt: today },
      }).select('listing startDate endDate').lean()
      : [];

    const totalCapacity = dateListings.reduce((total, l) => total + capacityOf(l), 0);
    const heatmap = [];

    for (let cursor = today; cursor < heatmapEnd; cursor = addDays(cursor, 1)) {
      const next = addDays(cursor, 1);

      const booked = live
        .filter(b => b.checkIn && b.checkIn < next && b.checkOut > cursor)
        .reduce((total, b) => total + (b.units || 1), 0);

      // A closed listing takes its whole capacity out of the day, exactly as the
      // availability engine treats it.
      const closed = blocks
        .filter(b => b.startDate < next && b.endDate > cursor)
        .reduce((total, block) => {
          const listing = dateListings.find(l => String(l._id) === String(block.listing));
          return total + (listing ? capacityOf(listing) : 0);
        }, 0);

      const used = Math.min(totalCapacity, booked + closed);

      heatmap.push({
        date: toDateKey(cursor),
        capacity: totalCapacity,
        booked,
        closed,
        percent: pct(used, totalCapacity),
      });
    }

    // ---- What the operator should actually go and do ----
    const staysToComplete = bookings.filter(
      b => b.status === 'confirmed' && b.checkOut && toUtcMidnight(b.checkOut) <= today
    ).length;
    const reviewsToAnswer = reviews.filter(r => !r.operatorReply).length;
    const messagesToAnswer = conversations.filter(c => (c.unreadOperator || 0) > 0).length;

    const attention = [
      {
        key: 'complete',
        label: 'Stays waiting to be marked completed',
        count: staysToComplete,
        link: '/operator/bookings',
      },
      {
        key: 'messages',
        label: 'Guest messages you have not answered',
        count: messagesToAnswer,
        link: '/operator/messages',
      },
      {
        key: 'reviews',
        label: 'Reviews without a reply',
        count: reviewsToAnswer,
        link: '/operator/reviews',
      },
      {
        key: 'verification',
        label: 'Verification still pending',
        count: profile && profile.status !== 'approved' ? 1 : 0,
        link: '/operator/status',
      },
    ].filter(item => item.count > 0);

    // ---- Did enquiries turn into stays? ----
    // Matched on (tourist, listing) because that is exactly what a thread is about:
    // this traveller asking about this property.
    const bookedPairs = new Set(
      bookings.map(b => `${String(b.tourist?._id || b.tourist)}:${String(b.listing?._id || b.listing)}`)
    );
    const converted = conversations.filter(
      c => bookedPairs.has(`${String(c.tourist)}:${String(c.listing)}`)
    ).length;

    const conversion = {
      enquiries: conversations.length,
      converted,
      rate: pct(converted, conversations.length),
    };

    // ---- Settlement ledger, drawn from real bookings rather than invented rows ----
    const settlements = allPaid
      // A fully refunded booking owes the operator nothing — it belongs in the
      // bookings list, not in a ledger of money coming their way.
      .filter(b => (b.operatorPayoutPaise || 0) > 0)
      .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
      .slice(0, 8)
      .map(b => ({
        reference: b.bookingRef || `SETT-${String(b._id).slice(-8).toUpperCase()}`,
        listingTitle: b.listing?.title,
        date: b.checkOut || b.paidAt,
        amountPaise: b.operatorPayoutPaise || 0,
        // Honest about what has actually cleared: money is only due once the stay is over.
        status: b.checkOut && new Date(b.checkOut) <= now ? 'Settled' : 'Scheduled',
      }));

    const ratingCount = listings.reduce((t, l) => t + (l.ratingCount || 0), 0);
    const ratingSum = listings.reduce((t, l) => t + (l.ratingSum || 0), 0);

    // Nights actually sold in the period, so "average nightly rate" means what an
    // operator thinks it means rather than revenue divided by booking count.
    const nightsInPeriod = inPeriod.reduce((total, b) => {
      if (!b.checkIn || !b.checkOut) return total;
      return total + Math.round((new Date(b.checkOut) - new Date(b.checkIn)) / (24 * 60 * 60 * 1000)) * (b.units || 1);
    }, 0);
    const prevNights = inPrevious.reduce((total, b) => {
      if (!b.checkIn || !b.checkOut) return total;
      return total + Math.round((new Date(b.checkOut) - new Date(b.checkIn)) / (24 * 60 * 60 * 1000)) * (b.units || 1);
    }, 0);

    const avgNightlyPaise = nightsInPeriod ? Math.round(grossPaise / nightsInPeriod) : 0;
    const prevAvgNightlyPaise = prevNights ? Math.round(sumBy(inPrevious, 'amountPaise') / prevNights) : 0;

    res.status(200).json({
      success: true,
      range: { key: range, label: RANGES[range].label, granularity, options: Object.entries(RANGES).map(([key, r]) => ({ key, label: r.label })) },
      summary: {
        grossPaise,
        refundedPaise,
        commissionPaise,
        netPaise,
        bookingsTotal: inPeriod.length,
        activeListings: listings.filter(l => l.isActive).length,
        totalListings: listings.length,
        nightsSold: soldNights,
        capacityNights,
        occupancyPercent,
        occupancyDelta: Math.round((occupancyPercent - prevOccupancyPercent) * 10) / 10,
        avgNightlyPaise,
        ratingAvg: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
        ratingCount,
        honourRate: pct(honoured, honoured + lost),
        strikes: profile?.strikes || 0,
        lifetimeNetPaise: sumBy(allPaid, 'operatorPayoutPaise'),
      },
      // Change against the equal-length period immediately before this one. Null
      // means there is nothing to compare against, and the UI shows "—" rather
      // than inventing a percentage.
      deltas: {
        netPaise: deltaPercent(netPaise, sumBy(inPrevious, 'operatorPayoutPaise')),
        grossPaise: deltaPercent(grossPaise, sumBy(inPrevious, 'amountPaise')),
        bookings: deltaPercent(inPeriod.length, inPrevious.length),
        avgNightlyPaise: deltaPercent(avgNightlyPaise, prevAvgNightlyPaise),
      },
      changes: {
        netPaise: netPaise - sumBy(inPrevious, 'operatorPayoutPaise'),
        grossPaise: grossPaise - sumBy(inPrevious, 'amountPaise'),
        bookings: inPeriod.length - inPrevious.length,
      },
      series,
      heatmap,
      attention,
      conversion,
      outcomes,
      listings: listingStats,
      upcoming,
      settlements,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

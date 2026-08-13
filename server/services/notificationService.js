import Notification from '../models/Notification.js';
import Booking from '../models/Booking.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const rupees = (paise) => `₹${Math.round((paise || 0) / 100).toLocaleString('en-IN')}`;

const onDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

const stay = (booking) =>
  booking.checkIn ? `${onDate(booking.checkIn)} → ${onDate(booking.checkOut)}` : `${booking.units} item(s)`;

/**
 * Write one notification.
 *
 * Deliberately swallows its own failures. A notification is a courtesy; losing one
 * must never roll back the booking, refund or message that triggered it. Every
 * helper below funnels through here for exactly that reason.
 */
export const notify = async (userId, payload) => {
  if (!userId) return null;

  try {
    return await Notification.create({ user: userId, ...payload });
  } catch (error) {
    console.error('notification failed:', error.message);
    return null;
  }
};

/**
 * Bookings arrive here from several controllers in different shapes — a hydrated
 * document, a lean object, sometimes just an id — so the service reloads what it
 * needs rather than trusting the caller to have populated it.
 */
const loadBooking = async (bookingOrId) => {
  try {
    const id = bookingOrId?._id || bookingOrId;
    return await Booking.findById(id)
      .populate('listing', 'title')
      .populate('tourist', 'name')
      .lean();
  } catch {
    return null;
  }
};

// Where a notification should take each side. Kept here because the recipient's
// role decides the route, and the client cannot work that out from the record.
const TOURIST_BOOKINGS = '/bookings';
const OPERATOR_BOOKINGS = '/operator/bookings';

export const pushBookingConfirmed = async (bookingOrId) => {
  const booking = await loadBooking(bookingOrId);
  if (!booking) return;

  const title = booking.listing?.title || 'your listing';

  await Promise.all([
    notify(booking.tourist?._id, {
      type: 'booking_confirmed',
      title: 'Booking confirmed',
      body: `${title} · ${stay(booking)} · ${rupees(booking.amountPaise)}`,
      link: TOURIST_BOOKINGS,
    }),
    notify(booking.operator, {
      type: 'booking_confirmed',
      title: 'New booking',
      body: `${booking.tourist?.name || 'A traveller'} booked ${title} · ${stay(booking)}`,
      link: OPERATOR_BOOKINGS,
    }),
  ]);
};

export const pushBookingCancelled = async (bookingOrId, { refundedPaise = 0 } = {}) => {
  const booking = await loadBooking(bookingOrId);
  if (!booking) return;

  await notify(booking.operator, {
    type: 'booking_cancelled',
    title: 'A guest cancelled',
    body: `${booking.tourist?.name || 'A traveller'} cancelled ${booking.listing?.title || 'a booking'} · ${stay(booking)}`
      + (refundedPaise ? ` · ${rupees(refundedPaise)} refunded` : ''),
    link: OPERATOR_BOOKINGS,
  });
};

export const pushBookingRejected = async (bookingOrId, { reason = '', refundedPaise = 0 } = {}) => {
  const booking = await loadBooking(bookingOrId);
  if (!booking) return;

  await notify(booking.tourist?._id, {
    type: 'booking_rejected',
    title: 'Your host cancelled',
    body: `${booking.listing?.title || 'Your stay'} · ${stay(booking)}`
      + (refundedPaise ? ` · ${rupees(refundedPaise)} refunded in full` : '')
      + (reason ? ` — "${reason}"` : ''),
    link: TOURIST_BOOKINGS,
  });
};

export const pushBookingSettled = async (bookingOrId, status) => {
  const booking = await loadBooking(bookingOrId);
  if (!booking) return;

  const settled = status === 'no_show'
    ? {
      type: 'booking_no_show',
      title: 'Marked as a no-show',
      body: `${booking.listing?.title || 'Your booking'} · ${stay(booking)}. Contact your host if this looks wrong.`,
    }
    : {
      type: 'booking_completed',
      title: 'Stay completed',
      body: `Hope ${booking.listing?.title || 'your stay'} was good — you can leave a review now.`,
    };

  await notify(booking.tourist?._id, { ...settled, link: TOURIST_BOOKINGS });
};

export const pushRefundIssued = async (bookingOrId, { refundedPaise = 0, reason = '' } = {}) => {
  const booking = await loadBooking(bookingOrId);
  if (!booking) return;

  await notify(booking.tourist?._id, {
    type: 'refund_issued',
    title: `${rupees(refundedPaise)} refunded`,
    body: `${booking.listing?.title || 'Your booking'}${reason ? ` — ${reason}` : ''}`,
    link: TOURIST_BOOKINGS,
  });
};

export const pushMessage = async ({ recipientId, recipientRole, conversationId, senderName, listingTitle, body }) => {
  await notify(recipientId, {
    type: 'message_received',
    title: `${senderName || 'Someone'} sent you a message`,
    body: `${listingTitle ? `${listingTitle} — ` : ''}${body.slice(0, 90)}${body.length > 90 ? '…' : ''}`,
    link: recipientRole === 'operator'
      ? `/operator/messages/${conversationId}`
      : `/messages/${conversationId}`,
  });
};

export const pushReviewReceived = async ({ operatorId, touristName, listingTitle, rating }) => {
  await notify(operatorId, {
    type: 'review_received',
    title: `${rating}★ review from ${touristName || 'a guest'}`,
    body: listingTitle || '',
    link: '/operator/reviews',
  });
};

export const pushReviewReplied = async ({ touristId, listingTitle }) => {
  await notify(touristId, {
    type: 'review_replied',
    title: 'Your host replied to your review',
    body: listingTitle || '',
    link: TOURIST_BOOKINGS,
  });
};

export const pushOperatorDecision = async (profile, status, reason = '') => {
  const approved = status === 'approved';

  await notify(profile?.user, {
    type: approved ? 'operator_approved' : 'operator_rejected',
    title: approved ? 'You are verified' : 'Verification was not approved',
    body: approved
      ? 'Your listings are now live and travellers can book them.'
      : reason || 'Check your details and submit again.',
    link: approved ? '/operator/listings' : '/operator/status',
  });
};
